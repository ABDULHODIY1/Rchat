//// public/app.js
//
//let localStream, peerConnection;
//const config = {
//  iceServers: [
//    { urls: 'stun:stun.l.google.com:19302' },
//    { urls: 'stun:stun1.l.google.com:19302' }
//  ]
//};
//
//const el = id => document.getElementById(id);
//const localVideo = el('localVideo');
//const remoteVideo = el('remoteVideo');
//const toggleCamera = el('toggleCamera');
//const toggleMic = el('toggleMic');
//const nextChat = el('nextChat');
//const liveUsers = el('liveUsers');
//
//let socket;
//
//// 1️⃣ Media-ni ochish
//async function initMedia() {
//  try {
//    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//    localVideo.srcObject = localStream;
//    console.log("Media initialized:", localStream);
//  } catch (err) {
//    alert("Kamera yoki mikrofon ruxsatini bermadingiz!");
//    console.error("Media error:", err);
//  }
//}
//
//// 2️⃣ PeerConnection va hodisalar
//function createPeer() {
//  if (peerConnection) {
//    peerConnection.close();
//    peerConnection = null;
//  }
//  peerConnection = new RTCPeerConnection(config);
//
//  localStream.getTracks().forEach(track => {
//    peerConnection.addTrack(track, localStream);
//  });
//
//  peerConnection.onicecandidate = e => {
//    if (e.candidate) socket.emit('signal', { candidate: e.candidate });
//  };
//
//  peerConnection.ontrack = event => {
//    console.log("Remote track qabul qilindi:", event.streams[0]);
//    remoteVideo.srcObject = event.streams[0];
//  };
//}
//
//// 3️⃣ Socket.IO-ni init qilish
//function initSocket() {
//  socket = io(); // hozirgi domen/portga ulanadi
//
//  socket.on('connect', () => {
//    console.log("Socket.io ulandi:", socket.id);
//  });
//
//  // paired: { initiator: boolean }
//  socket.on('paired', async ({ initiator }) => {
//    console.log('Sherik topildi! Initiator:', initiator);
//    createPeer();
//
//    if (initiator) {
//      const offer = await peerConnection.createOffer();
//      await peerConnection.setLocalDescription(offer);
//      socket.emit('signal', { description: peerConnection.localDescription });
//    }
//  });
//
//  socket.on('signal', async ({ description, candidate }) => {
//    if (!peerConnection) createPeer();
//
//    if (description) {
//      if (description.type === 'offer') {
//        await peerConnection.setRemoteDescription(description);
//        const answer = await peerConnection.createAnswer();
//        await peerConnection.setLocalDescription(answer);
//        socket.emit('signal', { description: peerConnection.localDescription });
//      } else {
//        await peerConnection.setRemoteDescription(description);
//      }
//    } else if (candidate) {
//      if (peerConnection.remoteDescription) {
//        await peerConnection.addIceCandidate(candidate);
//      }
//    }
//  });
//
//  socket.on('partner-disconnected', () => {
//    console.log('Sherik uzildi');
//    if (peerConnection) {
//      peerConnection.close();
//      peerConnection = null;
//    }
//    remoteVideo.srcObject = null;
//  });
//
//  socket.on('user-count', count => {
//    liveUsers.textContent = `👥 Users: ${count}`;
//  });
//
//  nextChat.addEventListener('click', () => {
//    socket.emit('next');
//  });
//}
//
//// 4️⃣ Boshlanish: media tayyor→socket init
//(async () => {
//  await initMedia();
//  initSocket();
//})();
// public/app.js
let localStream, peerConnection, socket;

// STUN server konfiguratsiyasi
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// DOM elementlarini olish funksiyasi
const el = id => document.getElementById(id);
const localVideo   = el('localVideo');
const remoteVideo  = el('remoteVideo');
const toggleCamera = el('toggleCamera');
const toggleMic    = el('toggleMic');
const nextChat     = el('nextChat');
const liveUsers    = el('liveUsers');

// 1️⃣ Media-ni ochish (kamera + mikrofon)
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // Kamera tugmasi
    toggleCamera.addEventListener('click', () => {
      const track = localStream.getVideoTracks()[0];
      track.enabled = !track.enabled;
      toggleCamera.innerHTML = `<i class="bi bi-camera-video${track.enabled ? '' : '-off'}"></i>`;
    });

    // Mikrofon tugmasi
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

// 2️⃣ PeerConnection yaratish va hodisalar
function createPeer() {
  if (peerConnection) peerConnection.close();
  peerConnection = new RTCPeerConnection(config);

  // Media tracklarini qo'shish
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // Negotiatsiya talab qilinganda offer yuborish
  peerConnection.onnegotiationneeded = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { description: peerConnection.localDescription });
  };

  // ICE candidate almashish
  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { candidate: e.candidate });
  };

  // Masofadagi streamni ko'rsatish
  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.onloadedmetadata = () => remoteVideo.play();
  };
}

// 3️⃣ Socket.IO bilan integratsiya
function initSocket() {
  socket = io();

  // Ulanish
  socket.on('connect', () => console.log('Socket.io ulanildi:', socket.id));

  // Foydalanuvchilar sonini yangilash
  socket.on('user-count', count => {
    liveUsers.textContent = `👥 Users: ${count}`;
  });

  // Juftlashuvni boshlash
  socket.on('paired', async ({ initiator }) => {
    createPeer();
    if (initiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { description: peerConnection.localDescription });
    }
  });

  // Signaling xabarlari
  socket.on('signal', async data => {
    if (!peerConnection) createPeer();
    if (data.description) {
      if (data.description.type === 'offer') {
        await peerConnection.setRemoteDescription(data.description);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { description: peerConnection.localDescription });
      } else {
        await peerConnection.setRemoteDescription(data.description);
      }
    } else if (data.candidate) {
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(data.candidate);
      }
    }
  });

  // Sherik uzilganda
  socket.on('partner-disconnected', () => {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
  });

  // "Next" tugmasi
  nextChat.addEventListener('click', () => socket.emit('next'));
}

// 4️⃣ Dastur boshlanishi
(async () => {
  await initMedia();
  initSocket();
})();