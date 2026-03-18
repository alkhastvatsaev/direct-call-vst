import { Peer } from 'peerjs';

const config = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};

let userRole = localStorage.getItem('direct_call_role'); // 'hubby' or 'wifey'
let peer;
let localStream;
let activeCall;
let callInterval;

const statusText = document.getElementById('status-text');
const statusContainer = document.getElementById('status-container');
const visualizer = document.getElementById('visualizer');
const app = document.getElementById('app');

// Initialization
if (!userRole) {
  showRoleSelector();
} else {
  initApp();
}

function showRoleSelector() {
  const overlay = document.createElement('div');
  overlay.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #0A0A0B; display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 100; gap: 2rem;
  `;
  overlay.innerHTML = `
    <h2 style="font-weight: 300; color: #FFF;">Qui utilise ce téléphone ?</h2>
    <div style="display: flex; gap: 1rem;">
      <button id="set-hubbox" style="padding: 1rem 2rem; border-radius: 12px; border: 1px solid #00E676; background: transparent; color: #00E676; cursor: pointer;">Moi (Mari)</button>
      <button id="set-wifey" style="padding: 1rem 2rem; border-radius: 12px; border: 1px solid #FFF; background: transparent; color: #FFF; cursor: pointer;">Ma Femme</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('set-hubbox').onclick = () => {
    localStorage.setItem('direct_call_role', 'hubby');
    location.reload();
  };
  document.getElementById('set-wifey').onclick = () => {
    localStorage.setItem('direct_call_role', 'wifey');
    location.reload();
  };
}

async function initApp() {
  const myId = userRole === 'hubby' ? 'alkhast-hubby-unique' : 'alkhast-wifey-unique';
  const targetId = userRole === 'hubby' ? 'alkhast-wifey-unique' : 'alkhast-hubby-unique';

  peer = new Peer(myId, config);

  statusText.innerText = "Recherche de connexion...";

  peer.on('open', (id) => {
    console.log('My ID:', id);
    if (!localStream) startAutoCall(targetId);
  });

  peer.on('call', async (call) => {
    const stream = await getMedia();
    if (!stream) return;
    
    call.answer(stream);
    handleStream(call);
    activeCall = call;
    setUI(true);
  });

  peer.on('error', (err) => {
    console.log('Peer error:', err);
    if (err.type === 'peer-unavailable') {
      // It's fine, the other person is just not online yet
    }
  });

  // Keep alive / retry
  callInterval = setInterval(() => {
    if (!activeCall || !activeCall.open) {
      startAutoCall(targetId);
    }
  }, 5000);
}

async function getMedia() {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return localStream;
  } catch (err) {
    statusText.innerText = "微Accès Micro Requis !";
    return null;
  }
}

async function startAutoCall(targetId) {
  const stream = await getMedia();
  if (!stream) return;

  const call = peer.call(targetId, stream);
  if (call) {
    activeCall = call;
    handleStream(call);
  }
}

function handleStream(call) {
  call.on('stream', (remoteStream) => {
    const audio = new Audio();
    audio.srcObject = remoteStream;
    audio.play();
    setUI(true);
    statusText.innerText = "LIGNE OUVERTE - DIRECT";
  });

  call.on('close', () => {
    setUI(false);
    statusText.innerText = "Recherche de l'autre...";
  });
}

function setUI(active) {
  if (active) {
    statusContainer.classList.add('active');
    visualizer.parentElement.classList.add('active');
    document.getElementById('call-button').classList.add('calling');
  } else {
    statusContainer.classList.remove('active');
    visualizer.parentElement.classList.remove('active');
    document.getElementById('call-button').classList.remove('calling');
  }
}
