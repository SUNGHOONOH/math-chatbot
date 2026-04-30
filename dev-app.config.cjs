const DEV_APP_HOST = process.env.DEV_APP_HOST || '192.168.123.107';
const DEV_APP_PORT = process.env.DEV_APP_PORT || '3000';
const DEV_APP_ORIGIN = `http://${DEV_APP_HOST}:${DEV_APP_PORT}`;
const DEV_APP_URL = `${DEV_APP_ORIGIN}/app`;
const DEV_APP_ALLOWED_ORIGINS = [
  DEV_APP_HOST,
  DEV_APP_ORIGIN,
  'localhost',
  `http://localhost:${DEV_APP_PORT}`,
  '127.0.0.1',
  `http://127.0.0.1:${DEV_APP_PORT}`,
].filter(Boolean);

module.exports = {
  DEV_APP_HOST,
  DEV_APP_PORT,
  DEV_APP_ORIGIN,
  DEV_APP_URL,
  DEV_APP_ALLOWED_ORIGINS,
};
