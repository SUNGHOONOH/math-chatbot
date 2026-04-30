import type { CapacitorConfig } from '@capacitor/cli';

const { DEV_APP_URL } = require('./dev-app.config.cjs');

const config: CapacitorConfig = {
  appId: 'com.aha.v5',
  appName: 'AHA',
  webDir: 'capacitor-www',
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? DEV_APP_URL,
    cleartext: true,
  },
};

export default config;
