import { Peer } from 'peerjs';

const HUBBY_ID = 'alkhast';
const WIFEY_ID = 'sheila';

const peerConfig = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipskip.com' },
    ],
    iceCandidatePoolSize: 10,
  },
};

let userRole = localStorage.getItem('direct_call_role'); 
let peer;
let localStream;
let activeCall;
let audioContext;
let analyser;

const sphere = document.getElementById('sphere');
const statusText = document.getElementById('status-text');

if (!userRole) {
  showRoleSelector();
} else {
  initApp();
}

function showRoleSelector() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <h2>Qui utilise ce téléphone ?</h2>
    <div class="btn-group">
      <button id="set-alkhast">Mari (Alkhas)</button>
      <button id="set-sheila">Femme (Sheïla)</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('set-alkhast').onclick = () => {
    localStorage.setItem('direct_call_role', 'hubby');
    location.reload();
  };
  document.getElementById('set-sheila').onclick = () => {
    localStorage.setItem('direct_call_role', 'wifey');
    location.reload();
  };
}

async function initApp() {
  const myId = userRole === 'hubby' ? HUBBY_ID : WIFEY_ID;
  const targetId = userRole === 'hubby' ? WIFEY_ID : HUBBY_ID;

  peer = new Peer(myId, peerConfig);

  // Demande micro dès le départ
  await getMedia();

  peer.on('open', () => {
    statusText.innerText = "PRÊT";
    attemptAutoCall(targetId);
  });

  peer.on('call', async (call) => {
    if (!localStream) await getMedia();
    call.answer(localStream);
    handleStream(call);
    activeCall = call;
  });

  peer.on('error', (err) => {
    if (err.type === 'peer-unavailable') {
      statusText.innerText = `RECHERCHE...`;
    }
  });

  // Reconnexion auto
  setInterval(() => {
    if (!activeCall || !activeCall.open) {
      attemptAutoCall(targetId);
    }
  }, 4000);

  // Démarrer l'animation de volume
  if (localStream) startVisualizer(localStream);
}

async function getMedia() {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        latency: 0
      }
    });
    return localStream;
  } catch (err) {
    statusText.innerText = "MICROBLOQUÉ";
    return null;
  }
}

async function attemptAutoCall(targetId) {
  if (!localStream || !peer.open || (activeCall && activeCall.open)) return;
  const call = peer.call(targetId, localStream);
  if (call) {
    activeCall = call;
    handleStream(call);
  }
}

function handleStream(call) {
  call.on('stream', (remoteStream) => {
    const audio = new Audio();
    audio.srcObject = remoteStream;
    audio.play().catch(() => {
      document.body.addEventListener('click', () => audio.play(), { once: true });
    });
    statusText.innerText = "EN LIGNE";
    
    // On visualise le flux distant si on veut (mais ici on va juste faire osciller la sphère centrale)
  });

  call.on('close', () => {
    statusText.innerText = "RECONNEXION...";
    activeCall = null;
  });
}

function startVisualizer(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    let values = 0;
    for (let i = 0; i < dataArray.length; i++) {
      values += dataArray[i];
    }
    const average = values / dataArray.length;
    
    // Scaling de la sphère basé sur le volume
    const scale = 1 + (average / 150);
    sphere.style.transform = `scale(${scale})`;
    
    // Ombre proportionnelle
    if (average > 10) {
       sphere.style.boxShadow = `0 0 ${average/2}px rgba(0,0,0,0.1)`;
    } else {
       sphere.style.boxShadow = 'none';
    }

    requestAnimationFrame(draw);
  }
  draw();
}
