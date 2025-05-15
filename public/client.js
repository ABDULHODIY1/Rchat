
// public/client.js
(function() {
  var startBtn = document.getElementById('startBtn');
  var videos = document.getElementById('videos');
  var controls = document.getElementById('controls');
  var localVid = document.getElementById('localVideo');
  var remoteVid = document.getElementById('remoteVideo');
  var nextBtn = document.getElementById('nextBtn');
  var discBtn = document.getElementById('discBtn');
  var socket, pc, localStream;
  var config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
    ],
    iceTransportPolicy: 'all'
  };

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
    localStream.getTracks().forEach(function(track) {
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = function(e) {
      if (e.candidate && socket) {
        socket.emit('signal', e.candidate);
      }
    };

    pc.ontrack = function(e) {
      remoteVid.srcObject = e.streams[0];
      remoteVid.onloadedmetadata = function() {
        remoteVid.play().catch(console.warn);
      };
    };

    if (initiator) {
      pc.createOffer().then(function(offer) {
        return pc.setLocalDescription(offer);
      }).then(function() {
        socket.emit('signal', pc.localDescription);
      }).catch(console.error);
    }
  }

  function cleanup() {
    if (pc) {
      pc.close();
      pc = null;
    }
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
        pc.setRemoteDescription(data).then(function() {
          if (data.type === 'offer') {
            pc.createAnswer().then(function(answer) {
              pc.setLocalDescription(answer).then(function() {
                socket.emit('signal', pc.localDescription);
              });
            });
          }
        }).catch(console.error);
      } else {
        pc.addIceCandidate(data).catch(console.error);
      }
    });

    socket.on('partner-disconnected', function() {
      cleanup();
    });

    nextBtn.addEventListener('click', function() {
      if (socket) {
        socket.emit('next');
        cleanup();
      }
    });

    discBtn.addEventListener('click', function() {
      if (socket) {
        socket.disconnect();
        cleanup();
      }
    });
  }

})();
