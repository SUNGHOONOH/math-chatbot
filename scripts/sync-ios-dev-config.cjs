const fs = require('node:fs');
const path = require('node:path');

const { DEV_APP_URL } = require('../dev-app.config.cjs');

const configPath = path.join(__dirname, '..', 'ios', 'App', 'App', 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

config.server = {
  ...(config.server ?? {}),
  url: process.env.CAPACITOR_SERVER_URL ?? DEV_APP_URL,
  cleartext: true,
};

fs.writeFileSync(configPath, `${JSON.stringify(config, null, '\t')}\n`);
console.log(`[sync-ios-dev-config] iOS Capacitor server URL: ${config.server.url}`);
