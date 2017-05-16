const logContainer = document.getElementById("honkpad-log");
function log(text, style = "default"){
  const textEl = document.createElement("div");
  textEl.className = "honkpad-log-line " + style;
  textEl.textContent = text;
  logContainer.appendChild(textEl);
}

function clearLog(){
  while(logContainer.firstChild){
    logContainer.removeChild(logContainer.firstChild);
  }
}

const compileButton = document.getElementById("compile");
const runButton = document.getElementById("run");

function init(){
  fetch("firebase-config.json")
    .then(res => res.json())
    .then(config => {

      firebase.initializeApp(config);

      const firebaseRef = firebase.database().ref();

      const codemirror = CodeMirror(document.getElementById("firepad"), {
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        mode: "text/x-c++src"
      });

      const firepad = Firepad.fromCodeMirror(firebaseRef, codemirror, {
        defaultText: '#include <iostream>\nusing namespace std;\n\nint main(){\n\tcout << "Hello World!";\n}'
      });

    });

  const socket = io.connect(location.origin);
  socket.on("compiler:out", data => log(data));
  socket.on("compiler:error", data => log(data || "There was an error.", "warning"));
  socket.on("compiler:fail", data => log(data || "There was an error.", "error"));
  socket.on("compiler:success", data => log(data, "success"));

  socket.on("exec:out", data => log(data));
  socket.on("exec:error", data => log(data || "There was an error.", "warning"));
  socket.on("exec:fail", data => log(data || "There was an error.", "error"));
  socket.on("exec:success", data => log(data, "success"));

  compileButton.addEventListener("click", e => {
    socket.emit("compiler:compile");
  });
  runButton.addEventListener("click", e => {
    socket.emit("exec:execute");
  });
}
