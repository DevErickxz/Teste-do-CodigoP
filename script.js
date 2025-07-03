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

const sideBtns = document.querySelectorAll('.side-btn');
const sideTitle = document.getElementById('side-title');
const container = document.getElementById('valvulas-container');
const perguntaContainer = document.getElementById('pergunta-global-container');

const btnReset = document.getElementById('btn-reset');
const btnConfirmar = document.getElementById('btn-confirmar');
const modalResumo = document.getElementById('modal-confirmacao');
const resumoTextModal = document.getElementById('resumo-text-modal');
const btnFecharResumo = document.getElementById('btn-fechar-modal');
const btnDownload = document.getElementById('btn-download-modal');

const modalConfirmar = document.getElementById('modal-confirmacao-geral');
const btnSimConfirmar = document.getElementById('btn-sim-confirmar');
const btnNaoConfirmar = document.getElementById('btn-nao-confirmar');

const modalReset = document.getElementById('modal-reset');
const btnSimReset = document.getElementById('btn-sim-resetar');
const btnNaoReset = document.getElementById('btn-nao-resetar');

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
  const lado = sides[currentSide];

  for (let i = 0; i < lado.length; i++) {
    const nome = lado[i];
    const nota = votos[currentSide][i] || '';
    const corClasse = nota ? `nota-${nota}` : '';
    const div = document.createElement('div');
    div.className = `valvula-wrapper`;
    div.innerHTML = `
      <div class="valvula ${corClasse}">
        <div class="valvula-label">${nome}</div>
        <div class="nota-label">${nota ? 'Nota: ' + nota : ''}</div>
        ${nota ? `<button class="btn-editar-inside" data-index="${i}"><i class="fas fa-pen"></i> Editar</button>` : ''}
      </div>
    `;
    div.onclick = () => {
      if (!nota) togglePergunta(i, nome);
    };
    // Se já votou, só o botão editar chama a pergunta
    if (nota) {
      div.querySelector('.btn-editar-inside').onclick = (e) => {
        e.stopPropagation();
        togglePergunta(i, nome);
      };
    }
    container.appendChild(div);
  }
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

    const pergunta = document.createElement('div');
    pergunta.className = 'pergunta';
    pergunta.textContent = `Qual nota (1 a 5) para ${nome}?`;

    const respostas = document.createElement('div');
    respostas.className = 'respostas';
    [1, 2, 3, 4, 5].forEach(n => {
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
      respostas.appendChild(btn);
    });

    box.appendChild(pergunta);
    box.appendChild(respostas);
    perguntaContainer.appendChild(box);
    valvulaAberta = index;
  }
}

function updateConfirmar() {
  const total = sides[currentSide].length;
  const confirmadasQtd = Object.keys(confirmadas[currentSide]).length;
  const pressaoRaizer = document.getElementById('pressao-raizer').value.trim();
  const pressaoCaixa = document.getElementById('pressao-caixa').value.trim();
  document.getElementById('confirmar-container').style.display =
    (confirmadasQtd === total && pressaoRaizer && pressaoCaixa) ? 'block' : 'none';
}

function bindListeners() {
  btnReset.onclick = () => modalReset.classList.add('show');
  btnSimReset.onclick = () => {
    votos[currentSide] = {};
    confirmadas[currentSide] = {};
    modalReset.classList.remove('show');
    initValves();
  };
  btnNaoReset.onclick = () => modalReset.classList.remove('show');

  btnConfirmar.onclick = () => modalConfirmar.classList.add('show');
  btnSimConfirmar.onclick = () => {
    modalConfirmar.classList.remove('show');
    mostrarResumo();
  };
  btnNaoConfirmar.onclick = () => modalConfirmar.classList.remove('show');

  btnFecharResumo.onclick = () => modalResumo.classList.remove('show');
  btnDownload.onclick = () => {
    const blob = new Blob([resumoTextModal.textContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resumo_Lado_${currentSide}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
}

function mostrarResumo() {
  const arr = sides[currentSide];
  const autor = sessionStorage.getItem('loggedInUser') || 'Desconhecido';
  const pressaoRaizer = document.getElementById('pressao-raizer').value.trim();
  const pressaoCaixa = document.getElementById('pressao-caixa').value.trim();
  let txt = `Autor: ${autor}\nLado: ${currentSide}\nPressão Raizer: ${pressaoRaizer}\nPressão Caixa: ${pressaoCaixa}\n\n`;
  arr.forEach((nome, i) => {
    const nota = votos[currentSide][i] || '—';
    txt += `${nome}: ${nota}\n`;
  });
  resumoTextModal.textContent = txt;
  modalResumo.classList.add('show');
}

function logout() {
  sessionStorage.removeItem('loggedInUser');
  location.reload();
}

const inputRaizer = document.getElementById('pressao-raizer');
const inputCaixa = document.getElementById('pressao-caixa');
if (inputRaizer && inputCaixa) {
  inputRaizer.addEventListener('input', updateConfirmar);
  inputCaixa.addEventListener('input', updateConfirmar);
}

document.getElementById('btn-theme-toggle').onclick = function() {
  document.body.classList.toggle('dark');
  // Troca o ícone do botão
  const icon = this.querySelector('i');
  if (document.body.classList.contains('dark')) {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }
};
