// --- [YANGILANGAN BACKEND: Real-time foydalanuvchilar soni va kutish holati bilan] ---

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingPool = [];
let connectedCount = 0;

io.on('connection', socket => {
  connectedCount++;
  io.emit('user-count', connectedCount);
  console.log('Client connected:', socket.id);

  socket.on('start', () => {
    if (!waitingPool.includes(socket)) {
      waitingPool.push(socket);
    }
    pairRandom(socket);
  });

  socket.on('next', () => {
    unpair(socket);
    if (!waitingPool.includes(socket)) waitingPool.push(socket);
    pairRandom(socket);
  });

  socket.on('signal', data => {
    const partner = io.sockets.sockets.get(socket.partner);
    if (partner) partner.emit('signal', data);
  });

  socket.on('disconnect', () => {
    connectedCount--;
    io.emit('user-count', connectedCount);
    unpair(socket);
    waitingPool = waitingPool.filter(s => s.id !== socket.id);
  });

  function pairRandom(sock) {
    const idx = waitingPool.findIndex(s => s.id === sock.id);
    if (idx < 0) return;
    waitingPool.splice(idx, 1);
    if (waitingPool.length === 0) {
      sock.emit('waiting');
      // avtomatik reload (client tomonda amalga oshadi)
      sock.emit('reload');
      return;
    }
    const randIndex = Math.floor(Math.random() * waitingPool.length);
    const partner = waitingPool.splice(randIndex, 1)[0];
    sock.partner = partner.id;
    partner.partner = sock.id;
    sock.emit('paired');
    partner.emit('paired');
  }

  function unpair(sock) {
    const partner = io.sockets.sockets.get(sock.partner);
    if (partner) {
      partner.partner = null;
      partner.emit('partner-disconnected');
    }
    sock.partner = null;
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
