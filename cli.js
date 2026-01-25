#!/usr/bin/env node

const path = require("path");
const { downloadReplay } = require("./index");

const [, , matchId, outputDir] = process.argv;

if (!matchId) {
    console.error("Usage: fortnite-serverreplay-downloader <matchId> [outputDir]");
    process.exit(1);
}

const cleanedMatchId = matchId.replace(/-/g, "");
if (cleanedMatchId.length !== 32) {
    console.error("Match ID must be 32 characters (hyphens allowed)");
    process.exit(1);
}

const saveDir =
    outputDir ||
    path.join(
        process.env.USERPROFILE || process.env.HOME,
        "Downloads",
        "replay-files"
    );

const savePath = path.join(
    saveDir,
    `TournamentMatch_${cleanedMatchId}.replay`
);

console.log("Downloading replay...");
console.log("Match ID:", cleanedMatchId);
console.log("Save to:", savePath);

downloadReplay({
    matchId: cleanedMatchId,
    outputPath: savePath,
    maxConcurrentDownloads: 10,
    updateCallback: (data) => {
        process.stdout.write(
            `\rData: ${data.dataChunks.current}/${data.dataChunks.max}`
        );
    },
})
.then(() => {
    console.log("\nDownload complete!");
})
.catch((err) => {
    console.error("\nDownload failed:", err);
    process.exit(1);
});