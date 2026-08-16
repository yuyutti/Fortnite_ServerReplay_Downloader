// src/getDownloadLink.js

const needle = require('needle');

const getAccessToken = require('./getAccessToken');
const UnsuccessfulRequestException = require('./UnsuccessfulRequestException');
const { emitDebugEvent, getResponseDiagnostics, sanitizeUrl } = require('./debugEvent');
const { getAgent } = require('./httpAgents');

/**
 * @param {string} link
 * @param {string[]} files
 */
const getDownloadLink = async (link, files, debugCallback) => {
  const { token } = await getAccessToken(debugCallback);
  const startedAt = Date.now();

  const response = await needle(
    'post',
    link,
    { files },
    {
      json: true,
      headers: {
        Authorization: token,
        'User-Agent': 'fortnite-replay-downloader',
      },
      agent: getAgent(link),
    },
  );
  const { body, statusCode } = response;

  emitDebugEvent(debugCallback, {
    type: 'http_request_completed',
    client: 'needle',
    requestKind: 'download_links',
    url: sanitizeUrl(link),
    durationMs: Date.now() - startedAt,
    requestedFileCount: files.length,
    ...getResponseDiagnostics(response),
  });

  if (statusCode !== 200) {
    throw new UnsuccessfulRequestException(statusCode, body);
  }

  return body.files;
};

module.exports = getDownloadLink;
