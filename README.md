## 🌐 Language

- [English](./README.md)
- [日本語](./README.ja.md)

# Fortnite Server Replay Downloader

A Node.js library / CLI tool to download **Fortnite server replay (.replay)** files  
directly from Epic Games servers.

---

## Features

- ✅ Download Fortnite server replays directly
- ✅ Supports Windows / Linux / macOS
- ✅ Usable as both CLI and library
- ✅ Save .replay files directly or obtain them as Buffer
- ✅ Progress callback support

---

## Installation

### npm (as a library)

```bash  
npm install fortnite-serverreplay-downloader@latest  
```

### npx (as a CLI)

```bash  
npx fortnite-serverreplay-downloader <matchId>  
```

---

## Usage (CLI)

### Basic

```bash  
npx fortnite-serverreplay-downloader <matchId>  
```

- Default save directory  
  - ~/Downloads/replay-files/

### Specify output directory

```bash  
npx fortnite-serverreplay-downloader <matchId> ./replays  
```

The default concurrency is `16`. You can tune it for your connection and CDN conditions.

```bash
npx fortnite-serverreplay-downloader <matchId> ./replays --concurrency 6
```

Chunk downloads use `needle` by default. You can compare it with Node.js built-in `fetch`.

```bash
npx fortnite-serverreplay-downloader <matchId> ./replays --http-client fetch
```

### Global installation

```bash  
npm install -g fortnite-serverreplay-downloader  
fortnite-serverreplay-downloader <matchId>  
```

---

## Usage (Library)

### Save .replay file (recommended)

```js  
const { saveReplay } = require("fortnite-serverreplay-downloader");

(async () => {
    const filePath = await saveReplay({
        matchId: "39610d978fe442ecb8729e24592f868a",
        outputDir: "./replays",
        maxConcurrentDownloads: 16,
    });

    console.log("Saved:", filePath);
})();
```

---

### Show download progress

```js  
const { saveReplay } = require("fortnite-serverreplay-downloader");

await saveReplay({
    matchId: "39610d978fe442ecb8729e24592f868a",
    outputDir: "./replays",
    updateCallback: (data) => {
        process.stdout.write(
            `Data ${data.dataChunks.current}/${data.dataChunks.max}`
        );
    },
});

console.log("Download complete");
```

---

### Get .replay as Buffer (advanced usage)

```js  
const fs = require("fs");
const path = require("path");
const { downloadReplay } = require("fortnite-serverreplay-downloader");

(async () => {
    const buffer = await downloadReplay({
        matchId: "39610d978fe442ecb8729e24592f868a",
    });

    fs.mkdirSync("./replays", { recursive: true });

    const savePath = path.join(
        "./replays",
        "TournamentMatch.replay"
    );

    await fs.promises.writeFile(savePath, buffer);
})();
```

---

## API

### saveReplay(options)

```ts  
saveReplay({
    matchId: string,
    outputDir: string,
    maxConcurrentDownloads?: number,
    httpClient?: "needle" | "fetch",
    updateCallback?: (progress) => void,
    debugCallback?: (event) => void,
    fileName?: string,
    checkpointCount?: number,
    dataCount?: number,
    eventCount?: number,
}) => Promise<string>
```

- Downloads and saves a .replay file
- Streams HTTP responses directly to temporary files instead of retaining every chunk in memory
- `maxConcurrentDownloads` defaults to `16` and must be a positive integer
- `httpClient` defaults to `needle`; `fetch` is available for comparison
- `debugCallback` reports HTTP versions, durations, retries, and errors
- Returns the saved file path

---

### downloadReplay(options)

```ts  
downloadReplay({
    matchId: string,
    maxConcurrentDownloads?: number,
    httpClient?: "needle" | "fetch",
    updateCallback?: (progress) => void,
    debugCallback?: (event) => void,
}) => Promise<Buffer>
```

- Downloads a .replay file and returns it as a Buffer
- `maxConcurrentDownloads` defaults to `16` and must be a positive integer
- Does not save the file

Signed query parameters and other URL search parameters are removed from HTTP debug events.

---

## About matchId

- Hyphenated or non-hyphenated formats are both supported
- Internally normalized
- Must be **32 characters** after normalization

Example:

39610d97-8fe4-42ec-b872-9e24592f868a

---

## Important Notes

- This tool can only download server replays for:
  - **Tournament mode match IDs**, or
  - **Event (competition) match IDs**
- Normal Squads / Duos / Solos / Ranked matches are **not supported**,  
  even if a match ID exists, because server replays are not stored.
- **Tournament custom matches** are supported.
- **Non-tournament custom matches** are not supported.

---

## Replay Retention Period

- Epic Games enforces a **server replay retention period**.
- In general, only matches from **within the last 1–2 weeks** can be downloaded.
- Due to Fortnite updates or server-side changes,  
  server replays may be **deleted (wiped) without notice**, even within the retention period.

---

## Disclaimer

- Fortnite updates may change or break the behavior of this tool.
- The developer assumes **no responsibility** for any issues caused by using this tool.
- This is an **unofficial tool**, not affiliated with Epic Games or Fortnite.

---

## Fork Lineage

This project is developed based on the following fork tree:

- Original repository  
  [https://github.com/xNocken/replay-downloader](https://github.com/xNocken/replay-downloader)
- Fork  
  [https://github.com/qKuafn/replay-downloader](https://github.com/qKuafn/replay-downloader)
- Further fork  
  [https://github.com/yuyutti/replay-downloader](https://github.com/yuyutti/replay-downloader)
- Reorganized and published for npm  
  [https://github.com/yuyutti/Fortnite_ServerReplay_Downloader](https://github.com/yuyutti/Fortnite_ServerReplay_Downloader)

---

## License

MIT License

---

## Author

- GitHub: [https://github.com/yuyutti](https://github.com/yuyutti)  
- Inspired by: [https://github.com/xNocken/replay-downloader](https://github.com/xNocken/replay-downloader)
