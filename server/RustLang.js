const CompiledLanguage = require("./CompiledLanguage");
const path = require("path");
const exec = require("./exec");

module.exports = class RustLang extends CompiledLanguage{
  constructor(){
    super("rustc", "", "honkpad-ubuntu", RustLang.name, "rs");
  }

  getCompilerOptions(filename){
    const outputName = path.basename(filename, "." + this.fileExtension); // remove extension
    return [filename];
  }

  async getInfo(){
    const compilerVersion = (await exec(`${this.compilerName} --version`)).split("\n")[0];
    const {DockerVersion, Architecture} = JSON.parse(await exec(`docker inspect ${this.dockerImageName}`))[0];
    const containerInfo = `${this.dockerImageName.charAt(0).toUpperCase() + this.dockerImageName.slice(1)} ${DockerVersion} (${Architecture})`;

    return `` +
      `Language: ${this.name}\n` +
      `Compiler: ${compilerVersion}\n` +
      `Running in ${containerInfo}`;
  }

  static get name(){
    return "Rust";
  }

  static get defaultSourceCode(){
    return "" +
      "fn main(){\n" +
      "  println!(\"Hello World!\");\n" +
      "}";
  }
}
