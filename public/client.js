
// public/client.js
(async () => {
  const socket = io();
  let pc, localStream;
  let partnerId;
  const config = { iceServers: [{ urls:'stun:stun.l.google.com:19302' }] };

  const localVid = document.getElementById('localVideo');
  const remoteVid = document.getElementById('remoteVideo');
  const nextBtn = document.getElementById('nextBtn');
  const discBtn = document.getElementById('discBtn');

  // Get user media
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video:true,audio:true });
    localVid.srcObject = localStream;
  } catch(e) { alert('Allow camera/mic'); return; }

  function startPeer(initiator) {
    pc = new RTCPeerConnection(config);
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));

    pc.onicecandidate = e=>{ if(e.candidate) socket.emit('signal', e.candidate); };
    pc.ontrack = e=>{ remoteVid.srcObject = e.streams[0]; };

    if (initiator) {
      pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>{
        socket.emit('signal', pc.localDescription);
      });
    }
  }

  function cleanup() {
    if (pc) { pc.close(); pc=null; }
    remoteVid.srcObject = null;
  }

  socket.on('paired', ({ initiator, partner }) => {
    partnerId = partner;
    cleanup();
    startPeer(initiator);
  });

  socket.on('signal', async data => {
    if (!pc) startPeer(false);
    if (data.type) {
      // offer or answer description
      await pc.setRemoteDescription(data);
      if (data.type==='offer') {
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        socket.emit('signal', pc.localDescription);
      }
    } else {
      // ICE candidate
      await pc.addIceCandidate(data);
    }
  });

  socket.on('partner-disconnected', ()=>{ cleanup(); });

  nextBtn.onclick = ()=>{ socket.emit('next'); cleanup(); };
  discBtn.onclick = ()=>{ socket.disconnect(); cleanup(); };
})();
