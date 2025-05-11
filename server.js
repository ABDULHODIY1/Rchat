const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Static fayllarni tarqatamiz
app.use(express.static(path.join(__dirname, 'public')));

// Kutish havzasi
let waitingPool = [];

function updateUserCount() {
  const count = io.sockets.sockets.size;
  io.emit('user-count', count);
}

function pairRandom(socket) {
  const idx = waitingPool.indexOf(socket.id);
  if (idx !== -1) waitingPool.splice(idx, 1);

  if (waitingPool.length > 0) {
    const randIndex = Math.floor(Math.random() * waitingPool.length);
    const partnerId = waitingPool.splice(randIndex, 1)[0];
    const partnerSocket = io.sockets.sockets.get(partnerId);

    socket.partner = partnerId;
    partnerSocket.partner = socket.id;

    socket.emit('paired', { initiator: true });
    partnerSocket.emit('paired', { initiator: false });
  } else {
    waitingPool.push(socket.id);
  }
}

function unpair(socket) {
  if (!socket.partner) return;
  const partner = io.sockets.sockets.get(socket.partner);
  if (partner) {
    partner.partner = null;
    partner.emit('partner-disconnected');
    waitingPool.push(partner.id);
  }
  socket.partner = null;
}

io.on('connection', socket => {
  updateUserCount();
  pairRandom(socket);

  socket.on('next', () => {
    unpair(socket);
    pairRandom(socket);
    updateUserCount();
  });

  socket.on('signal', data => {
    const partner = io.sockets.sockets.get(socket.partner);
    if (partner) partner.emit('signal', data);
  });

  socket.on('disconnect', () => {
    unpair(socket);
    updateUserCount();
    waitingPool = waitingPool.filter(id => id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
