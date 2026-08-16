#!/usr/bin/env node

// cli.js

const path = require("path");
const os = require("os");
const { saveReplay } = require("./index");
const { defaultMaxConcurrentDownloads } = require("./constants");

const [, , matchId, ...args] = process.argv;

if (!matchId) {
    console.error(
        "Usage: fortnite-serverreplay-downloader <matchId> [outputDir] "
        + "[--concurrency <number>] [--http-client <needle|fetch>]"
    );
    process.exit(1);
}

let outputArg;
let maxConcurrentDownloads = defaultMaxConcurrentDownloads;
let httpClient = "needle";

for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--concurrency" || argument === "-j") {
        maxConcurrentDownloads = Number(args[index + 1]);
        index += 1;
    } else if (argument.startsWith("--concurrency=")) {
        maxConcurrentDownloads = Number(argument.slice("--concurrency=".length));
    } else if (argument === "--http-client") {
        httpClient = args[index + 1];
        index += 1;
    } else if (argument.startsWith("--http-client=")) {
        httpClient = argument.slice("--http-client=".length);
    } else if (argument.startsWith("-")) {
        console.error("Unknown argument:", argument);
        process.exit(1);
    } else if (!outputArg) {
        outputArg = argument;
    } else {
        console.error("Unknown argument:", argument);
        process.exit(1);
    }
}

if (!Number.isInteger(maxConcurrentDownloads) || maxConcurrentDownloads < 1) {
    console.error("Concurrency must be a positive integer");
    process.exit(1);
}

if (!["needle", "fetch"].includes(httpClient)) {
    console.error("HTTP client must be either needle or fetch");
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
    maxConcurrentDownloads,
    httpClient,
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
