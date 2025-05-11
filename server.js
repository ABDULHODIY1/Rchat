//// server.js
//const express = require('express');
//const http = require('http');
//const path = require('path');
//const { Server } = require('socket.io');
//
//const app = express();
//const httpServer = http.createServer(app);
//const io = new Server(httpServer, {
//  cors: { origin: "*" }
//});
//
//// Static fayllarni tarqatamiz
//app.use(express.static(path.join(__dirname, 'public')));
//
//// Kutish havzasi
//let waitingPool = [];
//
///**
// * Hozirgi ulangan mijozlar sonini hisoblab,
// * barcha mijozlarga yuboradi.
// */
//function updateUserCount() {
//  const count = io.sockets.sockets.size;
//  io.emit('user-count', count);
//}
//
///**
// * Socket’ni tasodifiy sherik bilan juftlaydi
// * va bir tarafga caller (initiator) flag qo‘yadi.
// */
//function pairRandom(socket) {
//  // O‘zini kutishdan olib tashlaymiz (agar bor bo‘lsa)
//  const idx = waitingPool.indexOf(socket.id);
//  if (idx !== -1) waitingPool.splice(idx, 1);
//
//  if (waitingPool.length > 0) {
//    const randIndex = Math.floor(Math.random() * waitingPool.length);
//    const partnerId = waitingPool.splice(randIndex, 1)[0];
//    const partnerSocket = io.sockets.sockets.get(partnerId);
//
//    // Caller va callee ni ajratamiz
//    socket.partner = partnerId;
//    partnerSocket.partner = socket.id;
//
//    // socket – caller (initiator), partnerSocket – callee
//    socket.emit('paired',       { initiator: true  });
//    partnerSocket.emit('paired',{ initiator: false });
//
//    console.log(`Paired ${socket.id} ↔ ${partnerId}`);
//  } else {
//    waitingPool.push(socket.id);
//    console.log(`${socket.id} kutmoqda`);
//  }
//}
//
///**
// * Socket’ni juftlikdan olib tashlaydi
// */
//function unpair(socket) {
//  if (!socket.partner) return;
//  const partner = io.sockets.sockets.get(socket.partner);
//  if (partner) {
//    partner.partner = null;
//    partner.emit('partner-disconnected');
//    waitingPool.push(partner.id);
//  }
//  socket.partner = null;
//}
//
//io.on('connection', socket => {
//  console.log('Yangi mijoz ulanishi:', socket.id);
//
//  // Har ulanishda va keyinchalik user-count yangilanadi
//  updateUserCount();
//  pairRandom(socket);
//
//  socket.on('next', () => {
//    unpair(socket);
//    pairRandom(socket);
//    updateUserCount();
//  });
//
//  socket.on('signal', data => {
//    const partner = io.sockets.sockets.get(socket.partner);
//    if (partner) partner.emit('signal', data);
//  });
//
//  socket.on('disconnect', () => {
//    console.log('Mijoz uzildi:', socket.id);
//    unpair(socket);
//    updateUserCount();
//    waitingPool = waitingPool.filter(id => id !== socket.id);
//  });
//});
//
//const PORT = process.env.PORT || 3000;
//httpServer.listen(PORT, () => {
//  console.log(`Server http://localhost:${PORT} da ishga tushdi`);
//});
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// 1. Express ilovasini yaratish
const app = express();
const httpServer = http.createServer(app);

// 2. Socket.IO sozlamalari (CORS ruxsatlari bilan)
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// 3. Static fayllarni tarqatish
app.use(express.static(path.join(__dirname, 'public')));

// 4. Kutish havzasi: juftlashmagan socketlar
let waitingPool = [];

// 5. Hozirgi ulanishlar sonini yangilash
function updateUserCount() {
  const count = io.sockets.sockets.size;
  io.emit('user-count', count);
}

// 6. Tasodifiy juftlashuv funksiyasi
function pairRandom(socket) {
  // Agar socket oldin kutuvchilarda bo'lsa, olib tashlaymiz
  const idx = waitingPool.indexOf(socket.id);
  if (idx !== -1) waitingPool.splice(idx, 1);

  // Agar kimdir kutayotgan bo'lsa, juftlaymiz
  if (waitingPool.length > 0) {
    const partnerId = waitingPool.splice(
      Math.floor(Math.random() * waitingPool.length),
      1
    )[0];
    const partnerSocket = io.sockets.sockets.get(partnerId);

    socket.partner = partnerId;
    partnerSocket.partner = socket.id;

    // Initiator va calleega xabar berish
    socket.emit('paired', { initiator: true  });
    partnerSocket.emit('paired', { initiator: false });
  } else {
    // Aks holda kutish havzasiga qo'shamiz
    waitingPool.push(socket.id);
  }
}

// 7. Juftlikni bo'shatish
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

// 8. Socket.io hodisalari
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

// 9. Serverni ishga tushirish
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});