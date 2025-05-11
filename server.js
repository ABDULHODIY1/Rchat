const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingPool = [];

io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  // 🔴 Real-time user count
  io.emit('user-count', io.engine.clientsCount);

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
    unpair(socket);
    waitingPool = waitingPool.filter(s => s.id !== socket.id);
    io.emit('user-count', io.engine.clientsCount); // update user count
  });

  function pairRandom(sock) {
    const idx = waitingPool.findIndex(s => s.id === sock.id);
    if (idx < 0) return;
    waitingPool.splice(idx, 1);
    if (waitingPool.length === 0) {
      sock.emit('waiting');
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
    if (partner) partner.emit('partner-disconnected');
    sock.partner = null;
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
