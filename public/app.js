// public/app.js

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

let socket;

// 1️⃣ Media-ni ochish
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    console.log("Media initialized:", localStream);
  } catch (err) {
    alert("Kamera yoki mikrofon ruxsatini bermadingiz!");
    console.error("Media error:", err);
  }
}

// 2️⃣ PeerConnection va hodisalar
function createPeer() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { candidate: e.candidate });
  };

  peerConnection.ontrack = event => {
    console.log("Remote track qabul qilindi:", event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
  };
}

// 3️⃣ Socket.IO-ni init qilish
function initSocket() {
  socket = io(); // hozirgi domen/portga ulanadi

  socket.on('connect', () => {
    console.log("Socket.io ulandi:", socket.id);
  });

  // paired: { initiator: boolean }
  socket.on('paired', async ({ initiator }) => {
    console.log('Sherik topildi! Initiator:', initiator);
    createPeer();

    if (initiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { description: peerConnection.localDescription });
    }
  });

  socket.on('signal', async ({ description, candidate }) => {
    if (!peerConnection) createPeer();

    if (description) {
      if (description.type === 'offer') {
        await peerConnection.setRemoteDescription(description);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { description: peerConnection.localDescription });
      } else {
        await peerConnection.setRemoteDescription(description);
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

  nextChat.addEventListener('click', () => {
    socket.emit('next');
  });
}

// 4️⃣ Boshlanish: media tayyor→socket init
(async () => {
  await initMedia();
  initSocket();
})();
