const logContainer = document.getElementById("honkpad-log"),
      roomlist = new Set(),
      roomlistContainer = document.getElementById("honkpad-roomlist-container"),
      createRoomButton = document.getElementById("honkpad-roomlist-createbutton"),
      compileButton = document.getElementById("compile"),
      runButton = document.getElementById("run"),
      codemirror = CodeMirror(document.getElementById("firepad"), {
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        mode: "text/x-c++src",
        lineWrapping: true
      }),
      decoder = new TextDecoder(),
      newline = /\r\n|\n/,
      socket = io.connect(location.origin, {path: "/honkpad/socket.io"});

var firepad, currentRoom;

socket.on("compiler:begin", data => {
  clearLog();
  log("Compiling...", "info");
});
socket.on("compiler:out", data => log(data));
socket.on("compiler:error", data => log(data || "There was an error.", "warning"));
socket.on("compiler:fail", data => log(data || "There was an error.", "error"));
socket.on("compiler:success", data => log("Finished compiling successfully.", "success"));

socket.on("exec:begin", data => log("Running...", "info"));
socket.on("exec:out", data => {
  const str = decoder.decode(data);
  for(const line of str.split(newline)){
    if(line) log(line);
  }
});
socket.on("exec:error", data => log(data || "There was an error.", "warning"));
socket.on("exec:fail", data => log("Exited with code: " + data, "error"));
socket.on("exec:success", data => log(data || "Finished running successfully.", "success"));

socket.on("disconnect", () => {
  leaveRoom();
  while(roomlistContainer.firstChild){
    roomlistContainer.removeChild(roomlistContainer.firstChild);
  }
  log("Disconnected.");
});

compileButton.addEventListener("click", e => {
  socket.emit("compiler:compile");
});
runButton.addEventListener("click", e => {
  socket.emit("exec:execute");
});
createRoomButton.addEventListener("click", e => {
  joinRoom(prompt("What should the name of the new room be? Name must be alphanumeric."));
});

function log(text, style = "default"){
  const isScrolledToBottom = logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 1,
        lineEl = document.createElement("div"),
        timeEl = document.createElement("div"),
        textEl = document.createElement("div");

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

const getFirebaseConfig = (() => {
  const firebaseConfigName = "firebase-config.json";
  var firebaseConfig;

  return function(){
    if(firebaseConfig){
      return new Promise(resolve => resolve(firebaseConfig));
    }else{
      return fetch(firebaseConfigName)
              .then(res => {
                firebaseConfig = res.json();
                return firebaseConfig;
              });
    }
  }
})();

getFirebaseConfig().then(config => {
  firebase.initializeApp(config);
  joinRoom();

  const ref = firebase.database().ref().orderByKey();
  ref.on("child_added", (data) => {
    const roomname = data.getKey();
    if(roomlist.size < roomlist.add(roomname).size){
      const roomEl = document.createElement("div");
      const roomText = document.createElement("div");
      roomEl.id = "honkpad-roomlist-item-" + roomname;
      roomEl.className = "honkpad-roomlist-item";
      roomText.className = "honkpad-roomlist-item-text";
      roomText.textContent = roomname;
      roomText.title = "Join room";
      roomText.addEventListener("click", e => {
        joinRoom(roomname);
      });

      if(roomname === currentRoom){
        roomEl.classList.add("honkpad-roomlist-item-active");
      }

      const deleteButton = document.createElement("div");
      deleteButton.className = "honkpad-roomlist-item-deletebutton";
      deleteButton.textContent = "✖";
      deleteButton.title = "Delete room";
      deleteButton.addEventListener("click", e => {
        if(confirm(`Are you sure you want to delete the room '${roomname}'?\nAll data from room '${roomname}' will be lost.`)) deleteRoom(roomname);
      });

      roomEl.appendChild(deleteButton);
      roomEl.appendChild(roomText);
      roomlistContainer.insertBefore(roomEl, createRoomButton);
    }
  });
  ref.on("child_removed", (data) => {
    const roomname = data.getKey();
    if(roomlist.delete(roomname)){
      if(roomname === currentRoom){
        joinRoom();
      }
      const roomEl = document.getElementById("honkpad-roomlist-item-" + roomname);
      roomlistContainer.removeChild(roomEl);
    }
  });
});

function leaveRoom(){
  if(currentRoom){
    const roomEl = document.getElementById("honkpad-roomlist-item-" + currentRoom);
    roomEl.classList.remove("honkpad-roomlist-item-active");
  }

  if(firepad) firepad.dispose();

  clearLog();
  codemirror.setValue("");
  codemirror.clearHistory();
}

function joinRoom(roomname = "default"){
  if(typeof roomname === "string"){
    roomname = roomname.replace(/[^A-z0-9]/g, "");
    if(roomname){
      leaveRoom();
      currentRoom = roomname;

      const roomEl = document.getElementById("honkpad-roomlist-item-" + currentRoom);
      if(roomEl){
        roomEl.classList.add("honkpad-roomlist-item-active");
      }

      socket.emit("meta:join", roomname);

      const firebaseRef = firebase.database().ref(roomname);
      firepad = Firepad.fromCodeMirror(firebaseRef, codemirror, {
        defaultText: '#include <iostream>\nusing namespace std;\n\nint main(){\n\tcout << "Hello World!";\n}'
      });
    }
  }
}

function deleteRoom(roomname){
  if(typeof roomname === "string"){
    roomname = roomname.replace(/[^A-z0-9]/g, "");
    if(roomname){
      if(roomname === currentRoom) joinRoom();

      roomlist.delete(roomname);

      const roomEl = document.getElementById("honkpad-roomlist-item-" + roomname);
      roomlistContainer.removeChild(roomEl);

      firebase.database().ref().child(roomname).remove();
    }
  }
}
