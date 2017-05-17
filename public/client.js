const logContainer = document.getElementById("honkpad-log");
function log(text, style = "default"){
  const isScrolledToBottom = logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 1;

  const lineEl = document.createElement("div");
  const timeEl = document.createElement("div");
  const textEl = document.createElement("div");

  lineEl.className = "honkpad-log-line";

  timeEl.className = "honkpad-log-time";
  timeEl.textContent = `${Date().slice(16, 24)}`;

  textEl.className = "honkpad-log-text " + style;
  textEl.textContent = text;

  lineEl.appendChild(timeEl);
  lineEl.appendChild(textEl);
  logContainer.appendChild(lineEl);

  if(isScrolledToBottom){
    logContainer.scrollTop = logContainer.scrollHeight - logContainer.clientHeight;
  }
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

  const socket = io.connect(location.origin, {path: "/honkpad/socket.io"});
  socket.on("compiler:begin", data => {
    clearLog();
    log("Compiling...", "info");
  });
  socket.on("compiler:out", data => log(data));
  socket.on("compiler:error", data => log(data || "There was an error.", "warning"));
  socket.on("compiler:fail", data => log(data || "There was an error.", "error"));
  socket.on("compiler:success", data => log("Finished compiling successfully.", "success"));

  socket.on("exec:begin", data => log("Running...", "info"));
  socket.on("exec:out", data => log(data));
  socket.on("exec:error", data => log(data || "There was an error.", "warning"));
  socket.on("exec:fail", data => log(data || "There was an error.", "error"));
  socket.on("exec:success", data => log(data || "Finished running successfully.", "success"));

  compileButton.addEventListener("click", e => {
    socket.emit("compiler:compile");
  });
  runButton.addEventListener("click", e => {
    socket.emit("exec:execute");
  });
}
