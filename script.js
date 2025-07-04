// script.js

// --- CONFIGURAÇÃO INICIAL ---
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

// --- ELEMENTOS DO DOM ---
const sideBtns         = document.querySelectorAll('.side-btn');
const sideTitle        = document.getElementById('side-title');
const container        = document.getElementById('valvulas-container');
const perguntaContainer= document.getElementById('pergunta-global-container');
const inputRaizer      = document.getElementById('pressao-raizer');
const inputCaixa       = document.getElementById('pressao-caixa');
const inputUsuario     = document.getElementById('input-usuario');
const modalPerfil      = document.getElementById('modal-perfil');
const btnSalvarPerfil  = document.getElementById('btn-salvar-perfil');
const modalReset       = document.getElementById('modal-reset');
const btnSimReset      = document.getElementById('btn-sim-resetar');
const btnNaoReset      = document.getElementById('btn-nao-resetar');
const modalConfirmar   = document.getElementById('modal-confirmacao-geral');
const btnSimConfirmar  = document.getElementById('btn-sim-confirmar');
const btnNaoConfirmar  = document.getElementById('btn-nao-confirmar');
const modalResumo      = document.getElementById('modal-confirmacao');
const resumoTextModal  = document.getElementById('resumo-text-modal');
const btnFecharResumo  = document.getElementById('btn-fechar-modal');
const btnDownload      = document.getElementById('btn-download-modal');

// Helper para trocar views
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Coloca o usuário e inicializa as válvulas
function startApp() {
  showView('valve-view');
  // Pré-preenche o nome do usuário
  const uid = firebase.auth().currentUser.uid;
  db.collection('users').doc(uid).get()
    .then(doc => { inputUsuario.value = doc.data().nome || ''; })
    .catch(() => { inputUsuario.value = ''; });
  initValves();
}

// --- AUTENTICAÇÃO ---

// LOGIN via e‑mail/senha
document.getElementById('login-form').onsubmit = async e => {
  e.preventDefault();
  try {
    const email = document.getElementById('login-username').value.trim();
    const pwd   = document.getElementById('login-password').value;
    await firebase.auth().signInWithEmailAndPassword(email, pwd);
    startApp();
  } catch {
    alert('E‑mail ou senha inválidos.');
  }
};

// CADASTRO via e‑mail/senha (já pede nome no form)
document.getElementById('register-form').onsubmit = async e => {
  e.preventDefault();
  try {
    const nome  = document.getElementById('reg-nome').value.trim();
    const email = document.getElementById('reg-username').value.trim();
    const pwd   = document.getElementById('reg-password').value;
    if (!nome) { alert('Informe seu nome completo.'); return; }
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, pwd);
    // grava o perfil no Firestore
    await db.collection('users').doc(cred.user.uid).set({ email, nome });
    // usa startApp para pré-preencher e entrar
    startApp();
  } catch (err) {
    alert(err.message);
  }
};

// LOGIN/CADASTRO via Google + link de e‑mail/senha
async function handleGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const user   = result.user;
    const ref    = db.collection('users').doc(user.uid);
    const snap   = await ref.get();
    if (!snap.exists) {
      // primeira vez: pede nome e senha Custom
      modalPerfil.classList.add('show');
      btnSalvarPerfil.onclick = async () => {
        const nome        = document.getElementById('perfil-nome').value.trim();
        const senhaCustom = document.getElementById('perfil-senha').value;
        if (!nome) { alert('Por favor, informe seu nome completo.'); return; }
        // grava perfil no Firestore
        await ref.set({ email: user.email, nome });
        // vincula senha ao Auth, se houver
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
document.getElementById('btn-google').onclick = handleGoogle;
document.getElementById('btn-google-register').onclick = handleGoogle;

// Alterna entre login e registro
document.getElementById('to-register').onclick = e => { e.preventDefault(); showView('register-view'); };
document.getElementById('to-login').onclick    = e => { e.preventDefault(); showView('login-view'); };

// --- LÓGICA DAS VÁLVULAS ---
sideBtns.forEach(btn => {
  btn.onclick = () => {
    currentSide = btn.dataset.side;
    initValves();
  };
});

function initValves() {
  sideTitle.textContent = `Lado ${currentSide}`;
  renderValves();
  updateConfirmar();
  bindListeners();
}

function renderValves() {
  container.innerHTML = '';
  sides[currentSide].forEach((nome, i) => {
    const nota = votos[currentSide][i] || '';
    const div  = document.createElement('div');
    div.className = 'valvula-wrapper';
    div.innerHTML = `
      <div class="valvula ${nota ? `nota-${nota}` : ''}">
        <div class="valvula-label">${nome}</div>
        <div class="nota-label">${nota ? 'Nota: ' + nota : ''}</div>
        ${nota ? `<button class="btn-editar-inside" data-index="${i}">Editar</button>` : ''}
      </div>`;
    div.onclick = () => { if (!nota) togglePergunta(i, nome); };
    if (nota) {
      div.querySelector('.btn-editar-inside').onclick = e => {
        e.stopPropagation();
        togglePergunta(i, nome);
      };
    }
    container.appendChild(div);
  });
}

function togglePergunta(index, nome) {
  if (valvulaAberta === index) {
    perguntaContainer.classList.remove('show');
    setTimeout(() => perguntaContainer.innerHTML = '', 300);
    valvulaAberta = null;
  } else {
    perguntaContainer.innerHTML = '';
    perguntaContainer.classList.add('show');
    const box = document.createElement('div');
    box.className = 'pergunta-container';

    const p = document.createElement('div');
    p.className = 'pergunta';
    p.textContent = `Qual nota (1 a 5) para ${nome}?`;

    const resp = document.createElement('div');
    resp.className = 'respostas';
    [1,2,3,4,5].forEach(n => {
      const btn = document.createElement('button');
      btn.textContent = n;
      btn.onclick = () => {
        votos[currentSide][index] = n;
        confirmadas[currentSide][index] = true;
        perguntaContainer.classList.remove('show');
        setTimeout(() => {
          perguntaContainer.innerHTML = '';
          valvulaAberta = null;
          initValves();
        }, 300);
      };
      resp.appendChild(btn);
    });

    box.appendChild(p);
    box.appendChild(resp);
    perguntaContainer.appendChild(box);
    valvulaAberta = index;
  }
}

function updateConfirmar() {
  const total = sides[currentSide].length;
  const done  = Object.keys(confirmadas[currentSide]).length;
  const ok    = inputRaizer.value.trim() && inputCaixa.value.trim();
  document.getElementById('confirmar-container').style.display =
    (done === total && ok) ? 'block' : 'none';
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
    const blob = new Blob([resumoTextModal.textContent], { type: 'text/plain' }
      
    );
    const a    = document.createElement('a');
    a.href    = URL.createObjectURL(blob);
    a.download = `resumo_Lado_${currentSide}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  inputRaizer.addEventListener('input', updateConfirmar);
  inputCaixa.addEventListener('input', updateConfirmar);
}

async function mostrarResumo() {
  const arr  = sides[currentSide];
  const user = firebase.auth().currentUser;
  const doc  = await db.collection('users').doc(user.uid).get();
  const autor = doc.data().nome || user.email;
  const pr   = inputRaizer.value.trim();
  const pc   = inputCaixa.value.trim();
  const ts   = new Date().toISOString();

  let txt =
    `Autor: ${autor}\n` +
    `Lado: ${currentSide}\n` +
    `Data: ${ts}\n` +
    `Pressão Raizer: ${pr}\n` +
    `Pressão Caixa: ${pc}\n\n`;

  const notas = {};
  arr.forEach((nome, i) => {
    const n = votos[currentSide][i] || '—';
    txt += `${nome}: ${n}\n`;
    notas[nome] = n;
  });

  resumoTextModal.textContent = txt;
  modalResumo.classList.add('show');

  // salva no Firestore
  db.collection('registros').add({
    autor,
    data: ts,
    lado: currentSide,
    pressaoRaizer: pr,
    pressaoCaixa: pc,
    valvulas: notas
  }).catch(err => {
    console.error('Erro ao salvar:', err);
    alert('Falha ao gravar dados.');
  });
}

// --- LOGOUT ---
function logout() {
  firebase.auth().signOut().then(() => location.reload());
}

// GRÁFICO: válvulas com mais nota 5 (mais sujas)
document.getElementById('btn-gerar-grafico').onclick = async () => {
  const dias = parseInt(document.getElementById('periodo-select').value);
  const agora = new Date();
  const limite = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();

  const snapshot = await db.collection('registros')
    .where('data', '>=', limite)
    .get();

  const contagem = {}; // { "Válvula 3": 5, ... }

  snapshot.forEach(doc => {
    const valvulas = doc.data().valvulas || {};
    for (const [nome, nota] of Object.entries(valvulas)) {
      if (nota == 5) {
        contagem[nome] = (contagem[nome] || 0) + 1;
      }
    }
  });

  const labels = Object.keys(contagem);
  const dados = Object.values(contagem);

  if (window.graficoValvulas) window.graficoValvulas.destroy();

  const ctx = document.getElementById('grafico-valvulas').getContext('2d');
  window.graficoValvulas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Notas 5 (mais sujas)',
        data: dados,
        backgroundColor: '#ff4d4d'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Válvulas mais sujas nos últimos ${dias} dias`
        },
        legend: { display: false }
      },
      scales: {
        x: { title: { display: true, text: 'Válvula' } },
        y: { title: { display: true, text: 'Qtd de notas 5' }, beginAtZero: true }
      }
    }
  });
};


