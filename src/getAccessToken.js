// src/getAccessToken.js

const needle = require('needle');
const os = require('os');
const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(
    os.tmpdir(),
    'fortnite-auth-cache.json'
);

const {
    authClientId,
    authClientSecret,
    timeUntilNextCheck,
    tokenEndpoint,
    verifyEndpoint,
} = require('../constants');

const UnsuccessfulRequestException = require('./UnsuccessfulRequestException');

const options = {
    auth: 'basic',
    username: authClientId,
    password: authClientSecret,
};

const body = {
    grant_type: 'client_credentials',
    token_type: 'eg1',
};

// ===== 追加：メモリキャッシュ & ロック =====
let currentToken = null;
let tokenExpiresAt = 0;
let tokenPromise = null;

// token検証キャッシュ
const lastTokenCheck = {};

// ===== 修正：checkToken =====
const checkToken = async (token) => {
    const lastCheck = lastTokenCheck[token];

    if (lastCheck && (Date.now() - lastCheck < timeUntilNextCheck * 1000)) {
        return true;
    }

    const { statusCode } = await needle(verifyEndpoint, {
        method: 'post',
        headers: {
            Authorization: token,
        },
    });

    const isValid = statusCode === 200;

    if (!isValid) {
        delete lastTokenCheck[token];
    } else {
        lastTokenCheck[token] = Date.now();
    }

    return isValid;
};

// ===== 修正：キャッシュ取得 =====
const getCachedToken = async (cache) => {
    if (!cache) return null;

    const expiresAt = new Date(cache.expires_at).getTime();
    if (expiresAt <= Date.now()) return null;

    const token = `${cache.token_type} ${cache.access_token}`;

    const isValid = await checkToken(token);
    if (!isValid) return null;

    return {
        token,
        tokenInfo: cache,
    };
};

// ===== 修正：fetchToken =====
const fetchToken = async () => {
    const { body: tokenData, statusCode } =
        await needle('post', tokenEndpoint, body, options);

    if (statusCode !== 200 || tokenData.error) {
        throw new UnsuccessfulRequestException(statusCode, tokenData);
    }

    fs.writeFileSync(CACHE_PATH, JSON.stringify(tokenData));

    const token = `${tokenData.token_type} ${tokenData.access_token}`;
    const expiresAt = new Date(tokenData.expires_at).getTime();

    currentToken = token;
    tokenExpiresAt = expiresAt;

    return {
        token,
        tokenInfo: tokenData,
    };
};

// ===== メイン =====
const getAccessToken = async () => {
    const now = Date.now();

    // ① メモリキャッシュ（最速）
    if (currentToken && now < tokenExpiresAt - 10_000) {
        return { token: currentToken };
    }

    // ② ロック（並列防止）
    if (tokenPromise) {
        return tokenPromise;
    }

    tokenPromise = (async () => {
        // ③ ファイルキャッシュ
        if (fs.existsSync(CACHE_PATH)) {
            try {
                const cache = JSON.parse(fs.readFileSync(CACHE_PATH));
                const cached = await getCachedToken(cache);

                if (cached) {
                    currentToken = cached.token;
                    tokenExpiresAt = new Date(cached.tokenInfo.expires_at).getTime();
                    return cached;
                }
            } catch {
                // 壊れてたら無視
            }
        }

        // ④ 新規取得
        return fetchToken();
    })();

    try {
        const result = await tokenPromise;
        return result;
    } finally {
        tokenPromise = null;
    }
};

module.exports = getAccessToken;