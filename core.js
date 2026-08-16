// core.js
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { baseDataUrl, defaultMaxConcurrentDownloads } = require('./constants');
const buildMeta = require('./src/buildMeta');
const buildReplay = require('./src/buildReplay');
const buildReplayToFile = require('./src/buildReplayToFile');
const downloadMetadata = require('./src/downloadMetadata');
const downloadFileWithLink = require('./src/downloadFileWithLink');
const getDownloadLink = require('./src/getDownloadLink');
const handleDownload = require('./src/handleDownload');
const handleDownloadToDirectory = require('./src/handleDownloadToDirectory');
const UnsuccessfulRequestException = require('./src/UnsuccessfulRequestException');

const defaultDownloadConfig = {
  updateCallback: () => { },
  debugCallback: () => { },
  httpClient: 'needle',
  eventCount: 1000,
  dataCount: 1000,
  checkpointCount: 1000,
  maxConcurrentDownloads: defaultMaxConcurrentDownloads,
  matchId: '',
};

const defaultMetadataConfig = {
  matchId: '',
  chunkDownloadLinks: true,
  debugCallback: () => { },
};

const validateMaxConcurrentDownloads = (value) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError('maxConcurrentDownloads must be a positive integer');
  }
};

const applyDefinedOptions = (defaults, options) => ({
  ...defaults,
  ...Object.fromEntries(
    Object.entries(options || {}).filter(([, value]) => value !== undefined),
  ),
});

/**
 * @param {{ Id: string }[] | undefined} arr
 */
const getChunkIds = (arr) => arr?.map((x) => `${x.Id}.bin`) || [];

const downloadMetadataWrapper = async (inConfig) => {
  const config = applyDefinedOptions(defaultMetadataConfig, inConfig);

  const metadata = await downloadMetadata(config.matchId, config.debugCallback);

  if (!metadata) {
    return null;
  }

  if (config.chunkDownloadLinks) {
    const files = await getDownloadLink(
      `${baseDataUrl}${config.matchId}/`,
      [
        'header.bin',
        ...getChunkIds(metadata.Events),
        ...getChunkIds(metadata.Checkpoints),
        ...getChunkIds(metadata.DataChunks),
      ],
      config.debugCallback,
    );

    const eacher = (theChunk) => {
      const chunk = theChunk;
      const index = `${chunk.Id}.bin`;

      if (!files[index]) {
        console.error(index, 'not found in files list');

        return;
      }

      chunk.DownloadLink = files[index].readLink;
      chunk.FileSize = files[index].size;
    };

    if (metadata.Events) {
      metadata.Events.forEach(eacher);
    }

    if (metadata.Checkpoints) {
      metadata.Checkpoints.forEach(eacher);
    }

    if (metadata.DataChunks) {
      metadata.DataChunks.forEach(eacher);
    }

    metadata.Id = 'header';
    eacher(metadata);
    delete metadata.Id;
  }

  return metadata;
};

const prepareReplay = async (inConfig) => {
  const config = applyDefinedOptions(defaultDownloadConfig, inConfig);

  validateMaxConcurrentDownloads(config.maxConcurrentDownloads);
  downloadFileWithLink.validateHttpClient(config.httpClient);

  const meta = await downloadMetadataWrapper(config);

  if (!meta) {
    throw new UnsuccessfulRequestException(500);
  }

  const { updateCallback } = config;

  const downloadChunks = [];
  let { DataChunks, Checkpoints, Events } = meta;

  delete meta.DataChunks;
  delete meta.Checkpoints;
  delete meta.Events;

  if (!DataChunks) {
    DataChunks = [];
  }

  if (!Checkpoints) {
    Checkpoints = [];
  }

  if (!Events) {
    Events = [];
  }

  updateCallback({
    header: {
      current: 0,
      max: 1,
    },
    dataChunks: {
      current: 0,
      max: Math.min(DataChunks.length, config.dataCount),
    },
    eventChunks: {
      current: 0,
      max: Math.min(Events.length, config.eventCount),
    },
    checkpointChunks: {
      current: 0,
      max: Math.min(Checkpoints.length, config.checkpointCount),
    },
  });

  const metaBuffer = buildMeta(meta);

  downloadChunks.push({
    DownloadLink: meta.DownloadLink,
    type: 'chunk',
    chunkType: 0,
    size: 8,
    encoding: null,
  });

  DataChunks.forEach((data, index) => {
    if (index >= config.dataCount) {
      return;
    }

    downloadChunks.push({
      ...data,
      type: 'chunk',
      chunkType: 1,
      size: 24,
      encoding: null,
    });
  });

  Events.forEach((data, index) => {
    if (index >= config.eventCount) {
      return;
    }

    downloadChunks.push({
      ...data,
      type: 'chunk',
      chunkType: 3,
      size: 35
        + Buffer.byteLength(data.Id, 'utf8')
        + Buffer.byteLength(data.Group, 'utf8')
        + Buffer.byteLength(data.Metadata || '', 'utf8'),
      encoding: null,
    });
  });

  Checkpoints.forEach((data, index) => {
    if (index >= config.checkpointCount) {
      return;
    }

    downloadChunks.push({
      ...data,
      type: 'chunk',
      chunkType: 2,
      size: 35
        + Buffer.byteLength(data.Id, 'utf8')
        + Buffer.byteLength(data.Group, 'utf8')
        + Buffer.byteLength(data.Metadata || '', 'utf8'),
      encoding: null,
    });
  });

  let dataDone = 0;
  let eventDone = 0;
  let checkpointDone = 0;
  let headerDone = 0;

  const onChunkDownloaded = (type) => {
    if (!updateCallback) {
      return;
    }

    switch (type) {
      case 0:
        headerDone += 1;

        break;
      case 1:
        dataDone += 1;

        break;
      case 2:
        checkpointDone += 1;

        break;
      case 3:
        eventDone += 1;

        break;
      default:
        break;
    }

    updateCallback({
      header: {
        current: headerDone,
        max: 1,
      },
      dataChunks: {
        current: dataDone,
        max: Math.min(DataChunks.length, config.dataCount),
      },
      eventChunks: {
        current: eventDone,
        max: Math.min(Events.length, config.eventCount),
      },
      checkpointChunks: {
        current: checkpointDone,
        max: Math.min(Checkpoints.length, config.checkpointCount),
      },
    });
  };

  return {
    config,
    downloadChunks,
    metaBuffer,
    onChunkDownloaded,
  };
};

const downloadReplay = async (inConfig) => {
  const {
    config,
    downloadChunks,
    metaBuffer,
    onChunkDownloaded,
  } = await prepareReplay(inConfig);
  const result = await handleDownload(
    downloadChunks,
    config.maxConcurrentDownloads,
    onChunkDownloaded,
    {
      debugCallback: config.debugCallback,
      httpClient: config.httpClient,
    },
  );

  return buildReplay([
    {
      type: 'meta',
      size: metaBuffer.length,
      data: metaBuffer,
    },
    ...result,
  ]);
};

const downloadReplayToFile = async (inConfig, outputFilePath) => {
  const {
    config,
    downloadChunks,
    metaBuffer,
    onChunkDownloaded,
  } = await prepareReplay(inConfig);
  const outputDirectory = path.dirname(outputFilePath);
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(outputDirectory, '.fortnite-replay-'),
  );
  const partialFilePath = path.join(
    outputDirectory,
    `.${path.basename(outputFilePath)}.${randomUUID()}.partial`,
  );

  try {
    const result = await handleDownloadToDirectory(
      downloadChunks,
      tempDirectory,
      config.maxConcurrentDownloads,
      onChunkDownloaded,
      {
        debugCallback: config.debugCallback,
        httpClient: config.httpClient,
      },
    );

    await buildReplayToFile(metaBuffer, result, partialFilePath);
    await fs.promises.rename(partialFilePath, outputFilePath);
  } finally {
    await Promise.all([
      fs.promises.rm(tempDirectory, { recursive: true, force: true }),
      fs.promises.rm(partialFilePath, { force: true }),
    ]);
  }
};

module.exports = {
  downloadReplay,
  downloadReplayToFile,
  downloadMetadata: downloadMetadataWrapper,
};
