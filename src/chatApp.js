var chatApp = angular.module('chatApp', []);

chatApp.factory('socket', ['$rootScope', function ($rootScope) {
  var socket = io();

  Socket = function() {
    var that = this;

    this.on = function(eventName, callback) {
        function wrapper() {
          var args = arguments;
          $rootScope.$apply(function () {
            callback.apply(socket, args);
          });
        }
        socket.on(eventName, wrapper);

        return function() {
          socket.removeListener(eventName, wrapper);
        };
    },

    this.emit = function(eventName, data, callback) {
      socket.emit(eventName, data, function() {
        var args = arguments;
        $rootScope.$apply(function() {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      });
    }

    this.fetchRoomList = function() {
      that.emit('clientFetchRoomList');
    }

    this.sendMsg = function(data, callback) {
      that.emit('clientSendChatMsg', data, callback);
    }

    this.createRoom = function(data) {
      that.emit('clientCreateRoom', data);
    }

    this.leaveRoom = function(data) {
      that.emit('clientLeaveRoom', data);
    }

    this.joinRoom = function(data) {
      that.emit('clientJoinRoom', data);
    }

    this.registerName = function(name) {
      that.emit('clientRegisterName', name);
    }
  };
  console.log("new socket");
  return new Socket();
}]);

chatApp.controller('chatController', function($scope, socket) {
  $scope.name = null;
  $scope.uuid = null;
  $scope.currentRoomName = null;
  $scope.canQuitChat = false;
  $scope.currentRoomMessageList = [];
  $scope.roomList = [];
  $scope.date = new Date();

  socket.on('registerNameResult', function(result) {
    console.log(result.msg);
    if (result.success) {
      $scope.name = result.name;
      $scope.uuid = result.uuid;
      $scope.fetchRoomList();
    }
  });

  socket.on('createRoomResult', function(result) {
    console.log(result);
    if (result.success) {
      socket.joinRoom({name: $scope.name, uuid: $scope.uuid, roomName: result.roomName});
    }
  });

  socket.on('joinRoomResult', function(result) {
    console.log(result);
    if (result.success) {
      $scope.currentRoomName = result.roomName;
    }
  });

  socket.on('serverBroadcastChatMsg', function(data) {
    $scope.currentRoomMessageList.push(data);
    console.log(data);
  });

  socket.on('confirmLeftRoom', function() {
    console.log("left room");
    $scope.canQuitChat = true;
  });

  socket.on('fetchRoomListResult', function(roomList) {
    $scope.roomList = roomList;
    console.log("room list " + roomList);
  });

  $scope.fetchRoomList = function() {
    $scope.currentRoomMessageList = [];
    socket.fetchRoomList();
  };

  $scope.registerName = function(name) {
    if (!$scope.name) {
      socket.registerName(name);
    }
  };

  $scope.sendChatMsg = function(msg) {
    if (msg && msg.length > 0) {
      socket.sendMsg({data: msg, name: $scope.name, uuid: $scope.uuid, timestamp: $scope.date.getTime()});
    }
  };

  $scope.createRoom = function(roomName) {
    if (roomName && roomName.length > 0) {
      socket.createRoom({name: $scope.name, uuid: $scope.uuid, roomName:roomName});
    }
  }

  $scope.leaveRoom = function() {
    socket.leaveRoom({name: $scope.name, uuid: $scope.uuid});
  };

  $scope.quitChat = function() {
    if ($scope.canQuitChat) {
      $scope.cleanup();
    }
  };

  $scope.joinRoom = function(roomName) {
    socket.joinRoom({name: $scope.name, uuid: $scope.uuid, roomName: roomName});
  };

  $scope.cleanup = function() {
    $scope.currentRoomName = null;
    $scope.canQuitChat = false;
    $scope.currentRoomMessageList = [];
    $scope.roomList = [];
    $scope.fetchRoomList();
  };

});