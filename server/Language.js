const path = require("path");

module.exports = class Language{
  constructor(langName, fileExtension){
    this.name = langName;
    this.fileExtension = fileExtension; // don't include the dot
    this.workDir = path.resolve(__dirname + "/docker");
  }

  static get defaultSourceCode(){
    return "";
  }

  getInfo(){
    return this.name;
  }
}
