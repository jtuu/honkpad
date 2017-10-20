const CPPLang = require("./CPPLang");
const JSLang = require("./JSLang");
const GoLang = require("./GoLang");

module.exports = {
  [CPPLang.name]: CPPLang,
  [JSLang.name]: JSLang,
  [GoLang.name]: GoLang
};
