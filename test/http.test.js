const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const downloadFileWithLink = require('../src/downloadFileWithLink');
const { getAgent } = require('../src/httpAgents');

const listen = async (handler) => {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
};

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

for (const httpClient of ['needle', 'fetch']) {
  test(`${httpClient} streams a chunk directly to a file`, async () => {
    const expected = Buffer.alloc(1024 * 1024, 0x5a);
    const server = await listen((request, response) => {
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': expected.length,
      });
      response.end(expected);
    });
    const tempDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'fortnite-http-test-'),
    );
    const destination = path.join(tempDirectory, `${httpClient}.bin`);
    const events = [];

    try {
      const address = server.address();
      const length = await downloadFileWithLink.toFile(
        `http://127.0.0.1:${address.port}/chunk.bin?signature=secret`,
        destination,
        null,
        {
          httpClient,
          chunkId: 'test-chunk',
          debugCallback: (event) => events.push(event),
        },
      );

      assert.equal(length, expected.length);
      assert.deepEqual(await fs.promises.readFile(destination), expected);
      assert.equal(events.some((event) => event.type === 'http_attempt_succeeded'), true);
      assert.equal(events.some((event) => event.url?.includes('signature')), false);
    } finally {
      await close(server);
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  });
}

for (const httpClient of ['needle', 'fetch']) {
  test(`${httpClient} can still return a Buffer`, async () => {
    const server = await listen((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      response.end('buffer-response');
    });

    try {
      const address = server.address();
      const data = await downloadFileWithLink(
        `http://127.0.0.1:${address.port}/buffer.bin`,
        null,
        { httpClient },
      );
      assert.equal(data.toString(), 'buffer-response');
    } finally {
      await close(server);
    }
  });
}

test('HTTP agents are reused by protocol', () => {
  const firstHttpAgent = getAgent('http://first.example/file');
  const secondHttpAgent = getAgent('http://second.example/file');
  const httpsAgent = getAgent('https://first.example/file');

  assert.equal(firstHttpAgent, secondHttpAgent);
  assert.notEqual(firstHttpAgent, httpsAgent);
  assert.equal(firstHttpAgent.keepAlive, true);
  assert.equal(firstHttpAgent.maxSockets, 20);
});

test('chunk retries are reported without exposing signed query parameters', async () => {
  let requestCount = 0;
  const server = await listen((request, response) => {
    requestCount += 1;

    if (requestCount < 3) {
      response.writeHead(503, { 'Content-Type': 'text/plain' });
      response.end('retry');
      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    response.end('complete');
  });
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'fortnite-retry-test-'),
  );
  const destination = path.join(tempDirectory, 'retry.bin');
  const events = [];

  try {
    const address = server.address();
    await downloadFileWithLink.toFile(
      `http://127.0.0.1:${address.port}/retry.bin?token=secret`,
      destination,
      null,
      { debugCallback: (event) => events.push(event) },
    );

    assert.equal(requestCount, 3);
    assert.equal(
      events.filter((event) => event.type === 'http_attempt_retrying').length,
      2,
    );
    assert.equal(
      events
        .filter((event) => event.type === 'http_attempt_retrying')
        .every((event) => event.statusCode === 503),
      true,
    );
    assert.equal(events.some((event) => event.url?.includes('secret')), false);
    assert.equal(await fs.promises.readFile(destination, 'utf8'), 'complete');
  } finally {
    await close(server);
    await fs.promises.rm(tempDirectory, { recursive: true, force: true });
  }
});
