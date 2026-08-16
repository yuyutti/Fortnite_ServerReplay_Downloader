// src/handleDownload.js

const pLimit = require("p-limit").default;
const downloadFileWithLink = require("./downloadFileWithLink");
const sortChunksByFileSize = require("./sortChunksByFileSize");

const handleDownload = async (
    chunks,
    maxConcurrentDownloads,
    updateCallback,
    requestOptions = {}
) => {
    // ★ 元の順番を保持するため index を付与
    const indexedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        originalIndex: index,
    }));

    // 大きいファイルから開始し、最後に巨大な1件だけが残る状況を減らす
    const sortedChunks = sortChunksByFileSize(indexedChunks);

    const limit = pLimit(maxConcurrentDownloads);
    const results = new Array(chunks.length);

    await Promise.all(
        sortedChunks.map((chunk) =>
            limit(async () => {
                const startTime = Date.now();

                try {
                    // ★ encodingもちゃんと渡す（重要）
                    const data = await downloadFileWithLink(
                        chunk.DownloadLink,
                        chunk.encoding,
                        {
                            ...requestOptions,
                            chunkId: chunk.Id || (chunk.chunkType === 0 ? 'header' : null),
                            chunkType: chunk.chunkType,
                        }
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
