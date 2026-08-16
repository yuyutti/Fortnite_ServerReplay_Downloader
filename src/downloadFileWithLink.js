// src/downloadFileWithLink.js

const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const needle = require('needle');

const UnsuccessfulRequestException = require('./UnsuccessfulRequestException');
const { emitDebugEvent, getResponseDiagnostics, sanitizeUrl } = require('./debugEvent');
const { getAgent } = require('./httpAgents');

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [300, 600];

const getErrorDetails = (error) => {
  const isHttpError = error instanceof UnsuccessfulRequestException;

  return {
    errorName: error?.name || 'Error',
    errorMessage: error?.message || String(error),
    errorCode: isHttpError ? error.response?.errorCode || null : error?.code || null,
    statusCode: isHttpError ? error.code : null,
  };
};

const fetchWithRetry = async (operation, context) => {
  const maximumAttempts = RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const startedAt = Date.now();
    emitDebugEvent(context.debugCallback, {
      type: 'http_attempt_started',
      client: context.httpClient,
      requestKind: 'chunk',
      chunkId: context.chunkId || null,
      chunkType: context.chunkType ?? null,
      url: sanitizeUrl(context.link),
      attempt,
      maximumAttempts,
    });

    try {
      const result = await operation();
      emitDebugEvent(context.debugCallback, {
        type: 'http_attempt_succeeded',
        client: context.httpClient,
        requestKind: 'chunk',
        chunkId: context.chunkId || null,
        chunkType: context.chunkType ?? null,
        url: sanitizeUrl(context.link),
        attempt,
        maximumAttempts,
        durationMs: Date.now() - startedAt,
        bytes: result.length,
        ...result.diagnostics,
      });
      return result.value;
    } catch (error) {
      const isLastAttempt = attempt === maximumAttempts;
      const retryDelayMs = isLastAttempt ? 0 : RETRY_DELAYS_MS[attempt - 1];

      emitDebugEvent(context.debugCallback, {
        type: isLastAttempt ? 'http_attempt_failed' : 'http_attempt_retrying',
        client: context.httpClient,
        requestKind: 'chunk',
        chunkId: context.chunkId || null,
        chunkType: context.chunkType ?? null,
        url: sanitizeUrl(context.link),
        attempt,
        maximumAttempts,
        durationMs: Date.now() - startedAt,
        retryDelayMs,
        ...getErrorDetails(error),
      });

      if (isLastAttempt) {
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, retryDelayMs);
      });
    }
  }

  throw new Error('Retry loop ended unexpectedly');
};

const requestBufferWithNeedle = async (link, context) => {
  const response = await needle('get', link, {
    headers: {
      'User-Agent': 'Tournament replay downloader',
    },
    agent: getAgent(link),
    response_timeout: REQUEST_TIMEOUT_MS,
    read_timeout: REQUEST_TIMEOUT_MS,
    open_timeout: REQUEST_TIMEOUT_MS,
  });
  const diagnostics = getResponseDiagnostics(response);

  if (response.statusCode !== 200) {
    throw new UnsuccessfulRequestException(response.statusCode, response.body || {});
  }

  emitDebugEvent(context.debugCallback, {
    type: 'http_response_received',
    client: 'needle',
    requestKind: 'chunk',
    chunkId: context.chunkId || null,
    url: sanitizeUrl(link),
    ...diagnostics,
  });

  return {
    value: response.body,
    length: response.body.length,
    diagnostics,
  };
};

const requestFileWithNeedle = async (link, destination, context) => {
  await fs.promises.rm(destination, { force: true });

  return new Promise((resolve, reject) => {
    let response = null;
    const request = needle.get(link, {
      headers: {
        'User-Agent': 'Tournament replay downloader',
      },
      agent: getAgent(link),
      output: destination,
      response_timeout: REQUEST_TIMEOUT_MS,
      read_timeout: REQUEST_TIMEOUT_MS,
      open_timeout: REQUEST_TIMEOUT_MS,
    });

    request.once('response', (receivedResponse) => {
      response = receivedResponse;
      emitDebugEvent(context.debugCallback, {
        type: 'http_response_received',
        client: 'needle',
        requestKind: 'chunk',
        chunkId: context.chunkId || null,
        url: sanitizeUrl(link),
        ...getResponseDiagnostics(response),
      });

      if (response.statusCode !== 200) {
        request.resume();
      }
    });

    request.once('done', async (error) => {
      if (error) {
        reject(error);
        return;
      }

      if (!response || response.statusCode !== 200) {
        reject(new UnsuccessfulRequestException(response?.statusCode || 0, {}));
        return;
      }

      try {
        const stats = await fs.promises.stat(destination);
        resolve({
          value: stats.size,
          length: stats.size,
          diagnostics: getResponseDiagnostics(response),
        });
      } catch (statError) {
        reject(statError);
      }
    });
  });
};

const requestWithFetch = async (link, destination, context) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(link, {
      headers: {
        'User-Agent': 'Tournament replay downloader',
      },
      signal: controller.signal,
    });
    const diagnostics = getResponseDiagnostics(response);

    emitDebugEvent(context.debugCallback, {
      type: 'http_response_received',
      client: 'fetch',
      requestKind: 'chunk',
      chunkId: context.chunkId || null,
      url: sanitizeUrl(link),
      ...diagnostics,
    });

    if (response.status !== 200) {
      const errorBody = await response.text().catch(() => '');
      throw new UnsuccessfulRequestException(response.status, {
        errorMessage: errorBody || `HTTP ${response.status}`,
      });
    }

    if (destination) {
      await fs.promises.rm(destination, { force: true });
      await pipeline(
        Readable.fromWeb(response.body),
        fs.createWriteStream(destination),
      );
      const stats = await fs.promises.stat(destination);
      return {
        value: stats.size,
        length: stats.size,
        diagnostics,
      };
    }

    const value = Buffer.from(await response.arrayBuffer());
    return {
      value,
      length: value.length,
      diagnostics,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const createContext = (link, options) => ({
  link,
  debugCallback: options.debugCallback,
  httpClient: options.httpClient || 'needle',
  chunkId: options.chunkId,
  chunkType: options.chunkType,
});

const validateHttpClient = (httpClient) => {
  if (!['needle', 'fetch'].includes(httpClient)) {
    throw new RangeError('httpClient must be either "needle" or "fetch"');
  }
};

const downloadFileWithLink = async (link, encoding, options = {}) => {
  const context = createContext(link, options);
  validateHttpClient(context.httpClient);

  return fetchWithRetry(
    () => context.httpClient === 'fetch'
      ? requestWithFetch(link, null, context)
      : requestBufferWithNeedle(link, context),
    context,
  );
};

const downloadFileToPathWithLink = async (link, destination, encoding, options = {}) => {
  const context = createContext(link, options);
  validateHttpClient(context.httpClient);

  return fetchWithRetry(
    () => context.httpClient === 'fetch'
      ? requestWithFetch(link, destination, context)
      : requestFileWithNeedle(link, destination, context),
    context,
  );
};

downloadFileWithLink.toFile = downloadFileToPathWithLink;
downloadFileWithLink.validateHttpClient = validateHttpClient;

module.exports = downloadFileWithLink;
