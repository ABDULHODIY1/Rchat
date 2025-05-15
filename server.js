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