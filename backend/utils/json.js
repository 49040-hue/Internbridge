function parseJson(value, fallback) {
  if (value === null || typeof value === 'undefined') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (err) {
      return fallback;
    }
  }
  return value;
}

module.exports = { parseJson };
