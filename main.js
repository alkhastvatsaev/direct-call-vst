import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push, onChildAdded, remove } from "firebase/database";

const firebaseConfig = {
  projectId: "direct-call-vatsaev-123",
  appId: "1:654046710966:web:853363024e93d85b93aa17",
  apiKey: "AIzaSyBOw4dsLEnblkOlcENw6TPluKyN0NL8APw",
  authDomain: "direct-call-vatsaev-123.firebaseapp.com",
  databaseURL: "https://direct-call-vatsaev-123-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const servers = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
  iceCandidatePoolSize: 10,
};

let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const HUBBY_ID = 'alkhast';
const WIFEY_ID = 'sheila';
let userRole = localStorage.getItem('direct_call_role'); 

const sphereAlkhast = document.getElementById('sphere-alkhast');
const sphereSheila = document.getElementById('sphere-sheila');
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
      <button id="set-alkhast">Alkhast (Mari)</button>
      <button id="set-sheila">Sheïla (Femme)</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('set-alkhast').onclick = () => { localStorage.setItem('direct_call_role', 'hubby'); location.reload(); };
  document.getElementById('set-sheila').onclick = () => { localStorage.setItem('direct_call_role', 'wifey'); location.reload(); };
}

async function initApp() {
  statusText.innerText = "ACCÈS MICRO...";
  localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 } });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Visualizer pour MOI
  const mySphere = userRole === 'hubby' ? sphereAlkhast : sphereSheila;
  startVisualizer(localStream, mySphere);

  pc.ontrack = (event) => {
    remoteStream = event.streams[0];
    const audio = new Audio();
    audio.srcObject = remoteStream;
    audio.play().catch(() => { document.body.onclick = () => audio.play(); });
    statusText.innerText = "EN LIGNE (NASA STABLE)";
    const targetSphere = userRole === 'hubby' ? sphereSheila : sphereAlkhast;
    startVisualizer(remoteStream, targetSphere);
  };

  const callDoc = ref(db, `calls/alkhast-sheila`);
  const offerCandidates = ref(db, `calls/alkhast-sheila/offerCandidates`);
  const answerCandidates = ref(db, `calls/alkhast-sheila/answerCandidates`);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidatesRef = userRole === 'hubby' ? offerCandidates : answerCandidates;
      push(candidatesRef, event.candidate.toJSON());
    }
  };

  // Logique Hubby (Caller)
  if (userRole === 'hubby') {
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    await set(callDoc, { sdp: offerDescription.sdp, type: offerDescription.type });

    onValue(callDoc, async (snapshot) => {
      const data = snapshot.val();
      if (!pc.currentRemoteDescription && data?.type === 'answer') {
        const answerDescription = new RTCSessionDescription(data);
        await pc.setRemoteDescription(answerDescription);
      }
    });

    onChildAdded(answerCandidates, (snapshot) => {
      const candidate = new RTCIceCandidate(snapshot.val());
      pc.addIceCandidate(candidate);
    });
  } 
  
  // Logique Wifey (Receiver)
  else {
    onValue(callDoc, async (snapshot) => {
      const data = snapshot.val();
      if (!pc.currentRemoteDescription && data?.type === 'offer') {
        const offerDescription = new RTCSessionDescription(data);
        await pc.setRemoteDescription(offerDescription);
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);
        await set(callDoc, { sdp: answerDescription.sdp, type: answerDescription.type });
      }
    });

    onChildAdded(offerCandidates, (snapshot) => {
      const candidate = new RTCIceCandidate(snapshot.val());
      pc.addIceCandidate(candidate);
    });
  }

  statusText.innerText = "RECHERCHE LIGNE...";
}

function startVisualizer(stream, element) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  source.connect(analyser);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function animate() {
    analyser.getByteFrequencyData(dataArray);
    let volume = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
    element.style.transform = `scale(${1 + (volume / 100)})`;
    element.style.opacity = 0.3 + (volume / 200);
    requestAnimationFrame(animate);
  }
  animate();
}
