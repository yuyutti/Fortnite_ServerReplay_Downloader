// src/handleDownload.js

const pLimit = require("p-limit").default;
const downloadFileWithLink = require("./downloadFileWithLink");

const handleDownload = async (chunks, maxConcurrentDownloads, updateCallback) => {
    // ★ 大きい順 + 軽くランダム化（偏り防止）
    chunks.sort((a, b) => b.size - a.size);
    chunks = chunks
        .map((v) => ({ v, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map(({ v }) => v);

    const limit = pLimit(maxConcurrentDownloads || 6);
    let active = 0;

    const results = new Array(chunks.length);

    await Promise.all(
        chunks.map((chunk, index) =>
            limit(async () => {
                const startTime = Date.now();

                active++;

                try {
                    // ★ retryはdownloadFileWithLink側に任せる
                    const data = await downloadFileWithLink(chunk.DownloadLink);

                    const duration = Date.now() - startTime;
                    updateCallback(chunk.chunkType);

                    results[index] = {
                        ...chunk,
                        size: chunk.size + data.length,
                        data,
                        duration,
                    };
                } finally {
                    active--;
                }
            })
        )
    );

    return results;
};

module.exports = handleDownload;