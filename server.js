const express = require('express');
const fetch = require('node-fetch'); // Agar node-fetch kerak bo‘lsa
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors()); // frontendga ruxsat berish

// Proxy route
app.get('/proxy-model-settings', async (req, res) => {
  try {
    const response = await fetch('https://extensions.aitopia.ai/ai/model_settings');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Xatolik:', error);
    res.status(500).json({ error: 'Maʼlumotni olishda xatolik yuz berdi' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server http://localhost:${PORT} da ishlayapti`);
});
