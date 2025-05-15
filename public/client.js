/*
Project: Random Video Chat
Tech Stack: Node.js, Express, Socket.io, WebRTC
UI: Tailwind CSS

Run:
1. npm init -y
2. npm install express socket.io
3. node server.js
4. Open http://localhost:3000
*/

// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory queue and partner mapping
const waiting = []; // stores unpaired socket IDs

const partners = new Map();

// Attempt to pair waiting clients
function tryPair() {
  while (waiting.length >= 2) {
    const id1 = waiting.shift();
    const id2 = waiting.shift();
    partners.set(id1, id2);
    partners.set(id2, id1);
    io.to(id1).emit('paired', { initiator: true, partner: id2 });
    io.to(id2).emit('paired', { initiator: false, partner: id1 });
    console.log(`Paired ${id1} & ${id2}`);
  }
}

io.on('connection', socket => {
  console.log('Connected:', socket.id);
  waiting.push(socket.id);
  tryPair();

  socket.on('next', () => {
    const old = partners.get(socket.id);
    if (old) {
      partners.delete(old);
      partners.delete(socket.id);
      io.to(old).emit('partner-disconnected');
      waiting.push(old);
    }
    waiting.push(socket.id);
    tryPair();
  });

  socket.on('signal', data => {
    const dest = partners.get(socket.id);
    if (dest) io.to(dest).emit('signal', data);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    const idx = waiting.indexOf(socket.id);
    if (idx !== -1) waiting.splice(idx, 1);
    const p = partners.get(socket.id);
    if (p) {
      io.to(p).emit('partner-disconnected');
      partners.delete(p);
    }
    partners.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening: http://localhost:${PORT}`));

---

---
// public/client.js
(function() {
  var startBtn = document.getElementById('startBtn');
  var videos = document.getElementById('videos');
  var controls = document.getElementById('controls');
  var localVid = document.getElementById('localVideo');
  var remoteVid = document.getElementById('remoteVideo');
  var socket, pc, localStream;
  var config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  iceTransportPolicy: 'all'
};

  startBtn.addEventListener('click', function() {
    startBtn.disabled = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(function(stream) {
        localStream = stream;
        localVid.srcObject = stream;
        return localVid.play();
      })
      .then(function() {
        videos.classList.remove('hidden');
        controls.classList.remove('hidden');
        initSocket();
      })
      .catch(function(err) {
        alert('Allow camera and microphone');
        console.error(err);
        startBtn.disabled = false;
      });
  });

  function createPeer(initiator) {
    pc = new RTCPeerConnection(config);
    localStream.getTracks().forEach(function(track) { pc.addTrack(track, localStream); });

    pc.onicecandidate = function(e) {
      if (e.candidate) socket.emit('signal', e.candidate);
    };
    pc.ontrack = function(e) {
      remoteVid.srcObject = e.streams[0];
      remoteVid.onloadedmetadata = function() {
        remoteVid.play().catch(function(e) { console.warn(e); });
      };
    };

    if (initiator) {
      pc.createOffer()
        .then(function(offer) { return pc.setLocalDescription(offer); })
        .then(function() { socket.emit('signal', pc.localDescription); })
        .catch(console.error);
    }
  }

  function cleanup() {
    if (pc) { pc.close(); pc = null; }
    remoteVid.srcObject = null;
  }

  function initSocket() {
    socket = io();
    socket.on('paired', function(data) {
      cleanup();
      createPeer(data.initiator);
    });
    socket.on('signal', function(data) {
      if (!pc) createPeer(false);
      if (data.type) {
        pc.setRemoteDescription(data)
          .then(function() {
            if (data.type === 'offer') {
              return pc.createAnswer()
                .then(function(ans) { return pc.setLocalDescription(ans); })
                .then(function() { socket.emit('signal', pc.localDescription); });
            }
          })
          .catch(console.error);
      } else {
        pc.addIceCandidate(data).catch(console.error);
      }
    });
    socket.on('partner-disconnected', cleanup);
    document.getElementById('nextBtn').addEventListener('click', function() {
      socket.emit('next'); cleanup();
    });
    document.getElementById('discBtn').addEventListener('click', function() {
      socket.disconnect(); cleanup();
    });
  }
})();
