const socket = io();
let localStream, peerConnection;
const el = id => document.getElementById(id);
const localVideo = el('localVideo'), remoteVideo = el('remoteVideo');
const toggleCamera = el('toggleCamera'), toggleMic = el('toggleMic');
const startChat = el('startChat'), nextChat = el('nextChat');
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}
function createPeer() {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
  peerConnection.onicecandidate = e => e.candidate && socket.emit('signal', { candidate: e.candidate });
  peerConnection.ontrack = e => remoteVideo.srcObject = e.streams[0];
}

let chatting = false;
function updateButton() {
  startChat.innerHTML = chatting ? '<i class="bi bi-stop-fill"></i>' : '<i class="bi bi-play-fill"></i>';
}

startChat.addEventListener('click', async () => {
  if (!chatting) {
    if (!localStream) await initMedia();
    socket.emit('start');
  } else {
    socket.emit('next');
  }
  chatting = true;
  updateButton();
});
nextChat.addEventListener('click', () => {
  if (chatting) socket.emit('next');
});
toggleMic.addEventListener('click', () => {
  localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
});
toggleCamera.addEventListener('click', () => {
  localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
});

socket.on('waiting', () => console.log('Waiting for partner...'));
socket.on('paired', async () => {
  createPeer();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { description: peerConnection.localDescription });
});

socket.on('signal', async ({ description, candidate }) => {
  console.log("SIGNAL RECEIVED:", description || candidate);

  if (description) {
    if (!peerConnection) createPeer();
    await peerConnection.setRemoteDescription(description);
    if (description.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { description: peerConnection.localDescription });
    }
  } else if (candidate) {
    await peerConnection.addIceCandidate(candidate);
  }
});

socket.on('partner-disconnected', () => {
  console.log('Partner disconnected');
});

// 🔴 Real-time user count display
socket.on('user-count', count => {
  document.getElementById('liveUsers').textContent = `👥 Users: ${count}`;
});
