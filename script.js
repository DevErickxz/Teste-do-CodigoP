// script.js

// CONFIG INICIAL (estas variáveis podem permanecer fora do listener)
const allValves = Array.from({ length: 48 }, (_, i) => `Válvula ${i + 1}`);
const sides = {
  A: allValves.slice(0, 12),
  B: allValves.slice(12, 24),
  C: allValves.slice(24, 36),
  D: allValves.slice(36, 48)
};
let currentSide = 'A';
let currentArea = 'Raizer'; // Nova variável global para a área atual

// Votos e confirmações agora são aninhados por área e lado
const votos = {
    'Raizer': { A: {}, B: {}, C: {}, D: {} },
    'Caixa': { A: {}, B: {}, C: {}, D: {} }
};
const confirmadas = {
    'Raizer': { A: {}, B: {}, C: {}, D: {} },
    'Caixa': { A: {}, B: {}, C: {}, D: {} }
};

let valvulaAberta = null;

// Declare as variáveis que conterão os elementos DOM.
// Elas devem ser declaradas com 'let' para que possam ser atribuídas posteriormente.
let sideBtns;
let areaBtns; // Nova variável para os botões de área
let sideTitle;
let container;
let perguntaContainer;
let inputRaizer;
let inputCaixa;
let inputUsuario;
let inputArea; // Novo input para a área
let modalPerfil;
let btnSalvarPerfil;
let modalReset;
let btnSimReset;
let btnNaoReset;
let modalConfirmar;
let btnSimConfirmar;
let btnNaoConfirmar;
let modalResumo;
let resumoTextModal;
let btnFecharResumo;
let btnDownload;

// Helper (funções auxiliares)
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startApp() {
  showView('valve-view');
  const uid = firebase.auth().currentUser.uid;
  db.collection('users').doc(uid).get()
    .then(doc => { inputUsuario.value = doc.data().nome || ''; });
  // Inicializa as válvulas para a área e lado padrão
  initValves();
  // Atualiza o display da área no input
  inputArea.value = currentArea;
}

async function handleGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      modalPerfil.classList.add('show');
      btnSalvarPerfil.onclick = async () => {
        const nome = document.getElementById('perfil-nome').value.trim();
        const senhaCustom = document.getElementById('perfil-senha').value;
        if (!nome) { alert('Informe seu nome completo.'); return; }
        await ref.set({ email: user.email, nome });
        if (senhaCustom) {
          const credEmail = firebase.auth.EmailAuthProvider.credential(user.email, senhaCustom);
          await user.linkWithCredential(credEmail);
        }
        modalPerfil.classList.remove('show');
        startApp();
      };
    } else {
      startApp();
    }
  } catch (err) {
    alert('Falha no login com Google: ' + err.message);
  }
}

function initValves() {
  sideTitle.textContent = `Lado ${currentSide} (${currentArea})`; // Atualiza título para incluir a área
  inputArea.value = currentArea; // Atualiza o input da área

  // Garante que o objeto para a área e lado exista
  if (!votos[currentArea][currentSide]) {
      votos[currentArea][currentSide] = {};
  }
  if (!confirmadas[currentArea][currentSide]) {
      confirmadas[currentArea][currentSide] = {};
  }

  const valvs = sides[currentSide];
  valvs.forEach((_, i) => {
    if (!votos[currentArea][currentSide][i]) votos[currentArea][currentSide][i] = 1;
    confirmadas[currentArea][currentSide][i] = true;
  });
  renderValves();
  bindListeners();
  updateActiveAreaButtonValveView(); // Garante que o botão de área esteja ativo
  updateActiveSideButtonValveView(); // Garante que o botão de lado esteja ativo
}

function renderValves() {
  container.innerHTML = '';
  sides[currentSide].forEach((nome, i) => {
    const nota = votos[currentArea][currentSide][i] || 1; // Acessa a nota pela área
    const div = document.createElement('div');
    div.className = 'valvula-wrapper';
    div.innerHTML = `
      <div class="valvula nota-${nota}">
        <div class="valvula-label">${nome}</div>
        <div class="nota-label">Nota: ${nota}</div>
      </div>`;
    div.onclick = () => handleVoto(i, nome);
    container.appendChild(div);
  });
}

function handleVoto(index, nome) {
  const notaAtual = votos[currentArea][currentSide][index]; // Acessa a nota pela área
  if (notaAtual !== undefined && notaAtual !== 1) {
    const deseja = confirm(`Deseja editar a nota de ${nome}?`);
    if (!deseja) return;
  }
  mostrarPergunta(index, nome);
}

function mostrarPergunta(index, nome) {
  perguntaContainer.innerHTML = '';
  perguntaContainer.classList.add('show');
  const box = document.createElement('div');
  box.className = 'pergunta-container';
  const p = document.createElement('div');
  p.className = 'pergunta';
  p.textContent = `Qual nota (1 a 5) para ${nome}?`;
  const resp = document.createElement('div');
  resp.className = 'respostas';
  [1, 2, 3, 4, 5].forEach(n => {
    const btn = document.createElement('button');
    btn.textContent = n;
    btn.onclick = () => {
      votos[currentArea][currentSide][index] = n; // Salva a nota pela área
      perguntaContainer.classList.remove('show');
      setTimeout(() => {
        perguntaContainer.innerHTML = '';
        renderValves();
      }, 300);
    };
    resp.appendChild(btn);
  });
  box.appendChild(p);
  box.appendChild(resp);
  perguntaContainer.appendChild(box);
}

function bindListeners() {
  document.getElementById('btn-reset').onclick = () => modalReset.classList.add('show');
  btnSimReset.onclick = () => {
    votos[currentArea][currentSide] = {}; // Reseta votos da área e lado
    confirmadas[currentArea][currentSide] = {}; // Reseta confirmações da área e lado
    modalReset.classList.remove('show');
    initValves();
  };
  btnNaoReset.onclick = () => modalReset.classList.remove('show');

  document.getElementById('btn-confirmar').onclick = () => modalConfirmar.classList.add('show');
  btnSimConfirmar.onclick = async () => {
    modalConfirmar.classList.remove('show');
    await mostrarResumo();
  };
  btnNaoConfirmar.onclick = () => modalConfirmar.classList.remove('show');

  btnFecharResumo.onclick = () => modalResumo.classList.remove('show');
  btnDownload.onclick = () => {
    const blob = new Blob([resumoTextModal.textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `resumo_${currentArea}_Lado_${currentSide}.txt`; // Nome do arquivo inclui a área
    a.click();
    URL.revokeObjectURL(a.href);
  };
}

async function mostrarResumo() {
  const arr = sides[currentSide];
  const user = firebase.auth().currentUser;
  const doc = await db.collection('users').doc(user.uid).get();
  const autor = doc.data().nome || user.email;
  const pr = inputRaizer.value.trim();
  const pc = inputCaixa.value.trim();
  const ts = new Date().toISOString();

  let txt = `Autor: ${autor}\nÁrea: ${currentArea}\nLado: ${currentSide}\nData: ${ts}\nPressão Raizer: ${pr}\nPressão Caixa: ${pc}\n\n`; // Adiciona área ao resumo
  const notas = {};

  arr.forEach((nome, i) => {
    const n = votos[currentArea][currentSide][i] || 1; // Pega a nota pela área
    txt += `${nome}: ${n}\n`;
    notas[nome] = n;
  });

  resumoTextModal.textContent = txt;
  modalResumo.classList.add('show');

  await db.collection('registros').add({
    autor,
    data: ts,
    lado: currentSide,
    area: currentArea, // Salva a área no Firestore
    pressaoRaizer: pr,
    pressaoCaixa: pc,
    valvulas: notas
  });
}

function logout() {
  firebase.auth().signOut().then(() => location.reload());
}

// Início do listener DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // ELEMENTOS DOM - Atribua os valores aqui dentro
  sideBtns         = document.querySelectorAll('.side-btn');
  areaBtns         = document.querySelectorAll('.area-button'); // Atribui os novos botões de área
  sideTitle        = document.getElementById('side-title');
  container        = document.getElementById('valvulas-container');
  perguntaContainer= document.getElementById('pergunta-global-container');
  inputRaizer      = document.getElementById('pressao-raizer');
  inputCaixa       = document.getElementById('pressao-caixa');
  inputUsuario     = document.getElementById('input-usuario');
  inputArea        = document.getElementById('input-area'); // Atribui o novo input da área
  modalPerfil      = document.getElementById('modal-perfil');
  btnSalvarPerfil  = document.getElementById('btn-salvar-perfil');
  modalReset       = document.getElementById('modal-reset');
  btnSimReset      = document.getElementById('btn-sim-resetar');
  btnNaoReset      = document.getElementById('btn-nao-resetar');
  modalConfirmar   = document.getElementById('modal-confirmacao-geral');
  btnSimConfirmar  = document.getElementById('btn-sim-confirmar');
  btnNaoConfirmar  = document.getElementById('btn-nao-confirmar');
  modalResumo      = document.getElementById('modal-confirmacao');
  resumoTextModal  = document.getElementById('resumo-text-modal');
  btnFecharResumo  = document.getElementById('btn-fechar-modal');
  btnDownload      = document.getElementById('btn-download-modal');

  // AUTENTICAÇÃO
  document.getElementById('login-form').onsubmit = async e => {
    e.preventDefault();
    try {
      const email = document.getElementById('login-username').value.trim();
      const pwd = document.getElementById('login-password').value;
      await firebase.auth().signInWithEmailAndPassword(email, pwd);
      startApp();
    } catch {
      alert('E‑mail ou senha inválidos.');
    }
  };

  document.getElementById('register-form').onsubmit = async e => {
    e.preventDefault();
    try {
      const nome = document.getElementById('reg-nome').value.trim();
      const email = document.getElementById('reg-username').value.trim();
      const pwd = document.getElementById('reg-password').value;
      if (!nome) { alert('Informe seu nome completo.'); return; }
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, pwd);
      await db.collection('users').doc(cred.user.uid).set({ email, nome });
      startApp();
    } catch (err) {
      alert(err.message);
    }
  };

  document.getElementById('btn-google').onclick = handleGoogle;
  document.getElementById('btn-google-register').onclick = handleGoogle;
  document.getElementById('to-register').onclick = e => { e.preventDefault(); showView('register-view'); };
  document.getElementById('to-login').onclick = e => { e.preventDefault(); showView('login-view'); };

  // VÁLVULAS E ÁREAS
  document.querySelectorAll('#valve-view .sides .side-btn').forEach(btn => {
    btn.onclick = () => {
      currentSide = btn.dataset.side;
      initValves();
      updateActiveSideButtonValveView();
    };
  });

  // Listener para os novos botões de área
  document.querySelectorAll('#valve-view .area-button').forEach(btn => {
      btn.addEventListener('click', () => {
          currentArea = btn.dataset.area;
          initValves(); // Re-inicializa as válvulas para a nova área
          updateActiveAreaButtonValveView(); // Atualiza o estado ativo dos botões de área
      });
  });

  // BOTÃO SEMPRE VISÍVEL
  document.getElementById('confirmar-container').style.display = 'block';

  // Chamar bindListeners aqui
  bindListeners();
});