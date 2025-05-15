
// public/client.js
(function() {
  var startBtn = document.getElementById('startBtn');
  var videos = document.getElementById('videos');
  var controls = document.getElementById('controls');
  var localVid = document.getElementById('localVideo');
  var remoteVid = document.getElementById('remoteVideo');
  var socket, pc, localStream;
  var config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  startBtn.addEventListener('click', function() {
    startBtn.disabled = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(function(stream) {
        localStream = stream;
        localVid.srcObject = stream;
        return localVid.play();
      })
      .then(function() {
        videos.classList.remove('hidden');
        controls.classList.remove('hidden');
        initSocket();
      })
      .catch(function(err) {
        alert('Allow camera and microphone');
        console.error(err);
        startBtn.disabled = false;
      });
  });

  function createPeer(initiator) {
    pc = new RTCPeerConnection(config);
    localStream.getTracks().forEach(function(track) { pc.addTrack(track, localStream); });

    pc.onicecandidate = function(e) {
      if (e.candidate) socket.emit('signal', e.candidate);
    };
    pc.ontrack = function(e) {
      remoteVid.srcObject = e.streams[0];
      remoteVid.onloadedmetadata = function() {
        remoteVid.play().catch(function(e) { console.warn(e); });
      };
    };

    if (initiator) {
      pc.createOffer()
        .then(function(offer) { return pc.setLocalDescription(offer); })
        .then(function() { socket.emit('signal', pc.localDescription); })
        .catch(console.error);
    }
  }

  function cleanup() {
    if (pc) { pc.close(); pc = null; }
    remoteVid.srcObject = null;
  }

  function initSocket() {
    socket = io();
    socket.on('paired', function(data) {
      cleanup();
      createPeer(data.initiator);
    });
    socket.on('signal', function(data) {
      if (!pc) createPeer(false);
      if (data.type) {
        pc.setRemoteDescription(data)
          .then(function() {
            if (data.type === 'offer') {
              return pc.createAnswer()
                .then(function(ans) { return pc.setLocalDescription(ans); })
                .then(function() { socket.emit('signal', pc.localDescription); });
            }
          })
          .catch(console.error);
      } else {
        pc.addIceCandidate(data).catch(console.error);
      }
    });
    socket.on('partner-disconnected', cleanup);
    document.getElementById('nextBtn').addEventListener('click', function() {
      socket.emit('next'); cleanup();
    });
    document.getElementById('discBtn').addEventListener('click', function() {
      socket.disconnect(); cleanup();
    });
  }
})();
