class DefaultMap extends Map{
  constructor(defaultVal, ...args){
    super(...args);
    this.defaultVal = defaultVal;
  }

  get(key){
    if(!this.has(key)){
      this.set(key, this.defaultVal);
    }
    return super.get(key);
  }
}

global.window = {};
const fs = require("fs"),
      path = require("path"),
      child_process = require("child_process"),
      express = require("express"),
      app = express(),
      socketio = require("socket.io"),
      firebaseConfig = require("./public/firebase-config.json"),
      firebaseCredentials = require("./firebase-credentials.json"),
      firebase = require("firebase-admin"),
      firepad = require("firepad"),
      distroName = "ubuntu",
      compilerName = "g++",
      compilerOptions = ["-std=c++11", "-Wall"],
      dockerWorkDir = path.resolve(__dirname + "/docker"),
      disallowedCharsRe = /[^A-Za-z0-9_-]/g,
      OK = 0,
      roomlist = new DefaultMap(0),
      firepadClients = new Map();
var io;

app.use(express.static(__dirname + "/public"));
firebase.initializeApp({
  credential: firebase.credential.cert(firebaseCredentials),
  databaseURL: firebaseConfig.databaseURL
});

function getSourceFile(roomname){
  return new Promise((resolve, reject) => {
    firepadClients.get(roomname).getText(text => resolve(text));
  });
}

function getCompilerInfo(){
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(compilerName, ["--version"]);
    proc.stderr.setEncoding("utf8");
    proc.stdout.setEncoding("utf8");

    function onOutput(data){
      const version = data.split("\n")[0];
      resolve(`${version}. Using options: ${compilerOptions.join(" ")}.`);
      proc.stdout.removeListener("data", onOutput);
      proc.stderr.removeListener("data", onError);
    }
    function onError(err){
      reject(err);
      proc.stdout.removeListener("data", onOutput);
      proc.stderr.removeListener("data", onError);
    }

    proc.stdout.on("data", onOutput);
    proc.stderr.on("data", onError);
  });
}

function compile(filename){
  const options = compilerOptions.concat(["-o" + filename, filename + ".cpp"]),
        proc = child_process.spawn(compilerName, options, {cwd: dockerWorkDir});
  proc.stderr.setEncoding("utf8");
  proc.stdout.setEncoding("utf8");
  return proc;
}

function onCompileRequest(roomname){
  getSourceFile(roomname)
    .then(src => {
      fs.writeFile(path.resolve(`${dockerWorkDir}/${roomname}.cpp`), src, err => {
        if(err){
          console.error(err);
          io.to(roomname).emit("compiler:fail");
          return;
        }

        const proc = compile(roomname);
        io.to(roomname).emit("compiler:begin");
        proc.stdout.on("data", data => {
          io.to(roomname).emit("compiler:out", data);
        });
        proc.stderr.on("data", data => {
          io.to(roomname).emit("compiler:error", data);
        });
        proc.on("error", err => {
          console.error(err);
          io.to(roomname).emit("compiler:fail");
        });
        proc.on("close", code => {
          if(code === OK){
            io.to(roomname).emit("compiler:success");
          }else{
            io.to(roomname).emit("compiler:fail");
          }
        });
      });
    })
    .catch(err => {
      console.error(err);
    });
}

function executeInContainer(filename){
  const options = ["run", "--name=" + distroName, `--volume=${dockerWorkDir}/${filename}:/${filename}`, "--rm=true", "--tty=true", distroName, "/" + filename],
        proc = child_process.spawn("docker", options, {
          cwd: dockerWorkDir,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
  proc.stderr.setEncoding("utf8");

  var isAlive = true;
  proc.on("exit", () => isAlive = false);
  setTimeout(() => {
    if(isAlive) proc.kill();
    child_process.spawn("docker", ["kill", distroName]).on("exit", () => {
      child_process.spawn("docker", ["rm", distroName]);
    });

  }, 30 * 1000);

  return proc;
}

function onExecuteRequest(roomname){
  const proc = executeInContainer(roomname);
  proc.unref();

  io.to(roomname).emit("exec:begin");
  proc.stdout.on("data", data => {
    io.to(roomname).emit("exec:out", data);
  });
  proc.stderr.on("data", data => {
    io.to(roomname).emit("exec:error", data);
  });
  proc.on("error", err => {
    console.error(err);
    io.to(roomname).emit("exec:fail");
  });
  proc.on("close", code => {
    if(code === OK){
      io.to(roomname).emit("exec:success");
    }else{
      io.to(roomname).emit("exec:fail", code);
    }
  });
}

function modifyUserCount(roomname, val){
  const curCount = roomlist.get(roomname);
  const newCount = curCount + val;
  roomlist.set(roomname, newCount);

  if(curCount < 1 && newCount > 0 && !firepadClients.has(roomname)){
    const firebaseRef = firebase.database().ref(roomname);
    const firepadClient = new firepad.Headless(firebaseRef);
    firepadClients.set(roomname, firepadClient);
    getSourceFile(roomname).then(src => {})
  }else if(newCount < 1){
    firepadClients.get(roomname).dispose();
    firepadClients.delete(roomname);
  }
}

module.exports = function init(server){

  if(!io){
    io = socketio(server, {path: "/honkpad/socket.io"});
    io.on("connect", socket => {
      var roomname;

      socket.on("meta:join", roomToJoin => {
        if(typeof roomToJoin === "string"){
          const newRoomname = roomToJoin.replace(disallowedCharsRe, "");
          if(newRoomname){
            if(roomname){
              socket.leave(roomname);
              modifyUserCount(roomname, -1);
            }
            roomname = newRoomname;
            socket.join(roomname);
            modifyUserCount(roomname, 1);
          }
        }
      });

      socket.on("compiler:compile", () => onCompileRequest(roomname));
      socket.on("exec:execute", () => onExecuteRequest(roomname));

      socket.on("meta:about", () => {
        getCompilerInfo().then(compilerInfo => {
          socket.emit("meta:about", `Compiler: ${compilerInfo}`);
        });
      });

      socket.on("disconnect", () => {
        if(roomname){
          modifyUserCount(roomname, -1);
        }
      });
    });
  }
  return app;
}
