/**
 * Expo resolves this over static app.json fields when present.
 * Marketing version always follows package.json (Changesets source of truth).
 */
const packageJson = require("./package.json");

/** @type {import('expo/config').ConfigContext['config']} */
module.exports = ({ config }) => ({
  ...config,
  version: packageJson.version,
});
