const Language = require("./Language");
const ExecutableMixin = require("./Executable");

module.exports = class InterpretedLanguage extends ExecutableMixin(Language){
  constructor(...args){
    super(...args);
  }
}
