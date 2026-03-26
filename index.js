// index.js
const fs = require("fs");
const path = require("path");
const { downloadReplay, downloadMetadata } = require("./core");

function normalizeMatchId(matchId) {
    return String(matchId || "").replace(/-/g, "");
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

async function saveReplay({
    matchId,
    outputDir,
    maxConcurrentDownloads = Infinity,
    updateCallback = () => {},
    fileName,
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

    ensureDir(outputDirectory);

    const outputFilePath = hasExtension
        ? resolvedOutputPath
        : path.join(
            outputDirectory,
            fileName || `TournamentMatch_${cleanedMatchId}.replay`
        );

    const buffer = await downloadReplay({
        matchId: cleanedMatchId,
        maxConcurrentDownloads,
        updateCallback,
    });

    fs.writeFileSync(outputFilePath, buffer);
    return outputFilePath;
}

module.exports = {
    downloadReplay,
    downloadMetadata,
    saveReplay,
};