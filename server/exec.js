const child_process = require("child_process");

module.exports = function exec(cmd){
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, (err, stdout, stderr) => {
      if(err) reject(err);
      resolve(stdout);
    });
  });
}
