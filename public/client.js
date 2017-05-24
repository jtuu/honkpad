const logContainer = document.getElementById("honkpad-log"),
      logMaxSize = 500,
      roomlist = new Set(),
      roomlistContainer = document.getElementById("honkpad-roomlist-container"),
      createRoomButton = document.getElementById("honkpad-roomlist-createbutton"),
      compileButton = document.getElementById("honkpad-compile"),
      runButton = document.getElementById("honkpad-run"),
      aboutButton = document.getElementById("honkpad-about"),
      orientationButton = document.getElementById("honkpad-orientation"),
      resizeEl = document.getElementById("honkpad-log-resize"),
      resizeMin = 0,
      resizeMax = 100,
      firepadContainer = document.getElementById("firepad"),
      codemirror = CodeMirror(firepadContainer, {
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        mode: "text/x-c++src",
        lineWrapping: true
      }),
      honkpadContainer = document.getElementById("honkpad-main-wrap"),
      decoder = new TextDecoder(),
      newline = /\r\n|\n/,
      disallowedCharsRe = /[^A-Za-z0-9_-]/g,
      socket = io.connect(location.origin, {path: "/honkpad/socket.io"});

var firepad,
    currentRoom = localStorage.getItem("currentRoom") || undefined,
    currentOrientation = "row";

if(localStorage.getItem("currentOrientation") === "row"){
  firepadContainer.style.width = localStorage.getItem("firepadContainer.style.width") || "50%";
  logContainer.style.width = localStorage.getItem("logContainer.style.width") || "50%";
}else{
  toggleOrientation();
  firepadContainer.style.height = localStorage.getItem("firepadContainer.style.height") || "50%";
  logContainer.style.height = localStorage.getItem("logContainer.style.height") || "50%";
}

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

socket.on("meta:about", data => log(data));

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
aboutButton.addEventListener("click", e => {
  socket.emit("meta:about");
});
orientationButton.addEventListener("click", e => {
  toggleOrientation();
});

resizeEl.addEventListener("mousedown", e => {
  var isMouseDown = true;
  document.body.style.cursor = currentOrientation === "row" ? "col-resize" : "row-resize";

  function onmouseup(){
    document.body.style.cursor = "";
    isMouseDown = false;
    codemirror.refresh();
    window.removeEventListener("mousemove", onmousemove);
    window.removeEventListener("mouseup", onmouseup);
  }

  function onmousemove(e){
    if(isMouseDown){
      if(currentOrientation === "row"){
        const screenMin = 40,
              screenMax = document.body.offsetWidth,
              width = (e.clientX - screenMin) / (screenMax - screenMin) * (resizeMax - resizeMin) + resizeMin;
        firepadContainer.style.width = width.toFixed(3) + "%";
        logContainer.style.width = (resizeMax - width).toFixed(3) + "%";
      }else{
        const screenMin = 0,
              screenMax = document.body.offsetHeight,
              height = (e.clientY - screenMin) / (screenMax - screenMin) * (resizeMax - resizeMin) + resizeMin;
        firepadContainer.style.height = height.toFixed(3) + "%";
        logContainer.style.height = (resizeMax - height).toFixed(3) + "%";
      }
    }
  }

  window.addEventListener("mouseup", onmouseup);
  window.addEventListener("mousemove", onmousemove);
});

window.addEventListener("beforeunload", e => {
  localStorage.setItem("currentOrientation", currentOrientation);
  if(currentOrientation === "row"){
    localStorage.setItem("firepadContainer.style.width", firepadContainer.style.width);
    localStorage.setItem("logContainer.style.width", logContainer.style.width);
  }else{
    localStorage.setItem("firepadContainer.style.height", firepadContainer.style.height);
    localStorage.setItem("logContainer.style.height", logContainer.style.height);
  }

  localStorage.setItem("currentRoom", currentRoom);
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

  if(logContainer.childElementCount > logMaxSize){
    logContainer.removeChild(logContainer.firstChild);
  }

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

function firebaseAuth(){
  return new Promise((resolve, reject) => {
    firebase.auth().onAuthStateChanged(user => {
      if(user){
        resolve(user);
      }else{
        firebase.auth().signInAnonymously().catch(reject);
      }
    })
  });
}

getFirebaseConfig().then(config => {
  firebase.initializeApp(config);
  return firebaseAuth();
}).then(() => {
  joinRoom(currentRoom);
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
}).catch(err => console.error(err));

function leaveRoom(){
  const roomEl = document.getElementById("honkpad-roomlist-item-" + currentRoom);
  if(roomEl){
    roomEl.classList.remove("honkpad-roomlist-item-active");
  }

  if(firepad) firepad.dispose();

  clearLog();
  codemirror.setValue("");
  codemirror.clearHistory();
}

function joinRoom(roomname = "default"){
  if(typeof roomname === "string"){
    roomname = roomname.replace(disallowedCharsRe, "");
    if(roomname){
      leaveRoom();
      currentRoom = roomname;

      const roomEl = document.getElementById("honkpad-roomlist-item-" + currentRoom);
      if(roomEl){
        roomEl.classList.add("honkpad-roomlist-item-active");
      }

      document.title = currentRoom + " | Honkpad";

      socket.emit("meta:join", roomname);

      const firebaseRef = firebase.database().ref(roomname);
      firepad = Firepad.fromCodeMirror(firebaseRef, codemirror, {
        defaultText: '#include <iostream>\nusing namespace std;\n\nint main(){\n  cout << "Hello World!";\n}'
      });
    }
  }
}

function deleteRoom(roomname){
  if(typeof roomname === "string"){
    roomname = roomname.replace(disallowedCharsRe, "");
    if(roomname){
      if(roomname === currentRoom) joinRoom();

      roomlist.delete(roomname);

      const roomEl = document.getElementById("honkpad-roomlist-item-" + roomname);
      roomlistContainer.removeChild(roomEl);

      firebase.database().ref().child(roomname).remove();
    }
  }
}

function toggleOrientation(){
  honkpadContainer.classList.toggle("orientation-row");
  honkpadContainer.classList.toggle("orientation-column");

  if(currentOrientation === "row"){
    firepadContainer.style.height = firepadContainer.style.width;
    logContainer.style.height = logContainer.style.width;
    firepadContainer.style.width = "";
    logContainer.style.width = "";
    currentOrientation = "column";
  }else{
    firepadContainer.style.width = firepadContainer.style.height;
    logContainer.style.width = logContainer.style.height;
    firepadContainer.style.height = "";
    logContainer.style.height = "";
    currentOrientation = "row";
  }
}
