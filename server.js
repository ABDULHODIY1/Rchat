// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

// 1️⃣ Express ilovasini yaratish
const app = express();
const httpServer = http.createServer(app);

// 2️⃣ CORS konfiguratsiyasi (frontend har qanday origin uchun)
app.use(cors());

// 3️⃣ Statik fayllarni tarqatish
app.use(express.static(path.join(__dirname, 'public')));

// 4️⃣ Socket.IO serverini sozlash (CORS bilan barcha originlarga ruxsat)
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// 5️⃣ Kutish havzasi: juftlashmagan socket ID'lari
const waitingPool = new Set();

// 6️⃣ Foydalanuvchi sonini yangilash
function updateUserCount() {
  const count = io.of('/').sockets.size;
  io.emit('user-count', { count });
}

// 7️⃣ Tasodifiy juftlashuv
function pairRandom(socket) {
  // Agar oldin kutish ro'yxatida bo'lsa olib tashlaymiz
  waitingPool.delete(socket.id);

  // Agar bo'sh kutish ro'yxatida boshqa kimsalar bo'lsa
  if (waitingPool.size > 0) {
    // Tasodifiy sherik tanlash
    const ids = Array.from(waitingPool);
    const randId = ids[Math.floor(Math.random() * ids.length)];
    waitingPool.delete(randId);

    const partner = io.sockets.sockets.get(randId);
    if (partner) {
      // Juftlikni belgilash
      socket.partner = randId;
      partner.partner = socket.id;

      // Signaling
      socket.emit('paired', { initiator: true });
      partner.emit('paired', { initiator: false });

      console.log(`Paired ${socket.id} ↔ ${partner.id}`);
      updateUserCount();
      return;
    }
  }

  // Agar juft topilmasa, kutish havzasiga qo'shamiz
  waitingPool.add(socket.id);
  console.log(`${socket.id} kutmoqda (waitingPool size: ${waitingPool.size})`);
  updateUserCount();
}

// 8️⃣ Juftlikni bo'shatish
function unpair(socket) {
  if (!socket.partner) return;
  const partner = io.sockets.sockets.get(socket.partner);
  // Hamkorni xabarlash
  if (partner) {
    partner.emit('partner-disconnected');
    partner.partner = null;
    waitingPool.add(partner.id);
    console.log(`Unpaired ${socket.id} ←/→ ${partner.id}`);
  }
  socket.partner = null;
  updateUserCount();
}

// 9️⃣ Socket hodisalari
io.on('connection', socket => {
  console.log('Yangi mijoz ulandi:', socket.id);
  updateUserCount();
  pairRandom(socket);

  // Foydalanuvchi keyingi suhbatni so'raganda
  socket.on('next', () => {
    unpair(socket);
    pairRandom(socket);
  });

  // Signaling ma'lumotlarini sherikga uzatish
  socket.on('signal', data => {
    if (socket.partner) {
      const partner = io.sockets.sockets.get(socket.partner);
      if (partner) partner.emit('signal', data);
    }
  });

  // Ulanish uzilganda
  socket.on('disconnect', () => {
    console.log('Mijoz uzildi:', socket.id);
    unpair(socket);
    // Kutish havzasidan olib tashlash
    waitingPool.delete(socket.id);
    updateUserCount();
  });
});

// 🔟 Serverni ishga tushirish
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});