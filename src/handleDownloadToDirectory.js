// src/handleDownloadToDirectory.js

const path = require('path');
const pLimit = require('p-limit').default;

const downloadFileWithLink = require('./downloadFileWithLink');
const sortChunksByFileSize = require('./sortChunksByFileSize');

const handleDownloadToDirectory = async (
  chunks,
  directory,
  maxConcurrentDownloads,
  updateCallback,
  requestOptions = {},
  downloadToFile = downloadFileWithLink.toFile,
) => {
  const indexedChunks = chunks.map((chunk, index) => ({
    ...chunk,
    originalIndex: index,
  }));
  const sortedChunks = sortChunksByFileSize(indexedChunks);
  const limit = pLimit(maxConcurrentDownloads);
  const results = new Array(chunks.length);

  const downloads = sortedChunks.map((chunk) => limit(async () => {
    const startTime = Date.now();
    const tempFilePath = path.join(directory, `${chunk.originalIndex}.bin`);
    const dataLength = await downloadToFile(
      chunk.DownloadLink,
      tempFilePath,
      chunk.encoding,
      {
        ...requestOptions,
        chunkId: chunk.Id || (chunk.chunkType === 0 ? 'header' : null),
        chunkType: chunk.chunkType,
      },
    );

    results[chunk.originalIndex] = {
      ...chunk,
      size: chunk.size + dataLength,
      dataLength,
      tempFilePath,
      duration: Date.now() - startTime,
    };

    updateCallback(chunk.chunkType);
  }));
  const settledDownloads = await Promise.allSettled(downloads);
  const failedDownload = settledDownloads.find((result) => result.status === 'rejected');

  if (failedDownload) {
    throw failedDownload.reason;
  }

  return results;
};

module.exports = handleDownloadToDirectory;
