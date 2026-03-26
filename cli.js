#!/usr/bin/env node

// cli.js

const path = require("path");
const os = require("os");
const { saveReplay } = require("./index");

const [, , matchId, outputArg] = process.argv;

if (!matchId) {
    console.error("Usage: fortnite-serverreplay-downloader <matchId> [outputDir]");
    process.exit(1);
}

// OS標準のホームディレクトリ取得
const homeDir = os.homedir();

// デフォルト保存先を OS 非依存で構築
const defaultSaveDir = path.join(
    homeDir,
    "Downloads",
    "replay-files"
);

// ユーザー指定があればそれを使う
const savePath = outputArg
    ? path.resolve(outputArg)
    : defaultSaveDir;

console.log("Downloading replay...");
console.log("Match ID:", matchId);
console.log("Save path:", savePath);

saveReplay({
    matchId,
    outputDir: savePath,
    maxConcurrentDownloads: 6,
    updateCallback: (data) => {
        process.stdout.write(
            `\rData: ${data.dataChunks.current}/${data.dataChunks.max}`
        );
    },
})
    .then((filePath) => {
        console.log("\nDownload complete!");
        console.log("Saved to:", filePath);
    })
    .catch((err) => {
        console.error("\nDownload failed:", err?.message || err);
        process.exit(1);
    });