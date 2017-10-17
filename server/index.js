global.window = {};

const HonkpadServer = require("./HonkpadServer");

const app = new HonkpadServer();

module.exports = app;
