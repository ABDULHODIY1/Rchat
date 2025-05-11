
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

async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    toggleCamera.addEventListener('click', () => {
      const vt = localStream.getVideoTracks()[0];
      vt.enabled = !vt.enabled;
      toggleCamera.innerHTML = `<i class="bi bi-camera-video${vt.enabled ? '' : '-off'}"></i>`;
    });

    toggleMic.addEventListener('click', () => {
      const at = localStream.getAudioTracks()[0];
      at.enabled = !at.enabled;
      toggleMic.innerHTML = `<i class="bi bi-mic${at.enabled ? '' : '-mute'}"></i>`;
    });

  } catch (err) {
    alert("Kamera yoki mikrofon ruxsatini bermadingiz!");
    console.error(err);
  }
}

function createPeer() {
  if (peerConnection) peerConnection.close();
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

  peerConnection.onnegotiationneeded = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { description: peerConnection.localDescription });
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { candidate: e.candidate });
  };

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.onloadedmetadata = () => remoteVideo.play();
  };
}

function initSocket() {
  socket = io();
  socket.on('connect', () => console.log('Socket connected:', socket.id));

  socket.on('user-count', count => {
    liveUsers.textContent = `👥 Users: ${count}`;
  });

  socket.on('paired', async ({ initiator }) => {
    createPeer();
    if (initiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { description: peerConnection.localDescription });
    }
  });

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
      if (peerConnection.remoteDescription) await peerConnection.addIceCandidate(data.candidate);
    }
  });

  socket.on('partner-disconnected', () => {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
  });

  nextChat.addEventListener('click', () => socket.emit('next'));
}

(async () => {
  await initMedia();
  initSocket();
})();
```
