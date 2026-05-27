const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Cloud Functions backend (Node + expo-server-sdk) must never enter the mobile bundle.
const cloudFunctionsBlockList = [
  /[/\\]functions[/\\]lib[/\\].*/,
  /[/\\]functions[/\\]src[/\\].*/,
  /[/\\]functions[/\\]node_modules[/\\].*/,
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList].filter(Boolean)),
  ...cloudFunctionsBlockList,
];

module.exports = config;
