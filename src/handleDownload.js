// src/handleDownload.js

const pLimit = require("p-limit").default;
const downloadFileWithLink = require("./downloadFileWithLink");

const handleDownload = async (chunks, maxConcurrentDownloads, updateCallback) => {
    // ★ 元の順番を保持するため index を付与
    const indexedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        originalIndex: index,
    }));

    // ★ 大きい順 + 軽くランダム化（処理効率UP）
    const shuffledChunks = indexedChunks
        .sort((a, b) => b.size - a.size)
        .map((v) => ({ v, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map(({ v }) => v);

    const limit = pLimit(maxConcurrentDownloads || 3);
    const results = new Array(chunks.length);

    await Promise.all(
        shuffledChunks.map((chunk) =>
            limit(async () => {
                const startTime = Date.now();

                try {
                    // ★ encodingもちゃんと渡す（重要）
                    const data = await downloadFileWithLink(
                        chunk.DownloadLink,
                        chunk.encoding
                    );

                    const duration = Date.now() - startTime;

                    // ★ 元の順番で格納（これが最重要）
                    results[chunk.originalIndex] = {
                        ...chunk,
                        size: chunk.size + data.length,
                        data,
                        duration,
                    };

                    updateCallback(chunk.chunkType);
                } catch (err) {
                    throw err;
                }
            })
        )
    );

    return results;
};

module.exports = handleDownload;