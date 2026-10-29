function getAppUrl() {
  const configuredUrl = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    process.env.BASE_URL,
    process.env.RENDER_EXTERNAL_URL,
    'http://localhost:3000',
  ].find(value => typeof value === 'string' && value.trim());

  return configuredUrl.trim().replace(/\/+$/, '');
}

module.exports = { getAppUrl };
