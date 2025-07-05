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
const votos = { A: {}, B: {}, C: {}, D: {} };
const confirmadas = { A: {}, B: {}, C: {}, D: {} };
let valvulaAberta = null;

// Declare as variáveis que conterão os elementos DOM.
// Elas devem ser declaradas com 'let' para que possam ser atribuídas posteriormente.
let sideBtns;
let sideTitle;
let container;
let perguntaContainer;
let inputRaizer;
let inputCaixa;
let inputUsuario;
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
  initValves();
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
  sideTitle.textContent = `Lado ${currentSide}`;
  const valvs = sides[currentSide];
  valvs.forEach((_, i) => {
    if (!votos[currentSide][i]) votos[currentSide][i] = 1;
    confirmadas[currentSide][i] = true;
  });
  renderValves();
  bindListeners();
}

function renderValves() {
  container.innerHTML = '';
  sides[currentSide].forEach((nome, i) => {
    const nota = votos[currentSide][i] || 1;
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
  const notaAtual = votos[currentSide][index];
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
      votos[currentSide][index] = n;
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
    votos[currentSide] = {};
    confirmadas[currentSide] = {};
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
    a.download = `resumo_Lado_${currentSide}.txt`;
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

  let txt = `Autor: ${autor}\nLado: ${currentSide}\nData: ${ts}\nPressão Raizer: ${pr}\nPressão Caixa: ${pc}\n\n`;
  const notas = {};

  arr.forEach((nome, i) => {
    const n = votos[currentSide][i] || 1;
    txt += `${nome}: ${n}\n`;
    notas[nome] = n;
  });

  resumoTextModal.textContent = txt;
  modalResumo.classList.add('show');

  await db.collection('registros').add({
    autor,
    data: ts,
    lado: currentSide,
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
  sideTitle        = document.getElementById('side-title');
  container        = document.getElementById('valvulas-container');
  perguntaContainer= document.getElementById('pergunta-global-container');
  inputRaizer      = document.getElementById('pressao-raizer');
  inputCaixa       = document.getElementById('pressao-caixa');
  inputUsuario     = document.getElementById('input-usuario');
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

  // VÁLVULAS
  sideBtns.forEach(btn => {
    btn.onclick = () => {
      currentSide = btn.dataset.side;
      initValves();
      // Se houver uma função para atualizar o botão ativo na navegação de válvulas, chame-a aqui:
      // updateActiveSideButtonValveView();
    };
  });

  // BOTÃO SEMPRE VISÍVEL
  // Mova esta linha para cá, para garantir que 'confirmar-container' esteja disponível
  document.getElementById('confirmar-container').style.display = 'block';

  // Chamar bindListeners aqui
  bindListeners();
});