// script.js

// CONFIG INICIAL
const allValves = Array.from({ length: 48 }, (_, i) => `Válvula ${i + 1}`);
const sides = {
  A: allValves.slice(0, 12),
  B: allValves.slice(12, 24),
  C: allValves.slice(24, 36),
  D: allValves.slice(36, 48)
};

let currentSide = 'A';
let currentArea = 'Caixa'; // Área atual

// Votos e confirmações aninhados por área e lado
const votos = {
  'Raizer': { A: {}, B: {}, C: {}, D: {} },
  'Caixa':  { A: {}, B: {}, C: {}, D: {} }
};
const confirmadas = {
  'Raizer': { A: {}, B: {}, C: {}, D: {} },
  'Caixa':  { A: {}, B: {}, C: {}, D: {} }
};

// Mapeamento de quantidades por área e lado
const countsByArea = {
  'Raizer': { A: 13, B: 3,  C: 12, D: 5  },
  'Caixa':  { A: 4,  B: 8,  C: 3,  D: 3  }
};

// Quais índices devem ficar quadrados (0‑based) por área→lado
const squareIndices = {
  'Raizer': {
    C: [1],
    D: [2]  // Apenas a Válvula 11 (índice 10) de Raizer C
  },
  'Caixa': {
    // AGORA, 'A' e 'B' estão juntos dentro da mesma chave 'Caixa'
    B: [0, 5], // Válvula 5 (índice 4) e Válvula 10 (índice 9) de Caixa B
    A: [2]    // Válvula 3 (índice 2) de Caixa A
  }
};


// Referências DOM
let sideBtns, areaBtns, sideTitle, container, perguntaContainer;
let inputRaizer, inputCaixa, inputUsuario, inputArea;
let modalPerfil, btnSalvarPerfil, modalReset, btnSimReset, btnNaoReset;
let modalConfirmar, btnSimConfirmar, btnNaoConfirmar;
let modalResumo, resumoTextModal, btnFecharResumo, btnDownload;

// Mostra apenas a view selecionada
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Inicia o app após login
function startApp() {
  showView('valve-view');
  const uid = firebase.auth().currentUser.uid;
  db.collection('users').doc(uid).get()
    .then(doc => inputUsuario.value = doc.data().nome || '');
  initValves();
  inputArea.value = currentArea;
}

// Login via Google
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
        if (!nome) { alert('Informe seu nome completo.'); return; }
        await ref.set({ email: user.email, nome });
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

// Inicializa as válvulas para área/lado atuais
function initValves() {
  sideTitle.textContent = `Lado ${currentSide} (${currentArea})`;
  inputArea.value = currentArea;

  if (!votos[currentArea][currentSide]) votos[currentArea][currentSide] = {};
  if (!confirmadas[currentArea][currentSide]) confirmadas[currentArea][currentSide] = {};

  // Preenche votos padrão = 1
  const count = countsByArea[currentArea][currentSide];
  for (let i = 0; i < count; i++) {
    if (!votos[currentArea][currentSide][i]) votos[currentArea][currentSide][i] = 1;
    confirmadas[currentArea][currentSide][i] = true;
  }

  renderValves();
  bindListeners();
  updateActiveAreaButtonValveView();
  updateActiveSideButtonValveView();
}

// Renderiza as válvulas dinamicamente
function renderValves() {
  container.innerHTML = '';

  // Calcular slice de allValves baseado em countsByArea
  const counts  = countsByArea[currentArea];
  const offsets = {
    A: 0,
    B: counts.A,
    C: counts.A + counts.B,
    D: counts.A + counts.B + counts.C
  };
  const start = offsets[currentSide];
  const num   = counts[currentSide];
  const valvs = allValves.slice(start, start + num);

  valvs.forEach((nome, i) => {
    const nota     = votos[currentArea][currentSide][i] || 1;
    const sqIdxs   = squareIndices[currentArea]?.[currentSide] || [];
    const isSquare = sqIdxs.includes(i);

    const wrapper = document.createElement('div');
    wrapper.className = 'valvula-wrapper';
    wrapper.innerHTML = `
      <div class="valvula nota-${nota}${isSquare ? ' square' : ''}">
        <div class="valvula-label">${nome}</div>
        <div class="nota-label">Nota: ${nota}</div>
      </div>`;
    wrapper.onclick = () => handleVoto(i, nome);
    container.appendChild(wrapper);
  });
}

// Lógica de voto com confirmação de edição
function handleVoto(index, nome) {
  const atual = votos[currentArea][currentSide][index];
  if (atual !== undefined && atual !== 1) {
    if (!confirm(`Deseja editar a nota de ${nome}?`)) return;
  }
  mostrarPergunta(index, nome);
}

// Exibe modal de escolha de nota
function mostrarPergunta(index, nome) {
  perguntaContainer.innerHTML = '';
  perguntaContainer.classList.add('show');
  const box = document.createElement('div');
  box.className = 'pergunta-container';
  box.innerHTML = `
    <div class="pergunta">Qual nota (1 a 5) para ${nome}?</div>
    <div class="respostas">
      ${[1,2,3,4,5].map(n => `<button>${n}</button>`).join('')}
    </div>`;
  // Listener para cada botão
  box.querySelectorAll('.respostas button').forEach((btn, idx) => {
    btn.onclick = () => {
      votos[currentArea][currentSide][index] = idx + 1;
      perguntaContainer.classList.remove('show');
      setTimeout(() => { perguntaContainer.innerHTML = ''; renderValves(); }, 300);
    };
  });
  perguntaContainer.appendChild(box);
}

// Bind de botões de reset, confirmar, download, etc.
function bindListeners() {
  document.getElementById('btn-reset').onclick = () => modalReset.classList.add('show');
  btnSimReset.onclick = () => {
    votos[currentArea][currentSide] = {};
    confirmadas[currentArea][currentSide] = {};
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
    a.download = `resumo_valvulas_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
}

// Gera e salva o resumo no Firestore
async function mostrarResumo() {
  const user = firebase.auth().currentUser;
  const pressaoRaizer = inputRaizer.value;
  const pressaoCaixa = inputCaixa.value;
  const timestamp = new Date().toISOString();
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userName = userDoc.data()?.nome || 'Desconhecido';

  let resumoContent = `Registro de Válvulas\nUsuário: ${userName}\n` +
    `Data/Hora: ${new Date(timestamp).toLocaleString()}\n` +
    `Área: ${currentArea}\nLado: ${currentSide}\n` +
    `Pressão Raizer: ${pressaoRaizer || 'Não informada'}\n` +
    `Pressão Caixa: ${pressaoCaixa || 'Não informada'}\n\n`;

  const registroData = {
    userId: user.uid,
    userName,
    data: timestamp,
    area: currentArea,
    lado: currentSide,
    pressaoRaizer: pressaoRaizer || null,
    pressaoCaixa: pressaoCaixa || null,
    valvulas: {}
  };

  // Prepara dados por válvula
  const count = countsByArea[currentArea][currentSide];
  const start = (() => {
    const counts = countsByArea[currentArea];
    const offs = { A:0, B:counts.A, C:counts.A+counts.B, D:counts.A+counts.B+counts.C };
    return offs[currentSide];
  })();

  for (let i = 0; i < count; i++) {
    const nome = allValves[start + i];
    const nota = votos[currentArea][currentSide][i] || 1;
    resumoContent += `${nome}: Nota ${nota}\n`;
    registroData.valvulas[nome] = nota;
  }

  try {
    await db.collection('registros').add(registroData);
    alert('Registro salvo com sucesso!');
    resumoTextModal.textContent = resumoContent;
    modalResumo.classList.add('show');
  } catch (error) {
    console.error('Erro ao salvar registro:', error);
    alert('Erro ao salvar registro: ' + error.message);
  }
}

// Atualiza highlight dos botões de área e lado
function updateActiveAreaButtonValveView() {
  areaBtns.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.area === currentArea)
  );
}
function updateActiveSideButtonValveView() {
  sideBtns.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.side === currentSide)
  );
}

// Evento inicial
document.addEventListener('DOMContentLoaded', () => {
  // Referências
  sideBtns          = document.querySelectorAll('#valve-view .side-btn');
  areaBtns          = document.querySelectorAll('#valve-view .area-button');
  sideTitle         = document.getElementById('side-title');
  container         = document.getElementById('valvulas-container');
  perguntaContainer = document.getElementById('pergunta-global-container');
  inputRaizer       = document.getElementById('pressao-raizer');
  inputCaixa        = document.getElementById('pressao-caixa');
  inputUsuario      = document.getElementById('input-usuario');
  inputArea         = document.getElementById('input-area');
  modalPerfil       = document.getElementById('modal-perfil');
  btnSalvarPerfil   = document.getElementById('btn-salvar-perfil');
  modalReset        = document.getElementById('modal-reset');
  btnSimReset       = document.getElementById('btn-sim-resetar');
  btnNaoReset       = document.getElementById('btn-nao-resetar');
  modalConfirmar    = document.getElementById('modal-confirmacao-geral');
  btnSimConfirmar   = document.getElementById('btn-sim-confirmar');
  btnNaoConfirmar   = document.getElementById('btn-nao-confirmar');
  modalResumo       = document.getElementById('modal-confirmacao');
  resumoTextModal   = document.getElementById('resumo-text-modal');
  btnFecharResumo   = document.getElementById('btn-fechar-modal');
  btnDownload       = document.getElementById('btn-download-modal');

  // Login/Cadastro
  document.getElementById('login-form').onsubmit = async e => {
    e.preventDefault();
    try {
      await loginUser(
        document.getElementById('login-username').value,
        document.getElementById('login-password').value
      );
      startApp();
    } catch (err) {
      alert('Erro no login: ' + err.message);
    }
  };
  document.getElementById('to-register').onclick = () => showView('register-view');
  document.getElementById('register-form').onsubmit = async e => {
    e.preventDefault();
    try {
      await registerUser(
        document.getElementById('reg-username').value,
        document.getElementById('reg-password').value
      );
      showView('login-view');
    } catch (err) {
      alert('Erro no cadastro: ' + err.message);
    }
  };
  document.getElementById('to-login').onclick = () => showView('login-view');
  document.getElementById('btn-google').onclick = handleGoogle;
  document.getElementById('btn-google-register').onclick = handleGoogle;

  // Botões área/ lado (view válvulas)
  areaBtns.forEach(btn => btn.onclick = () => {
    currentArea = btn.dataset.area;
    initValves();
  });
  sideBtns.forEach(btn => btn.onclick = () => {
    currentSide = btn.dataset.side;
    initValves();
  });
});

function preencherSelectValvulas() {
  const select = document.getElementById('search-valve');
  for (let i = 1; i <= 48; i++) {
    const opt = document.createElement('option');
    opt.value = `Válvula ${i}`;
    opt.textContent = `Válvula ${i}`;
    select.appendChild(opt);
  }
}
document.addEventListener('DOMContentLoaded', preencherSelectValvulas);

