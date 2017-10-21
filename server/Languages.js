const CPPLang = require("./CPPLang");
const JSLang = require("./JSLang");
const GoLang = require("./GoLang");
const RustLang = require("./RustLang");

module.exports = {
  [CPPLang.name]: CPPLang,
  [JSLang.name]: JSLang,
  [GoLang.name]: GoLang,
  [RustLang.name]: RustLang
};
