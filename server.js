// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Static fayllarni tarqatamiz
app.use(express.static(path.join(__dirname, 'public')));

// Kutish havzasi
let waitingPool = [];

/**
 * Hozirgi ulangan mijozlar sonini hisoblab,
 * barcha mijozlarga yuboradi.
 */
function updateUserCount() {
  const count = io.sockets.sockets.size;
  io.emit('user-count', count);
}

/**
 * Socket’ni tasodifiy sherik bilan juftlaydi
 */
function pairRandom(socket) {
  // O‘zini kutishdan olib tashlaymiz (agar oldin qo‘shilgan bo‘lsa)
  const idx = waitingPool.indexOf(socket.id);
  if (idx !== -1) waitingPool.splice(idx, 1);

  if (waitingPool.length > 0) {
    // Tasodifiy sherik tanlaymiz
    const randIndex = Math.floor(Math.random() * waitingPool.length);
    const partnerId = waitingPool.splice(randIndex, 1)[0];
    const partnerSocket = io.sockets.sockets.get(partnerId);

    // Juftlikni belgilang
    socket.partner = partnerId;
    partnerSocket.partner = socket.id;

    socket.emit('paired');
    partnerSocket.emit('paired');
    console.log(`Paired ${socket.id} ↔ ${partnerId}`);
  } else {
    // Hozircha kutadi
    waitingPool.push(socket.id);
    console.log(`${socket.id} kutmoqda`);
  }
}

/**
 * Socket’ni juftlikdan olib tashlaydi
 */
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

// Barcha hodisalarni bitta blokda qayta ishlaymiz
io.on('connection', socket => {
  console.log('Yangi mijoz ulanishi:', socket.id);

  // Ulanish bo‘lgach: user-count va juftlashish
  updateUserCount();
  pairRandom(socket);

  // “Next” bosilganda: avvalgi juftlikni uzib, yangisini topamiz
  socket.on('next', () => {
    unpair(socket);
    pairRandom(socket);
    updateUserCount();
  });

  // Signal ma’lumotlarini sherikka uzatamiz
  socket.on('signal', data => {
    const partner = io.sockets.sockets.get(socket.partner);
    if (partner) partner.emit('signal', data);
  });

  // Disconnect bo‘lsa: juftlikni uzib, user sonini yangilaymiz
  socket.on('disconnect', () => {
    console.log('Mijoz uzildi:', socket.id);
    unpair(socket);
    updateUserCount();
    // Kutish havzasidan olib tashlaymiz (agar u yerda bo‘lsa)
    waitingPool = waitingPool.filter(id => id !== socket.id);
  });
});

// Serverni ishga tushiramiz
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} da ishga tushdi`);
});
