import { Peer } from 'peerjs';

// Configuration for PeerJS.
// We provide STUN servers for NAT traversal.
const config = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  },
};

const peer = new Peer(config);

const callBtn = document.getElementById('call-button');
const statusText = document.getElementById('status-text');
const statusContainer = document.getElementById('status-container');
const visualizer = document.getElementById('visualizer');
const myIdDisplay = document.getElementById('my-id');
const remoteIdInput = document.getElementById('remote-id');
const copyBtn = document.getElementById('copy-id');

let localStream;
let activeCall;

// Initialize Media
async function getMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream = stream;
    console.log('Got local stream');
    return true;
  } catch (err) {
    console.error('Failed to get local stream', err);
    statusText.innerText = 'Accès micro requis';
    return false;
  }
}

// UI State Management
function setCallState(state) {
  if (state === 'calling' || state === 'connected') {
    callBtn.classList.add('calling');
    statusContainer.classList.add('active');
    visualizer.parentElement.classList.add('active');
    
    // Change icon to hangup if connected
    callBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29s-.53-.11-.7-.29c-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
      </svg>
    `;
  } else {
    callBtn.classList.remove('calling');
    statusContainer.classList.remove('active');
    visualizer.parentElement.classList.remove('active');
    
    // Default call icon
    callBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>
    `;
  }
}

// Peer Events
peer.on('open', (id) => {
  myIdDisplay.innerText = id;
});

// Answering a call
peer.on('call', async (call) => {
  if (confirm('Appel entrant. Répondre ?')) {
    const success = await getMedia();
    if (!success) return;
    
    activeCall = call;
    call.answer(localStream);
    handleStream(call);
    setCallState('connected');
    statusText.innerText = 'En conversation...';
  } else {
    call.close();
  }
});

function handleStream(call) {
  call.on('stream', (remoteStream) => {
    // Play Remote stream
    const audio = document.createElement('audio');
    audio.srcObject = remoteStream;
    audio.play();
  });
  
  call.on('close', () => {
    statusText.innerText = "Appel terminé";
    setCallState('idle');
  });

  call.on('error', (err) => {
    console.error('Call error', err);
    statusText.innerText = 'Erreur de connexion';
    setCallState('idle');
  });
}

// Call handling
callBtn.addEventListener('click', async () => {
  if (activeCall && activeCall.open) {
    activeCall.close();
    setCallState('idle');
    statusText.innerText = "Prêt pour l'appel";
  } else {
    const remoteId = remoteIdInput.value.trim();
    if (!remoteId) {
      statusText.innerText = "Entrez l'ID distant";
      return;
    }

    const success = await getMedia();
    if (!success) return;

    statusText.innerText = "Connexion en cours...";
    setCallState('calling');
    
    const call = peer.call(remoteId, localStream);
    activeCall = call;
    handleStream(call);
    
    // PeerJS doesn't have an easy "connected" event for MediaConnection
    // So we assume connected when stream arrives
    call.on('stream', () => {
       statusText.innerText = 'En conversation...';
    });
  }
});

// Copy ID
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(myIdDisplay.innerText);
  copyBtn.innerText = 'COPIÉ !';
  setTimeout(() => copyBtn.innerText = 'COPIER', 2000);
});
