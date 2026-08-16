// src/getAccessToken.js

const needle = require('needle');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CACHE_PATH = path.join(
    os.tmpdir(),
    'fortnite-auth-cache.json'
);
const forceTokenValidation = process.env.FORTNITE_FORCE_TOKEN_VALIDATION === '1';

const {
    authClientId,
    authClientSecret,
    timeUntilNextCheck,
    tokenEndpoint,
    verifyEndpoint,
} = require('../constants');

const UnsuccessfulRequestException = require('./UnsuccessfulRequestException');
const { emitDebugEvent, getResponseDiagnostics, sanitizeUrl } = require('./debugEvent');
const { getAgent } = require('./httpAgents');

const options = {
    auth: 'basic',
    username: authClientId,
    password: authClientSecret,
    agent: getAgent(tokenEndpoint),
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
const writeTokenCache = async (cache) => {
    const tempPath = `${CACHE_PATH}.${process.pid}.${randomUUID()}.partial`;

    try {
        await fs.promises.writeFile(tempPath, JSON.stringify(cache));
        await fs.promises.rename(tempPath, CACHE_PATH);
    } finally {
        await fs.promises.rm(tempPath, { force: true });
    }
};

const checkToken = async (token, debugCallback) => {
    const lastCheck = lastTokenCheck[token];

    if (lastCheck && (Date.now() - lastCheck < timeUntilNextCheck * 1000)) {
        emitDebugEvent(debugCallback, {
            type: 'token_validation_skipped',
            reason: 'memory_validation_cache',
        });
        return true;
    }

    const startedAt = Date.now();
    const response = await needle(verifyEndpoint, {
        method: 'post',
        headers: {
            Authorization: token,
        },
        agent: getAgent(verifyEndpoint),
    });
    const { statusCode } = response;

    emitDebugEvent(debugCallback, {
        type: 'http_request_completed',
        client: 'needle',
        requestKind: 'token_validation',
        url: sanitizeUrl(verifyEndpoint),
        durationMs: Date.now() - startedAt,
        ...getResponseDiagnostics(response),
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
const getCachedToken = async (cache, debugCallback) => {
    if (!cache) return null;

    const expiresAt = new Date(cache.expires_at).getTime();
    if (expiresAt <= Date.now()) return null;

    const token = `${cache.token_type} ${cache.access_token}`;
    const verifiedAt = new Date(cache.verified_at).getTime();

    if (
        !forceTokenValidation
        && Number.isFinite(verifiedAt)
        && Date.now() - verifiedAt < timeUntilNextCheck * 1000
    ) {
        lastTokenCheck[token] = verifiedAt;
        emitDebugEvent(debugCallback, {
            type: 'token_validation_skipped',
            reason: 'file_validation_cache',
            verifiedAt: cache.verified_at,
        });
        return {
            token,
            tokenInfo: cache,
        };
    }

    const isValid = await checkToken(token, debugCallback);
    if (!isValid) return null;

    cache.verified_at = new Date().toISOString();
    await writeTokenCache(cache);

    return {
        token,
        tokenInfo: cache,
    };
};

// ===== 修正：fetchToken =====
const fetchToken = async (debugCallback) => {
    const startedAt = Date.now();
    const response = await needle('post', tokenEndpoint, body, options);
    const { body: tokenData, statusCode } = response;

    emitDebugEvent(debugCallback, {
        type: 'http_request_completed',
        client: 'needle',
        requestKind: 'token_fetch',
        url: sanitizeUrl(tokenEndpoint),
        durationMs: Date.now() - startedAt,
        ...getResponseDiagnostics(response),
    });

    if (statusCode !== 200 || tokenData.error) {
        throw new UnsuccessfulRequestException(statusCode, tokenData);
    }

    tokenData.verified_at = new Date().toISOString();
    await writeTokenCache(tokenData);

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
const getAccessToken = async (debugCallback) => {
    const now = Date.now();

    // ① メモリキャッシュ（最速）
    if (currentToken && now < tokenExpiresAt - 10_000) {
        emitDebugEvent(debugCallback, {
            type: 'token_cache_hit',
            source: 'memory',
        });
        return { token: currentToken };
    }

    // ② ロック（並列防止）
    if (tokenPromise) {
        return tokenPromise;
    }

    tokenPromise = (async () => {
        // ③ ファイルキャッシュ
        try {
            const cache = JSON.parse(await fs.promises.readFile(CACHE_PATH, 'utf8'));
            const cached = await getCachedToken(cache, debugCallback);

            if (cached) {
                currentToken = cached.token;
                tokenExpiresAt = new Date(cached.tokenInfo.expires_at).getTime();
                emitDebugEvent(debugCallback, {
                    type: 'token_cache_hit',
                    source: 'file',
                });
                return cached;
            }
        } catch (error) {
            if (error.code !== 'ENOENT' && error.name !== 'SyntaxError') {
                throw error;
            }
        }

        // ④ 新規取得
        return fetchToken(debugCallback);
    })();

    try {
        const result = await tokenPromise;
        return result;
    } finally {
        tokenPromise = null;
    }
};

module.exports = getAccessToken;
