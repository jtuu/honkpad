const Language = require("./Language");
const ExecutableMixin = require("./Executable");
const CompilableMixin = require("./Compilable");

module.exports = class CompiledLanguage extends CompilableMixin(ExecutableMixin(Language)){
  constructor(...args){
    // compilerName, runtimeName, dockerImageName, langName, fileExtension
    super(...args);
  }
}
