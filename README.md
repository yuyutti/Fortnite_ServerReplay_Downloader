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
npm install fortnite-serverreplay-downloader  
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
        maxConcurrentDownloads: 10,
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

    fs.writeFileSync(savePath, buffer);
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
    updateCallback?: (progress) => void,
}) => Promise<string>
```

- Downloads and saves a .replay file
- Returns the saved file path

---

### downloadReplay(options)

```ts  
downloadReplay({
    matchId: string,
    maxConcurrentDownloads?: number,
    updateCallback?: (progress) => void,
}) => Promise<Buffer>
```

- Downloads a .replay file and returns it as a Buffer
- Does not save the file

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