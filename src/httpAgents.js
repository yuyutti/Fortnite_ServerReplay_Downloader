// src/httpAgents.js

const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 20,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 20,
});

const getAgent = (url) => (
  new URL(url).protocol === 'https:' ? httpsAgent : httpAgent
);

module.exports = {
  getAgent,
  httpAgent,
  httpsAgent,
};
