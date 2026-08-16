const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const buildMeta = require('../src/buildMeta');
const buildReplay = require('../src/buildReplay');
const buildReplayToFile = require('../src/buildReplayToFile');
const { downloadReplay } = require('../core');
const handleDownloadToDirectory = require('../src/handleDownloadToDirectory');
const Replay = require('../src/Replay');
const Size = require('../src/Size');
const sortChunksByFileSize = require('../src/sortChunksByFileSize');
const { defaultMaxConcurrentDownloads } = require('../constants');

test('default download concurrency is 16', () => {
  assert.equal(defaultMaxConcurrentDownloads, 16);
});

test('Size allocates a zero-filled buffer of the requested length', () => {
  const size = new Size();
  size.size = 16;

  assert.deepEqual(size.getBuffer(), Buffer.alloc(16));
});

test('Replay writes buffers in bulk and handles explicit offset zero', () => {
  const replay = new Replay(Buffer.alloc(8));

  replay.writeBytes(Buffer.from([1, 2, 3]), 0);
  assert.equal(replay.offset, 0);
  assert.deepEqual(replay.buffer.subarray(0, 3), Buffer.from([1, 2, 3]));

  replay.goTo(3);
  replay.writeBytes(Buffer.from([4, 5]));
  assert.equal(replay.offset, 5);
  assert.deepEqual(replay.buffer.subarray(0, 5), Buffer.from([1, 2, 3, 4, 5]));
});

test('Replay rejects writes beyond the destination buffer', () => {
  const replay = new Replay(Buffer.alloc(2));

  assert.throws(
    () => replay.writeBytes(Buffer.from([1, 2, 3])),
    /beyond the replay buffer/,
  );
});

test('chunk scheduling uses FileSize and keeps the input order intact', () => {
  const chunks = [
    { id: 'small', FileSize: 10 },
    { id: 'fallback', size: 20 },
    { id: 'large', FileSize: 30 },
  ];

  assert.deepEqual(
    sortChunksByFileSize(chunks).map((chunk) => chunk.id),
    ['large', 'fallback', 'small'],
  );
  assert.deepEqual(chunks.map((chunk) => chunk.id), ['small', 'fallback', 'large']);
});

test('download concurrency must be a positive integer', async () => {
  await assert.rejects(
    downloadReplay({ matchId: 'unused', maxConcurrentDownloads: Infinity }),
    /positive integer/,
  );
  await assert.rejects(
    downloadReplay({ matchId: 'unused', maxConcurrentDownloads: 0 }),
    /positive integer/,
  );
});

test('download HTTP client must be supported', async () => {
  await assert.rejects(
    downloadReplay({ matchId: 'unused', httpClient: 'unsupported' }),
    /httpClient must be either/,
  );
});

test('low-memory downloads persist chunks and retain only file references', async () => {
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'fortnite-download-test-'),
  );
  const started = [];
  const updated = [];
  const chunks = [
    { DownloadLink: 'small', FileSize: 1, size: 8, chunkType: 0 },
    { DownloadLink: 'large', FileSize: 2, size: 8, chunkType: 0 },
  ];

  try {
    const results = await handleDownloadToDirectory(
      chunks,
      tempDirectory,
      1,
      (chunkType) => updated.push(chunkType),
      {},
      async (link, destination) => {
        started.push(link);
        const data = Buffer.from(link);
        await fs.promises.writeFile(destination, data);
        return data.length;
      },
    );

    assert.deepEqual(started, ['large', 'small']);
    assert.deepEqual(updated, [0, 0]);
    assert.equal(results[0].data, undefined);
    assert.equal(results[1].data, undefined);
    assert.equal(
      await fs.promises.readFile(results[0].tempFilePath, 'utf8'),
      'small',
    );
    assert.equal(
      await fs.promises.readFile(results[1].tempFilePath, 'utf8'),
      'large',
    );
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true });
  }
});

test('file assembly matches Buffer assembly, including UTF-8 strings', async () => {
  const metaBuffer = buildMeta({
    FriendlyName: '大会テスト',
    LengthInMS: 1,
    NetworkVersion: 2,
    Timestamp: '2026-01-01T00:00:00Z',
    bIsLive: false,
    bCompressed: false,
  });
  const rawParts = [
    {
      type: 'chunk',
      chunkType: 0,
      size: 8,
      data: Buffer.from([1, 2, 3]),
    },
    {
      type: 'chunk',
      chunkType: 1,
      size: 24,
      Time1: 1,
      Time2: 2,
      SizeInBytes: 3,
      data: Buffer.from([4, 5, 6]),
    },
    {
      type: 'chunk',
      chunkType: 2,
      size: 35 + Buffer.byteLength('識別g情報', 'utf8'),
      Id: '識別',
      Group: 'g',
      Metadata: '情報',
      Time1: 3,
      Time2: 4,
      data: Buffer.from([7, 8]),
    },
  ].map((part) => ({ ...part, size: part.size + part.data.length }));
  const expected = buildReplay([
    { type: 'meta', size: metaBuffer.length, data: metaBuffer },
    ...rawParts,
  ]);
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'fortnite-replay-test-'),
  );
  const outputFilePath = path.join(tempDirectory, 'output.replay');

  try {
    const fileParts = [];

    for (let index = 0; index < rawParts.length; index += 1) {
      const { data, ...part } = rawParts[index];
      const tempFilePath = path.join(tempDirectory, `${index}.bin`);
      await fs.promises.writeFile(tempFilePath, data);
      fileParts.push({
        ...part,
        dataLength: data.length,
        tempFilePath,
      });
    }

    await buildReplayToFile(metaBuffer, fileParts, outputFilePath);
    assert.deepEqual(await fs.promises.readFile(outputFilePath), expected);
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true });
  }
});
