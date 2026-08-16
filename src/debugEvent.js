// src/debugEvent.js

const emitDebugEvent = (callback, event) => {
  if (typeof callback !== 'function') {
    return;
  }

  try {
    callback({
      timestamp: new Date().toISOString(),
      ...event,
    });
  } catch {
    // Debug callbacks must never interrupt a download.
  }
};

const sanitizeUrl = (value) => {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
};

const getResponseDiagnostics = (response) => ({
  statusCode: response?.statusCode ?? response?.status ?? null,
  httpVersion: response?.httpVersion || null,
  alpnProtocol: response?.socket?.alpnProtocol || null,
  remoteAddress: response?.socket?.remoteAddress || null,
});

module.exports = {
  emitDebugEvent,
  getResponseDiagnostics,
  sanitizeUrl,
};
