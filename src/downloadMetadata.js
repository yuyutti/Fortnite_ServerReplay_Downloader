// src/downloadMetadata.js

const { metaDataUrl } = require('../constants');
const downloadFileDirectly = require('./downloadFileDirectly');

const downloadMetadata = async (matchId, debugCallback) => {
  const data = await downloadFileDirectly(`${metaDataUrl}${matchId}.json`, debugCallback);

  if (!data) {
    return null;
  }

  return JSON.parse(data.toString());
};

module.exports = downloadMetadata;
