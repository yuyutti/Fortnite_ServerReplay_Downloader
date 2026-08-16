// src/buildReplayToFile.js

const fs = require('fs');

const buildChunkHeader = require('./buildChunkHeader');

const writeAll = async (fileHandle, buffer, startPosition) => {
  let offset = 0;

  while (offset < buffer.length) {
    const { bytesWritten } = await fileHandle.write(
      buffer,
      offset,
      buffer.length - offset,
      startPosition + offset,
    );

    if (bytesWritten === 0) {
      throw new Error('Unable to make progress while writing replay file');
    }

    offset += bytesWritten;
  }

  return offset;
};

const buildReplayToFile = async (metaBuffer, parts, outputFilePath) => {
  const output = await fs.promises.open(outputFilePath, 'w');
  let position = 0;

  try {
    position += await writeAll(output, metaBuffer, position);

    for (const part of parts) {
      const header = buildChunkHeader(part, part.dataLength);
      position += await writeAll(output, header, position);

      const input = fs.createReadStream(part.tempFilePath);

      for await (const data of input) {
        position += await writeAll(output, data, position);
      }
    }

    const expectedSize = metaBuffer.length
      + parts.reduce((total, part) => total + part.size, 0);

    if (position !== expectedSize) {
      throw new Error(`Invalid replay file size. Expected ${expectedSize} bytes, wrote ${position}`);
    }
  } finally {
    await output.close();
  }
};

module.exports = buildReplayToFile;
