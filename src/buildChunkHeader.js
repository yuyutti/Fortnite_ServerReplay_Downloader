// src/buildChunkHeader.js

const Replay = require('./Replay');

const buildChunkHeader = (part, dataLength) => {
  const headerLength = part.size - dataLength;
  const replay = new Replay(Buffer.alloc(headerLength));

  replay.writeInt32(part.chunkType);
  replay.writeInt32(part.size - 8);

  switch (part.chunkType) {
    case 0:
      break;

    case 1:
      replay.writeInt32(part.Time1);
      replay.writeInt32(part.Time2);
      replay.writeInt32(dataLength);
      replay.writeInt32(part.SizeInBytes);
      break;

    case 2:
    case 3:
      replay.writeString(part.Id);
      replay.writeString(part.Group);
      replay.writeString(part.Metadata || '');
      replay.writeInt32(part.Time1);
      replay.writeInt32(part.Time2);
      replay.writeInt32(dataLength);
      break;

    default:
      throw new Error(`Unsupported replay chunk type: ${part.chunkType}`);
  }

  if (replay.offset !== headerLength) {
    throw new Error(`Invalid chunk header size. Expected ${headerLength} bytes, wrote ${replay.offset}`);
  }

  return replay.buffer;
};

module.exports = buildChunkHeader;
