global.window = {};
const fs = require("fs"),
      path = require("path"),
      child_process = require("child_process"),
      express = require("express"),
      app = express(),
      http = require("http").Server(app),
      io = require("socket.io")(http),
      firebaseConfig = require("./public/firebase-config.json"),
      firebase = require("firebase"),
      firepad = require("firepad"),
      distroName = child_process.execSync("lsb_release -si", {encoding: "utf8"}).trim().toLowerCase(),
      compilerName = "g++",
      dockerWorkDir = path.resolve("./docker"),
      sourceFilename = "hello.cpp",
      outFilename = "hello",
      compileOptions = ["-std=c++11", "-Wall", "-o" + outFilename],
      dockerOptions = ["run", "--name=" + distroName, `--volume=${dockerWorkDir}/${outFilename}:/${outFilename}`, "--rm=true", "--tty=true", distroName, "/" + outFilename],
      OK = 0;

app.use(express.static("public"));

firebase.initializeApp({databaseURL: firebaseConfig.databaseURL});
const firebaseRef = firebase.database().ref();
const firepadClient = new firepad.Headless(firebaseRef);

function getSourceFile(){
  return new Promise((resolve, reject) => {
    firepadClient.getText(text => {
      resolve(text);
    });
  });
}

function getCompilerInfo(){
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(compilerName, ["--version"]);
    proc.stderr.setEncoding("utf8");
    proc.stdout.setEncoding("utf8");

    function onOutput(data){
      const version = data.split("\n")[0];
      resolve(version);
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
  const proc = child_process.spawn(compilerName, compileOptions.concat([filename]), {cwd: dockerWorkDir});
  proc.stderr.setEncoding("utf8");
  proc.stdout.setEncoding("utf8");
  return proc;
}

function onCompileRequest(roomname){
  getSourceFile()
    .then(src => {
      fs.writeFile(path.resolve(`${dockerWorkDir}/${sourceFilename}`), src, err => {
        if(err){
          console.error(err);
          io.to(roomname).emit("compiler:fail");
          return;
        }

        const proc = compile(sourceFilename);
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
    });
}

function executeInContainer(){
  const proc = child_process.spawn("docker", dockerOptions, {cwd: dockerWorkDir});
  proc.stderr.setEncoding("utf8");
  proc.stdout.setEncoding("utf8");
  return proc;
}

function onExecuteRequest(roomname){
  const proc = executeInContainer();
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
      io.to(roomname).emit("exec:fail");
    }
  });
}

io.on("connect", socket => {
  var roomname = "default";
  socket.join("default");

  socket.on("meta:join", roomToJoin => {
    roomname = roomToJoin;
    socket.join(roomname);
  });

  socket.on("compiler:compile", () => onCompileRequest(roomname));
  socket.on("exec:execute", () => onExecuteRequest(roomname));
});

http.listen(3000);
getSourceFile();
