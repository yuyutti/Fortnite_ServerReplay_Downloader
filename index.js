// index.js
const fs = require("fs");
const path = require("path");
const { defaultMaxConcurrentDownloads } = require("./constants");
const {
    downloadReplay,
    downloadReplayToFile,
    downloadMetadata,
} = require("./core");

function normalizeMatchId(matchId) {
    return String(matchId || "").replace(/-/g, "");
}

async function ensureDir(dirPath) {
    await fs.promises.mkdir(dirPath, { recursive: true });
}

async function saveReplay({
    matchId,
    outputDir,
    maxConcurrentDownloads = defaultMaxConcurrentDownloads,
    updateCallback = () => {},
    debugCallback = () => {},
    httpClient = "needle",
    fileName,
    checkpointCount,
    dataCount,
    eventCount,
}) {
    const cleanedMatchId = normalizeMatchId(matchId);

    if (cleanedMatchId.length !== 32) {
        throw new Error("matchId must be 32 characters (hyphens allowed)");
    }
    if (!outputDir) {
        throw new Error("outputDir is required");
    }

    // 絶対パス化（OS差異を吸収）
    const resolvedOutputPath = path.resolve(outputDir);

    // outputDir がファイルパスかディレクトリかを判定
    const hasExtension = path.extname(resolvedOutputPath).length > 0;

    const outputDirectory = hasExtension
        ? path.dirname(resolvedOutputPath)
        : resolvedOutputPath;

    await ensureDir(outputDirectory);

    const outputFilePath = hasExtension
        ? resolvedOutputPath
        : path.join(
            outputDirectory,
            fileName || `TournamentMatch_${cleanedMatchId}.replay`
        );

    await downloadReplayToFile({
        matchId: cleanedMatchId,
        maxConcurrentDownloads,
        updateCallback,
        debugCallback,
        httpClient,
        checkpointCount,
        dataCount,
        eventCount,
    }, outputFilePath);

    return outputFilePath;
}

module.exports = {
    downloadReplay,
    downloadMetadata,
    saveReplay,
};
