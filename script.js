// script.js

const allValves = Array.from({ length: 48 }, (_, i) => `Válvula ${i + 1}`);

const sides = {
  A: allValves.slice(0, 12),
  B: allValves.slice(12, 24),
  C: allValves.slice(24, 36),
  D: allValves.slice(36, 48)
};

let currentSide = 'A';
let currentPage = 0;
const pageSize = 6;
const votos = { A: {}, B: {}, C: {}, D: {} };
const confirmadas = { A: {}, B: {}, C: {}, D: {} };
let valvulaAberta = null;

const sideBtns = document.querySelectorAll('.side-btn');
const sideTitle = document.getElementById('side-title');
const container = document.getElementById('valvulas-container');
const perguntaContainer = document.getElementById('pergunta-global-container');

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
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
    currentPage = 0;
    initValves();
  };
});

function initValves() {
  sideTitle.textContent = `Lado ${currentSide}`;
  renderValves();
  updateButtons();
  bindListeners();
}

function renderValves() {
  container.innerHTML = '';
  const inicio = currentPage * pageSize;
  const fim = Math.min(inicio + pageSize, sides[currentSide].length);

  for (let i = inicio; i < fim; i++) {
    const nome = sides[currentSide][i];
    const wrapper = document.createElement('div');
    wrapper.className = 'valvula-wrapper';

    const label = document.createElement('div');
    label.className = 'confirmado-texto';
    if (confirmadas[currentSide][i]) {
      label.textContent = `Você confirmou a nota ${votos[currentSide][i]}`;
    }

    const div = document.createElement('div');
    div.className = 'valvula';
    div.textContent = nome;

    if (confirmadas[currentSide][i]) {
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-editar-inside';
      btnEdit.textContent = 'Editar';
      btnEdit.onclick = (e) => {
        e.stopPropagation();
        delete votos[currentSide][i];
        delete confirmadas[currentSide][i];
        valvulaAberta = null;
        initValves();
      };
      div.appendChild(btnEdit);
    } else {
      div.onclick = () => togglePergunta(i, nome);
    }

    wrapper.appendChild(label);
    wrapper.appendChild(div);
    container.appendChild(wrapper);
  }
  updateConfirmar();
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

function updateButtons() {
  const total = sides[currentSide].length;
  btnPrev.disabled = currentPage === 0;
  btnNext.disabled = (currentPage + 1) * pageSize >= total;
  btnReset.style.visibility = Object.keys(votos[currentSide]).length > 0 ? 'visible' : 'hidden';
}

function updateConfirmar() {
  const total = sides[currentSide].length;
  const confirmadasQtd = Object.keys(confirmadas[currentSide]).length;
  document.getElementById('confirmar-container').style.display =
    confirmadasQtd === total ? 'block' : 'none';
}

function bindListeners() {
  btnPrev.onclick = () => {
    currentPage--;
    initValves();
  };
  btnNext.onclick = () => {
    currentPage++;
    initValves();
  };
  btnReset.onclick = () => {
    modalReset.classList.add('show');
  };
  btnSimReset.onclick = () => {
    votos[currentSide] = {};
    confirmadas[currentSide] = {};
    currentPage = 0;
    modalReset.classList.remove('show');
    initValves();
  };
  btnNaoReset.onclick = () => {
    modalReset.classList.remove('show');
  };
  btnConfirmar.onclick = () => {
    modalConfirmar.classList.add('show');
  };
  btnSimConfirmar.onclick = () => {
    modalConfirmar.classList.remove('show');
    mostrarResumo();
  };
  btnNaoConfirmar.onclick = () => {
    modalConfirmar.classList.remove('show');
  };
  btnFecharResumo.onclick = () => {
    modalResumo.classList.remove('show');
  };
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
  let txt = `Autor: ${autor}\nLado: ${currentSide}\n\n`;
  arr.forEach((nome, i) => {
    const nota = votos[currentSide][i] || '—';
    txt += `${nome}: ${nota}\n`;
  });
  resumoTextModal.textContent = txt;
  modalResumo.classList.add('show');
}
