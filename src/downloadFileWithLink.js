// src/downloadFileWithLink.js

const needle = require("needle");
const http = require("http");
const https = require("https");

const UnsuccessfulRequestException = require("./UnsuccessfulRequestException");

const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 20,
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 20,
});

// ★ ここに追加
async function fetchWithRetry(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === retries - 1) throw e;

            await new Promise((r) => setTimeout(r, 300 * (i + 1)));
        }
    }
}

const downloadFileWithLink = async (link) => {
    const isHttps = link.startsWith("https");

    return fetchWithRetry(async () => {
        const data = await needle("get", link, {
            headers: {
                "User-Agent": "Tournament replay downloader",
            },
            agent: isHttps ? httpsAgent : httpAgent,
            response_timeout: 10000,
            read_timeout: 10000,
            open_timeout: 10000,
        });

        const { body, statusCode } = data;

        if (statusCode !== 200) {
            throw new UnsuccessfulRequestException(statusCode, body);
        }

        return body;
    });
};

module.exports = downloadFileWithLink;