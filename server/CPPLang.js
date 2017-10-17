const CompiledLanguage = require("./CompiledLanguage");
const path = require("path");
const exec = require("./exec");

module.exports = class CPPLang extends CompiledLanguage{
  constructor(){
    super("g++", "", "ubuntu", CPPLang.name, "cpp");
  }

  getCompilerOptions(filename){
    const outputName = path.basename(filename, "." + this.fileExtension); // remove extension
    return ["-std=c++11", "-Wall", `-o${outputName}`, filename];
  }

  async getInfo(){
    const compilerVersion = (await exec(`${this.compilerName} --version`)).split("\n")[0];
    const compilerOpts = this.getCompilerOptions("filename." + this.fileExtension).slice(0, -1);
    const dockerInfo = JSON.parse(await exec(`docker inspect ${this.dockerImageName}`))[0];
    const runtimeInfo = `${this.dockerImageName.charAt(0).toUpperCase() + this.dockerImageName.slice(1)} ${dockerInfo.DockerVersion} (${dockerInfo.Architecture})`;

    return `` +
      `Language: ${this.name}\n` +
      `Compiler: ${compilerVersion} using flags ${compilerOpts}\n` +
      `Running in ${runtimeInfo}`;
  }

  static get name(){
    return "C++";
  }

  static get defaultSourceCode(){
    return "" +
      "#include <iostream>\n" +
      "\n" +
      "int main(){\n" +
      "  std::cout << \"Hello World!\" << std::endl;\n" +
      "}";
  }
}
