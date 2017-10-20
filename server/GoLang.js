const CompiledLanguage = require("./CompiledLanguage");
const path = require("path");
const exec = require("./exec");

module.exports = class GoLang extends CompiledLanguage{
  constructor(){
    super("go", "", "honkpad-ubuntu", GoLang.name, "go");
  }

  getCompilerOptions(filename){
    return ["build", filename];
  }

  async getInfo(){
    const langVersion = (await exec(`${this.compilerName} version`)).slice(13).slice(0, -1);
    const {DockerVersion, Architecture} = JSON.parse(await exec(`docker inspect ${this.dockerImageName}`))[0];
    const containerInfo = `${this.dockerImageName.charAt(0).toUpperCase() + this.dockerImageName.slice(1)} ${DockerVersion} (${Architecture})`;

    return `` +
      `Language: ${this.name} ${langVersion}\n` +
      `Running in ${containerInfo}`;
  }

  static get name(){
    return "Go";
  }

  static get defaultSourceCode(){
    return "" +
      "package main\n" +
      "import \"fmt\"\n" +
      "\n" +
      "func main(){\n" +
      "  fmt.Println(\"Hello world!\")\n" +
      "}";
  }
}
