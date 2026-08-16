// src/sortChunksByFileSize.js

const sortChunksByFileSize = (chunks) => [...chunks].sort(
  (a, b) => (b.FileSize ?? b.size ?? 0) - (a.FileSize ?? a.size ?? 0),
);

module.exports = sortChunksByFileSize;
