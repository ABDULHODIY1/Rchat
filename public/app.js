// app.js
// Shu tarzda yozsangiz—mydomain.onrender.com kabi hozirgi host-ga ulanadi
const socket = io();
let localStream, peerConnection;
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const el = id => document.getElementById(id);
const localVideo = el('localVideo');
const remoteVideo = el('remoteVideo');
const toggleCamera = el('toggleCamera');
const toggleMic = el('toggleMic');
const nextChat = el('nextChat');
const liveUsers = el('liveUsers');

// 1. Kamera va mikrofonni ochamiz
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    console.log("Media initialized:", localStream);
  } catch (err) {
    alert("Kamera yoki mikrofonga ruxsat berilmadi!");
    console.error("Media error:", err);
  }
}

// 2. RTCPeerConnection va hodisalarni o‘rnatamiz
function createPeer() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  peerConnection = new RTCPeerConnection(config);

  // O‘z treklarini qo‘shamiz
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // ICE kandidatlari
  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { candidate: e.candidate });
  };

  // Ustunlik bilan remote trek kelganda ishlaydi
  peerConnection.ontrack = event => {
    console.log("Remote track qabul qilindi:", event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
  };
}

// 3. Socket hodisalari
socket.on('connect', () => {
  console.log("Socket.io ulandi:", socket.id);
});

socket.on('paired', async () => {
  console.log('Sherik topildi!');
  createPeer();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { description: peerConnection.localDescription });
});

socket.on('signal', async ({ description, candidate }) => {
  if (!peerConnection) createPeer();

  if (description) {
    await peerConnection.setRemoteDescription(description);
    if (description.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { description: peerConnection.localDescription });
    }
  } else if (candidate) {
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(candidate);
    }
  }
});

socket.on('partner-disconnected', () => {
  console.log('Sherik uzildi');
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
});

socket.on('user-count', count => {
  liveUsers.textContent = `👥 Users: ${count}`;
});

// 4. Tugmalar
toggleMic.addEventListener('click', () => {
  if (localStream) {
    const audio = localStream.getAudioTracks()[0];
    audio.enabled = !audio.enabled;
  }
});

toggleCamera.addEventListener('click', () => {
  if (localStream) {
    const video = localStream.getVideoTracks()[0];
    video.enabled = !video.enabled;
  }
});

nextChat.addEventListener('click', () => {
  socket.emit('next');
});

// Avtomatik media ochish
(async () => {
  await initMedia();
})();
