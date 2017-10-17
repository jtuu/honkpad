const {spawn} = require("child_process");
const EventEmitter = require("events");

const CompilableMixin = Base => class Compilable extends Base{
  constructor(compilerName, ...args){
    super(...args);
    this.compilerName = compilerName;
    this.compiler = new EventEmitter();
    this.compilable = true;
  }

  compile(filename){
    const proc = spawn(
      this.compilerName,
      this.getCompilerOptions(filename),
      {
        cwd: this.workDir
      }
    );

    proc.unref();
    proc.stderr.setEncoding("utf8");
    proc.stdout.setEncoding("utf8");

    this.compiler.emit("start");
    proc.stdout.on("data", data => {
      this.compiler.emit("output", data);
    });
    proc.stderr.on("data", data => {
      this.compiler.emit("warning", data);
    });
    proc.on("error", err => {
      console.error(err);
      this.compiler.emit("exit", false);
      this.compiler.removeAllListeners();
    });
    proc.on("exit", (code, signal) => {
      this.compiler.emit("exit", code === 0);
      this.compiler.removeAllListeners();
    });
  }

  getCompilerOptions(filename){
    return [];
  }
}

module.exports = CompilableMixin;
