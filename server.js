const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'public')));

// Queue of socket IDs waiting to be paired
const waiting = [];

// Map from socket ID to its partner ID
const partners = new Map();

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
  // Add to waiting and attempt pairing
  waiting.push(socket.id);
  tryPair();

  socket.on('next', () => {
    // Remove current partner mapping
    const oldPartner = partners.get(socket.id);
    if (oldPartner) {
      partners.delete(oldPartner);
      partners.delete(socket.id);
      // Notify old partner to requeue
      io.to(oldPartner).emit('partner-disconnected');
      waiting.push(oldPartner);
    }
    // Requeue this socket and try pairing
    waiting.push(socket.id);
    tryPair();
  });

  socket.on('signal', data => {
    const partnerId = partners.get(socket.id);
    if (partnerId) io.to(partnerId).emit('signal', data);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    // Remove from waiting if present
    const idx = waiting.indexOf(socket.id);
    if (idx !== -1) waiting.splice(idx,1);
    // Notify and cleanup partner
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected');
      partners.delete(partnerId);
    }
    partners.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
