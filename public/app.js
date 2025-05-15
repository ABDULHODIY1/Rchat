// app.js

// STUN server konfiguratsiyasi
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Global o‘zgaruvchilar
let localStream = null;
let peerConnection = null;
let socket = null;

// DOM elementlarini olish
const el = id => document.getElementById(id);
const localVideo   = el('localVideo');
const remoteVideo  = el('remoteVideo');
const toggleCamera = el('toggleCamera');
const toggleMic    = el('toggleMic');
const nextChat     = el('nextChat');
const liveUsers    = el('liveUsers');

// 1️⃣ Media-ni ochish
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localVideo.onloadedmetadata = () => localVideo.play();

    // Kamera yoqish/o‘chirish
    toggleCamera.addEventListener('click', () => {
      const track = localStream.getVideoTracks()[0];
      track.enabled = !track.enabled;
      toggleCamera.innerHTML = `<i class="bi bi-camera-video${track.enabled ? '' : '-off'}"></i>`;
    });

    // Mikrofon yoqish/o‘chirish
    toggleMic.addEventListener('click', () => {
      const track = localStream.getAudioTracks()[0];
      track.enabled = !track.enabled;
      toggleMic.innerHTML = `<i class="bi bi-mic${track.enabled ? '' : '-mute'}"></i>`;
    });

  } catch (err) {
    alert('Kamera yoki mikrofon ruxsatini bermadingiz!');
    console.error(err);
  }
}

// 2️⃣ PeerConnection yaratish
function createPeer() {
  // Eski aloqani tozalash
  if (peerConnection) peerConnection.close();

  peerConnection = new RTCPeerConnection(config);

  // Mahalliy tracklarni qo‘shish
  localStream.getTracks().forEach(track =>
    peerConnection.addTrack(track, localStream)
  );

  // ICE candidate topilganda signaling orqali jo‘natish
  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', { candidate: e.candidate });
    }
  };

  // Masofaviy stream kelganda video elementga ulash
  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.onloadedmetadata = () => remoteVideo.play();
  };
}

// 3️⃣ Socket.IO bilan integratsiya
function initSocket() {
  socket = io();

  socket.on('connect', () =>
    console.log('Socket.io ulanildi:', socket.id)
  );

  // Jonli foydalanuvchilar soni
  socket.on('user-count', count => {
    liveUsers.textContent = `👥 Users: ${count}`;
  });

  // Juftlashuv (paired) event – yangi aloqani boshlash
  socket.on('paired', async ({ initiator }) => {
    createPeer();

    // Faqat initiator (taklifchi) bitta offer yaratadi
    if (initiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { description: peerConnection.localDescription });
    }
  });

  // Signaling: offer, answer, ICE candidatelarni qabul qilish
  socket.on('signal', async data => {
    if (!peerConnection) createPeer();

    // OFFER qabul qilish
    if (data.description?.type === 'offer' &&
        peerConnection.signalingState === 'stable') {
      await peerConnection.setRemoteDescription(data.description);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { description: peerConnection.localDescription });

    // ANSWER qabul qilish
    } else if (data.description?.type === 'answer' &&
               peerConnection.signalingState === 'have-local-offer') {
      await peerConnection.setRemoteDescription(data.description);

    // ICE candidate qabul qilish
    } else if (data.candidate &&
               peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(data.candidate);
    }
  });

  // Hamroh uzilganda tozalash
  socket.on('partner-disconnected', () => {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
  });

  // Keyingi suhbat
  nextChat.addEventListener('click', () => socket.emit('next'));
}

// 4️⃣ Dastur boshlanishi
(async () => {
  await initMedia();
  initSocket();
})();
