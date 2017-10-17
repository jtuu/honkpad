const {spawn} = require("child_process");
const fs = require("fs");
const EventEmitter = require("events");
const uuid = require("uuid");

const ExecutableMixin = Base => class Executable extends Base{
  constructor(runtimeName, dockerImageName, ...args){
    super(...args);
    this.runtimeName = runtimeName;
    this.dockerImageName = dockerImageName;
    this.runtime = new EventEmitter();
    this.timeout = 30 * 1000;
    this.timeoutId = null;
    this.kill = this.kill.bind(this);
    this.executable = true;
  }

  kill(){
    if(this.timeoutId){
      clearTimeout(this.timeoutId);
    }
    this.runtime.emit("kill");
  }

  resetTimeout(){
    if(this.timeoutId){
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(this.kill, this.timeout);
  }

  setExecutablePermissions(filename){
    const filepath = `${this.workDir}/${filename}`;
    return new Promise((resolve, reject) => {
      fs.chmod(filepath, parseInt(700, 8), err => err ? reject(err) : resolve());
    });
  }

  async execute(filename){
    await this.setExecutablePermissions(filename);
    const dockerName = uuid();
    const proc = spawn(
      "docker",
      this.getDockerOptions(filename, dockerName),
      {
        cwd: this.workDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    proc.unref();
    proc.stderr.setEncoding("utf8");

    this.runtime.emit("start");
    proc.stdout.on("data", data => {
      this.runtime.emit("output", data);
    });
    proc.stderr.on("data", data => {
      this.runtime.emit("warning", data);
    });
    proc.on("error", err => {
      console.error(err);
      this.runtime.emit("exit", false);
      this.runtime.removeAllListeners();
    });
    proc.on("close", (code, signal) => {
      this.runtime.emit("exit", code === 0);
      this.runtime.removeAllListeners();
    });

    var isAlive = true;
    proc.on("exit", () => isAlive = false);
    const kill = () => {
      if(isAlive) proc.kill("SIGKILL");
      spawn("docker", ["kill", dockerName]).on("exit", () => {
        spawn("docker", ["rm", dockerName]).on("exit", () => {
          this.runtime.removeAllListeners();
        });
      });
    }
    this.runtime.on("kill", kill);
    this.resetTimeout();
  }

  getDockerOptions(filename, containerName){
    const filepath = `${this.workDir}/${filename}`;
    return [
      "run",
      this.runtimeName ? `--volume=/usr/bin/${this.runtimeName}:/usr/bin/${this.runtimeName}` : "", // mount runtime binary if any
      `--volume=${filepath}:/tmp/${filename}`, // mount executable
      "--rm=true",
      "--tty=true",
      `--name=${containerName}`,
      this.dockerImageName,
      this.runtimeName,
      `/tmp/${filename}`
    ].filter(Boolean);
  }

}

module.exports = ExecutableMixin;
