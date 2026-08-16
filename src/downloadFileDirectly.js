// src/downloadFileDirectly.js

const needle = require('needle');
const UnsuccessfulRequestException = require('./UnsuccessfulRequestException');
const getAccessToken = require('./getAccessToken');
const { emitDebugEvent, getResponseDiagnostics, sanitizeUrl } = require('./debugEvent');
const { getAgent } = require('./httpAgents');

const downloadFileDirectly = async (link, debugCallback) => {
  const { token } = await getAccessToken(debugCallback);
  const startedAt = Date.now();

  const response = await needle(link, {
    headers: {
      Authorization: token,
      'User-Agent': 'fortnite-replay-downloader',
    },
    agent: getAgent(link),
  });
  const { body, statusCode } = response;

  emitDebugEvent(debugCallback, {
    type: 'http_request_completed',
    client: 'needle',
    requestKind: 'metadata',
    url: sanitizeUrl(link),
    durationMs: Date.now() - startedAt,
    bytes: Buffer.isBuffer(body) ? body.length : null,
    ...getResponseDiagnostics(response),
  });

  if (statusCode !== 200) {
    throw new UnsuccessfulRequestException(statusCode, body);
  }

  return body;
};

module.exports = downloadFileDirectly;
