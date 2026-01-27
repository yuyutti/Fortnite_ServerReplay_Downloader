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

const lastTokenCheck = {};

const checkToken = async (token) => {
  if (lastTokenCheck[token] < Date.now() + (timeUntilNextCheck * 1000)) {
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

const getCachedToken = async (cache) => {
  if (!cache) {
    return null;
  }

  const isExpired = new Date(cache.expires_at).getTime() <= Date.now();

  if (isExpired) {
    return null;
  }

  const isTokenValid = await checkToken(`${cache.token_type} ${cache.access_token}`);

  if (!isTokenValid) {
    return null;
  }

  return {
    token: `${cache.token_type} ${cache.access_token}`,
    tokenInfo: cache,
  };
};

const fetchToken = async () => {
  const { body: tokenData, statusCode } =
    await needle('post', tokenEndpoint, body, options);

  if (statusCode !== 200 || tokenData.error) {
    throw new UnsuccessfulRequestException(statusCode, tokenData);
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(tokenData));

  return {
    token: `${tokenData.token_type} ${tokenData.access_token}`,
    tokenInfo: tokenData,
  };
};

const getAccessToken = async () => {
  let cache = {};

  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH));

    const cachedToken = await getCachedToken(cache);
    if (cachedToken) {
      return cachedToken;
    }
  }

  return fetchToken();
};

module.exports = getAccessToken;
