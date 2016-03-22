var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var uuidGen = require('node-uuid');
var path = require('path');

app.use(express.static(path.join(__dirname+'/')));

app.use('/src', express.static(__dirname + '/src'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var ROOM_CAP = 100;
var date = new Date();

var UserManager = function() {
  var that = this;
  this.clientNameTable = {server: true};
  this.userIdToUserName = {};

  this.getUserName = function(uuid) {
    return that.userIdToUserName[uuid];
  }

  this.canTakeName = function(name) {
    return that.clientNameTable[name];
  }

  this.addUser = function(uuid, name) {
    that.clientNameTable[name] = true;
    that.userIdToUserName[uuid] = name;
  }

  this.removeUser = function(uuid) {
    var name = that.userIdToUserName[uuid];
    delete that.clientNameTable[name];
    delete that.userIdToUserName[uuid];
  }

  this.verifyUser = function(uuid, name) {
    return uuid && name && uuid.length > 0 && name.length > 0 && that.userIdToUserName[uuid] === name;
  }

}


var Room = function(roomName) {
  var that = this;

  this.capacity = ROOM_CAP;
  this.userList = [];
  this.name = roomName;
  
  this.userCount = function() {
    return that.userList.length;
  }

  this.hasCap = function() {
    return that.userList.length < that.capacity;
  }

  this.addUser = function(name) {
    that.userList.push(name);
  }

  this.removeUser = function(name) {
    var index = that.userList.indexOf(name);
    if (index > -1) {
      that.userList.splice(index, 1);
    }
  }

  this.toJson = function() {
    return {
      name: that.name,
      userCount: that.userList.length,
      capacity: that.capacity
    };
  }
};

var RoomManager = function() {
  var that = this;

  this.roomTable = {};
  this.userTable = {};

  this.getClientRoomName = function(name) {
    return that.userTable[name];
  }

  this.getRoomNameByName = function(roomName) {
    var room = that.roomTable[roomName];
    if (room) {
      return room.name;
    }
    return null;
  }

  this.removeUser = function(name) {
    var roomName = that.userTable[name];
    var room = that.roomTable[roomName];
    if (room) {
      room.removeUser(name);
      delete that.userTable[name];
    }
  }

  this.createRoom = function(roomName) {
    if (that.roomTable[roomName]) {
      return false;
    }
    var room = new Room(roomName);
    that.roomTable[roomName] = room;
    return true;
  }

  this.joinRoom = function(name, roomName) {
    var room = that.roomTable[roomName];
    var res = false;
    if (room && room.hasCap()) {
      room.addUser(name);
      that.userTable[name] = roomName;
      res = true;
    }
    return res;
  }

  this.getRoomList = function() {
    var roomList = [];
    for (var roomName in that.roomTable) {
      if (that.roomTable.hasOwnProperty(roomName)) {
        roomList.push(that.roomTable[roomName].toJson());
      }
    }
    return roomList;
  }
};

var roomManager = new RoomManager();
var userManager = new UserManager();

io.on('connection', function(socket) {
  var thisUserId = null;

  console.log('a user connected');
  
  socket.on('disconnect', function() {
    if (thisUserId) {
      var name = userManager.getUserName(thisUserId);
      roomManager.removeUser(name);
      userManager.removeUser(thisUserId);
    }
    console.log('user disconnected ' + thisUserId);
  });

  socket.on('clientFetchRoomList', function() {
    socket.emit('fetchRoomListResult', roomManager.getRoomList());
  });

  socket.on('clientRegisterName', function(name) {
    var result = {};
    if (userManager.canTakeName(name)) {
      result.success = false;
      result.msg = "Sorry, name taken.";
    } else {
      var userId = uuidGen.v1();
      userManager.addUser(userId, name);
      result.success = true;
      result.name = name;
      result.msg = "Welcome " + name + "!";
      result.uuid = userId;
      thisUserId = userId;
    }
    socket.emit('registerNameResult', result);
  });

  socket.on('clientCreateRoom', function(data) {
    var uuid = data.uuid;
    var name = data.name;
    var roomName = data.roomName;
    var result = {};
    result.success = userManager.verifyUser(uuid, name);
    if (result.success) {
      result.success = roomManager.createRoom(roomName);
      if (result.success) {
        result.roomName = roomName;
      }
    }
    socket.emit('createRoomResult', result);
  });

  socket.on('clientJoinRoom', function(data) {
    var uuid = data.uuid;
    var name = data.name;
    var roomName = data.roomName;
    var result = {};
    result.success = userManager.verifyUser(uuid, name);
    if (result.success) {
      result.success = roomManager.joinRoom(name, roomName);
      if (result.success) {
        result.roomName = roomName;
        socket.join(roomName);
        io.to(roomName).emit('serverBroadcastChatMsg', {data: "User has joined chat: " + name,
                                                        name: "server",
                                                        timestamp: date.getTime()});
      }
    }
    socket.emit('joinRoomResult', result);
  });

  socket.on('clientSendChatMsg', function(data) {
    var uuid = data.uuid;
    var name = data.name;
    if (userManager.verifyUser(uuid, name)) {
      var roomName = roomManager.getClientRoomName(name);
      delete data[uuid];
      io.to(roomName).emit('serverBroadcastChatMsg', data);
    } else {
      console.log("Send msg: failed verifyUser");
    }
  });

  socket.on('clientLeaveRoom', function(data) {
    var uuid = data.uuid;
    var name = data.name;
    if (userManager.verifyUser(uuid, name)) {
      console.log(name + " leave");
      socket.emit('confirmLeftRoom');
      io.emit('serverBroadcastChatMsg', {data: "User has left chat: " + name,
                                         name: "server",
                                         timestamp: date.getTime()});
      roomManager.removeUser(name);
    } else {
      console.log("Leave Room: failed verifyUser");      
    }
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});