const app = require("./index");
const firepad = require("firepad");
const fs = require("fs");
const path = require("path");

module.exports = class Room{
  constructor(name, language, socketServer){
    this.name = name;
    this.language = language;
    this.socketServer = socketServer;
    this.firepadClient = new firepad.Headless(app.firebase.database().ref(this.name));
    this.userCount = 0;
    this.getSourceFile().then(sourceCode => sourceCode ? null : this.writeDefaultSourceFile());
  }

  get sourceFileName(){
    return `${this.name}.${this.language.fileExtension}`;
  }

  get executableFileName(){
    if(this.language.compilable){
      return this.name;
    }else{
      return this.sourceFileName;
    }
  }

  executableExists(){
    const filepath = `${this.language.workDir}/${this.executableFileName}`;
    return new Promise((resolve, reject) => {
      fs.access(filepath, err => err ? resolve(false) : resolve(true));
    });
  }

  saveSourceFile(fileContents){
    const filepath = `${this.language.workDir}/${this.sourceFileName}`;
    return new Promise((resolve, reject) => {
      fs.writeFile(path.resolve(filepath), fileContents, err => {
        if(err) reject(err);
        resolve(filepath);
      });
    });
  }

  getSourceFile(){
    return new Promise(resolve => this.firepadClient.getText(resolve));
  }

  writeDefaultSourceFile(){
    return new Promise(resolve => this.firepadClient.setText(this.language.constructor.defaultSourceCode));
  }

  // broadcast to everyone in this room through websocket
  broadcast(topic, msg){
    this.socketServer.to(this.name).emit(topic, msg);
  }

  async compile(){
    if(this.language.compilable){
      const sourceCode = await this.getSourceFile();
      await this.saveSourceFile(sourceCode);

      this.language.compiler.on("start", () => this.broadcast("compiler:begin"));
      this.language.compiler.on("output", data => this.broadcast("compiler:out", data));
      this.language.compiler.on("warning", data => this.broadcast("compiler:error", data));
      this.language.compiler.on("exit", success => {
        if(success){
          this.broadcast("compiler:success");
        }else{
          this.broadcast("compiler:fail");
        }
      });

      this.language.compile(this.sourceFileName);
    }else{
      console.warn(`Attempting to compile non-compilable language "${this.language.name}" in room "${this.name}".`);
    }
  }

  async execute(){
    if(this.language.executable){
      if(await this.executableExists()){

        this.language.runtime.on("start", () => this.broadcast("exec:begin"));
        this.language.runtime.on("output", data => this.broadcast("exec:out", data));
        this.language.runtime.on("warning", data => this.broadcast("exec:error", data));
        this.language.runtime.on("exit", success => {
          if(success){
            this.broadcast("exec:success");
          }else{
            this.broadcast("exec:fail");
          }
        });
        this.language.runtime.on("kill", () => this.broadcast("exec:timeout"));

        this.language.execute(this.executableFileName);
      }else{
        console.warn(`Attempting to execute non-existing file "${this.executableFileName}" in room "${this.name}".`);
      }
    }else{
      // no language is non-executable but let's just check this anyway
      console.warn(`Attempting to execute non-executable language "${this.language.name}" in room "${this.name}".`);
    }
  }
}
