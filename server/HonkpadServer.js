const path = require("path");
const express = require("express");
const socketio = require("socket.io");
const firebase = require("firebase-admin");
const firebaseConfig = require("../public/firebase-config.json");
const firebaseCredentials = require("./firebase-credentials.json");
const languages = require("./Languages");
const disallowedCharsRe = /[^A-Za-z0-9_]/g;
var Room;

function fixRoomName(roomname){
  return roomname.replace(disallowedCharsRe, "");
}

module.exports = class HonkpadServer{
  constructor(){
    this.express = express();
    this.express.use(express.static(path.resolve(__dirname + "/../public")));
    this.socketio = null;
    this.firebase = firebase;
    firebase.initializeApp({
      credential: firebase.credential.cert(firebaseCredentials),
      databaseURL: firebaseConfig.databaseURL
    });
    this.rooms = new Map();
    this.init = this.init.bind(this);
  }

  addUser(roomData){
    const room = this.rooms.get(roomData.name);
    if(room){
      room.userCount++;
    }else{
      const Language = languages[roomData.languageName];
      if(Language){
        const newRoom = new Room(roomData.name, new Language(), this.socketio);
        newRoom.userCount++;
        this.rooms.set(roomData.name, newRoom);
      }
    }
  }

  removeUser(roomData){
    const room = this.rooms.get(roomData.name);
    if(room){
      if(--room.userCount <= 0){
        room.firepadClient.dispose();
        this.rooms.delete(roomData.name);
      }
    }
  }

  init(server){
    Room = require("./Room");

    if(!this.socketio){
      this.socketio = socketio(server, {path: "/honkpad/socket.io"});
      this.socketio.on("connect", socket => {
        const currentRoom = {
          name: null,
          languageName: null
        };

        socket.on("meta:join", data => {
          const newRoomname = fixRoomName(data.roomname);
          const {languageName} = data;
          if(newRoomname){
            if(currentRoom.name){
              socket.leave(currentRoom.name);
              this.removeUser(currentRoom);
            }
            currentRoom.name = newRoomname;
            currentRoom.languageName = languageName;
            socket.join(currentRoom.name);
            this.addUser(currentRoom);
          }
        });

        socket.on("compiler:compile", () => {
          const room = this.rooms.get(currentRoom.name);
          if(room){
            room.compile();
          }
        });

        socket.on("exec:execute", () => {
          const room = this.rooms.get(currentRoom.name);
          if(room){
            room.execute();
          }
        });

        socket.on("meta:about", async () => {
          const room = this.rooms.get(currentRoom.name);
          if(room){
            socket.emit("meta:about", await room.language.getInfo());
          }
        })

        socket.on("disconnect", () => {
          if(currentRoom.name){
            this.addUser(currentRoom);
          }
        });
      });
    }
  }
}
