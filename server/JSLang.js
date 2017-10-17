const InterpretedLanguage = require("./InterpretedLanguage");
const exec = require("./exec");

module.exports = class JSLang extends InterpretedLanguage{
  constructor(){
    super("node", "honkpad-ubuntu", JSLang.name, "js");
  }

  async getInfo(){
    const runtimeInfo = `${this.runtimeName.charAt(0).toUpperCase() + this.runtimeName.slice(1)}` + (await exec(`${this.runtimeName} --version`));
    const {DockerVersion, Architecture} = JSON.parse(await exec(`docker inspect ${this.dockerImageName}`))[0];
    const containerInfo = `${this.dockerImageName.charAt(0).toUpperCase() + this.dockerImageName.slice(1)} ${DockerVersion} (${Architecture})`;

    return `` +
      `Language: ${this.name}\n` +
      `Runtime: ${runtimeInfo}\n` +
      `Running in ${containerInfo}`;
  }

  static get name(){
    return "JavaScript";
  }

  static get defaultSourceCode(){
    return "console.log(\"Hello world!\");"
  }
}
