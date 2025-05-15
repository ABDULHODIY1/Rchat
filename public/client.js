// public/client.js
(() => {
  const startBtn = document.getElementById('startBtn');
  const videosContainer = document.getElementById('videos');
  const controls = document.getElementById('controls');
  const localVid = document.getElementById('localVideo');
  const remoteVid = document.getElementById('remoteVideo');
  let socket, pc, localStream, partnerId;
  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  startBtn.onclick = async () => {
    startBtn.disabled = true;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVid.srcObject = localStream;
      await localVid.play();
    } catch (err) {
      alert('Camera/mic access needed!');
      console.error(err);
      startBtn.disabled = false;
      return;
    }
    videosContainer.classList.remove('hidden');
    controls.classList.remove('hidden');
    initSocket();
  };

  function createPeer(initiator) {
    pc = new RTCPeerConnection(config);
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('signal', e.candidate);
    };
    pc.ontrack = e => {
      remoteVid.srcObject = e.streams[0];
      remoteVid.play().catch(console.warn);
    };

    if (initiator) {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => socket.emit('signal', pc.localDescription));
    }
  }

  function cleanup() {
    if (pc) { pc.close(); pc = null; }
    remoteVid.srcObject = null;
  }

  function initSocket() {
    socket = io();
    socket.on('paired', ({ initiator, partner }) => {
      partnerId = partner;
      cleanup();
      createPeer(initiator);
    });
    socket.on('signal', async data => {
      if (!pc) createPeer(false);
      if (data.type) {
        await pc.setRemoteDescription(data);
        if (data.type === 'offer') {
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          socket.emit('signal', pc.localDescription);
        }
      } else {
        await pc.addIceCandidate(data);
      }
    });
    socket.on('partner-disconnected', () => cleanup());

    document.getElementById('nextBtn').onclick = () => { socket.emit('next'); cleanup(); };
    document.getElementById('discBtn').onclick = () => { socket.disconnect(); cleanup(); };
  }
})();
