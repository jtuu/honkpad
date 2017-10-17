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
      notificationContainer = document.getElementById("notifications"),
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
      disallowedCharsRe = /[^A-Za-z0-9_]/g,
      socket = io.connect(location.origin, {path: "/honkpad/socket.io"}),
      languages = {
        "C++": {
          name: "C++",
          codemirrorMode: "text/x-c++src"
        },
        "JavaScript": {
          name: "JavaScript",
          codemirrorMode: "text/javascript"
        }
      },
      defaultLang = "C++";

class Notification{
  constructor(text){
    this.text = text;

    // base element
    this.el = document.createElement("div");
    this.el.classList.add("notification");

    // button in the corner that will close the notif
    // all types have this
    const closeButton = this.el.appendChild(document.createElement("div"));
    closeButton.textContent = "✖";
    closeButton.classList.add("close");
    closeButton.addEventListener("click", e => {
      this.hide();
    });

    const textEl = this.el.insertBefore(document.createElement("div"), this.el.firstChild);
    textEl.textContent = this.text;
    textEl.classList.add("text");
  }

  hide(){
    const remove = () => {
      notificationContainer.removeChild(this.el);
      this.el.removeEventListener("animationend", remove);
      this.el.classList.remove("hide");
    }
    this.el.addEventListener("animationend", remove);
    this.el.classList.add("hide");
  }

  show(timeout = 5000){
    notificationContainer.appendChild(this.el);
    if(timeout !== Infinity) setTimeout(() => this.hide(), timeout);
  }
}

class RoomCreationPopup extends Notification{
  constructor(callbacks){
    super("New Room");

    this.id = ++RoomCreationPopup.idCounter;

    this.nameInputGroup = this.el.appendChild(document.createElement("fieldset"));
    this.nameInputLabel = this.nameInputGroup.appendChild(document.createElement("div"));
    this.nameInputLabel.textContent = "Room name:";
    this.nameInput = this.nameInputGroup.appendChild(document.createElement("input"));
    this.nameInput.placeholder = "MyRoom";

    this.languageInputGroup = this.el.appendChild(document.createElement("fieldset"));
    this.languageInputLabel = this.languageInputGroup.appendChild(document.createElement("div"));
    this.languageInputLabel.textContent = "Room language:";
    for(let i = 0, keys = Object.keys(languages), languageName = keys[i]; i < keys.length; i++, languageName = keys[i]){
      const languageRadioButton = this.languageInputGroup.appendChild(document.createElement("input"));
      languageRadioButton.type = "radio";
      languageRadioButton.name = "language";
      languageRadioButton.value = languageName;
      languageRadioButton.id = `notif-${this.id}-lang-${i}`;
      if(i == 0) languageRadioButton.checked = true;

      const languageRadioLabel = this.languageInputGroup.appendChild(document.createElement("label"));
      languageRadioLabel.for = languageRadioButton.id;
      languageRadioLabel.textContent = languageName;
    }

    this.okButton = this.el.appendChild(document.createElement("div"));
    this.okButton.classList.add("honkpad-button");
    this.okButton.textContent = "OK";
    if(callbacks.onOkClick){
      this.okButton.addEventListener("click", e => callbacks.onOkClick(this, e));
    }
  }

  get formValues(){
    return {
      roomName: this.nameInput.value,
      languageName: this.languageInputGroup.querySelector(`input[name="language"]:checked`).value
    };
  }
}
RoomCreationPopup.idCounter = 0;

var firepad,
    currentRoom = localStorage.getItem("currentRoom") || undefined,
    currentLang = localStorage.getItem("currentLang") || undefined,
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
socket.on("exec:fail", data => log("Exited with an error.", "error"));
socket.on("exec:success", data => log(data || "Exited.", "success"));
socket.on("exec:timeout", () => log("Timed out.", "error"));

socket.on("meta:about", data => {
  for(const line of data.split(newline)){
    if(line) log(line);
  }
});

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
  (new RoomCreationPopup({
    onOkClick: (notif, e) => {
      const {roomName, languageName} = notif.formValues;
      console.log(notif.formValues)
      if(roomName && languageName){
        notif.hide();
        joinRoom(roomName, languageName);
      }
    }
  })).show(Infinity);
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
  localStorage.setItem("currentLang", currentLang);
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
  joinRoom(currentRoom, currentLang);
  const ref = firebase.database().ref().orderByKey();
  ref.on("child_added", (data) => {
    const roomname = data.getKey();
    const languageName = data.child("language").val() || defaultLang;
    if(roomlist.size < roomlist.add(roomname).size){
      const roomEl = document.createElement("div");
      const roomText = document.createElement("div");
      roomEl.id = "honkpad-roomlist-item-" + roomname;
      roomEl.className = "honkpad-roomlist-item";
      roomText.className = "honkpad-roomlist-item-text";
      roomText.textContent = roomname;
      roomText.title = "Join room";
      roomText.addEventListener("click", e => {
        joinRoom(roomname, languageName);
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

function joinRoom(roomname = "default", languageName = defaultLang){
  if(typeof roomname === "string" && languageName in languages){
    roomname = roomname.replace(disallowedCharsRe, "");
    if(roomname){
      leaveRoom();
      currentRoom = roomname;
      currentLang = languageName;

      const roomEl = document.getElementById("honkpad-roomlist-item-" + currentRoom);
      if(roomEl){
        roomEl.classList.add("honkpad-roomlist-item-active");
      }

      document.title = currentRoom + " | Honkpad";

      socket.emit("meta:join", {roomname, languageName});

      const firebaseRef = firebase.database().ref(roomname);
      firebaseRef.child("language").set(languageName);
      codemirror.setOption("mode", languages[languageName].codemirrorMode);
      firepad = Firepad.fromCodeMirror(firebaseRef, codemirror);
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
