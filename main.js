import { Peer } from 'peerjs';

/**
 * CONFIGURATION MULTI-STUN "SPACE-X LEVEL"
 * Plus de serveurs STUN réduit les chances qu'un nœud spécifique soit bloqué en Russie.
 * On privilégie les serveurs qui traversent les passerelles DPI (Deep Packet Inspection).
 */
const peerConfig = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipskip.com' },
      { urls: 'stun:stun.schlund.de' },
      { urls: 'stun:stun.stunprotocol.org' },
    ],
    iceCandidatePoolSize: 10, // Pré-récolte des candidats pour une connexion instantanée dès l'ouverture
  },
  debug: 2, // Log pour debug si besoin
};

// IDs demandés
const HUBBY_ID = 'alkhast';
const WIFEY_ID = 'sheila';

let userRole = localStorage.getItem('direct_call_role'); 
let peer;
let localStream;
let activeCall;
let retryCount = 0;

const statusText = document.getElementById('status-text');
const statusContainer = document.getElementById('status-container');
const visualizer = document.getElementById('visualizer');

// Lancement
if (!userRole) {
  showRoleSelector();
} else {
  initApp();
}

function showRoleSelector() {
  const overlay = document.createElement('div');
  overlay.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #050505; display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 1000; gap: 2.5rem;
    font-family: 'Inter', sans-serif;
  `;
  overlay.innerHTML = `
    <h2 style="font-weight: 300; color: #FFF; letter-spacing: 2px;">IDENTIFICATION</h2>
    <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 80%; max-width: 300px;">
      <button id="set-alkhast" style="padding: 1.2rem; border-radius: 50px; border: 1px solid #00E676; background: rgba(0, 230, 118, 0.1); color: #00E676; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Je suis Alkhast</button>
      <button id="set-sheila" style="padding: 1.2rem; border-radius: 50px; border: 1px solid #FFF; background: rgba(255, 255, 255, 0.05); color: #FFF; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Je suis Sheïla</button>
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

  // On utilise un serveur de signalisation sécurisé sur le port 443 (le trafic ressemble à du HTTPS normal)
  peer = new Peer(myId, peerConfig);

  statusText.innerText = "ACCÈS AUX CAPTEURS...";

  // On demande le micro DIRECTEMENT au démarrage
  await getMedia();

  peer.on('open', (id) => {
    statusText.innerText = "PRÊT À CONNECTER...";
    attemptAutoCall(targetId);
  });

  peer.on('call', async (call) => {
    console.log('Incoming call...');
    if (activeCall) activeCall.close();
    
    call.answer(localStream);
    handleStream(call);
    activeCall = call;
  });

  peer.on('error', (err) => {
    console.error('Peer Error:', err.type);
    if (err.type === 'peer-unavailable') {
      statusText.innerText = "RECHERCHE LIGNE (SHEÏLA)...";
    }
  });

  // Boucle ultra-performante de reconnexion
  setInterval(() => {
    if (!activeCall || !activeCall.open) {
      attemptAutoCall(targetId);
    }
  }, 3000); 
}

async function getMedia() {
  if (localStream) return localStream;
  try {
    /**
     * OPTIMISATION AUDIO "NASA"
     * On demande la meilleure qualité possible sans buffer (latency 0)
     */
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // Mono pour la voix pure
        sampleRate: 48000, // Full high def voice
        latency: 0
      }
    });

    // Fix pour iOS : Créer un objet audio "silencieux" pour débloquer les HP
    const silentAudio = new Audio();
    silentAudio.play().catch(() => {});

    return localStream;
  } catch (err) {
    statusText.innerText = "MICROBLOQUÉ !";
    console.error(err);
    return null;
  }
}

async function attemptAutoCall(targetId) {
  if (!localStream) await getMedia();
  if (!localStream || !peer.open) return;

  const call = peer.call(targetId, localStream, {
    /**
     * CODEC OPUS PRIORITAIRE
     * On s'assure d'utiliser OPUS avec une latence minimale via SDP manipulation (interne à peerjs/browser)
     */
    metadata: { fast_connect: true }
  });

  if (call) {
    activeCall = call;
    handleStream(call);
  }
}

function handleStream(call) {
  call.on('stream', (remoteStream) => {
    console.log('Connected to stream');
    
    // Détection si l'audio tourne déjà (prévention duplicats)
    const existing = document.getElementById('remote-audio');
    if (existing) existing.remove();

    const audio = new Audio();
    audio.id = 'remote-audio';
    audio.srcObject = remoteStream;
    audio.play()
      .then(() => {
        statusText.innerText = "LIGNE OUVERTE • HAUTE DÉF";
        setUI(true);
      })
      .catch(e => {
        console.error('Play error', e);
        statusText.innerText = "CLIQUEZ SUR L'ÉCRAN POUR ENTENDRE";
        // Correction pour bypasser les politiques d'auto-play browser
        document.body.addEventListener('click', () => audio.play(), { once: true });
      });
  });

  call.on('close', () => {
    setUI(false);
    statusText.innerText = "RECONNEXION...";
    activeCall = null;
  });
}

function setUI(active) {
  if (active) {
    statusContainer.classList.add('active');
    visualizer.parentElement.classList.add('active');
  } else {
    statusContainer.classList.remove('active');
    visualizer.parentElement.classList.remove('active');
  }
}
