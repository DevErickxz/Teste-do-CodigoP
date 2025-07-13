// statistics.js

let currentStatisticsSide = 'A';
let currentStatisticsArea = 'Caixa';
let currentSelectedValve = null;
let statisticsChart = null;

async function initStatisticsView() {
  currentStatisticsSide = 'A';
  currentStatisticsArea = 'Caixa';
  currentSelectedValve = null;
  updateStatisticsSideButtons();
  updateStatisticsAreaButtons();
  await renderStatisticsValves();
  if (statisticsChart) {
    statisticsChart.destroy();
    statisticsChart = null;
  }
  document.getElementById('statistics-side-title').textContent =
    `Selecione uma Válvula do Lado ${currentStatisticsSide} (${currentStatisticsArea})`;
  // NÃO reiniciamos o período aqui—vamos sempre ler direto na função de geração
  document.getElementById('statistics-periodo-select').value = '7';
}

async function renderStatisticsValves() {
  const container = document.getElementById('valvulas-statistics-container');
  container.innerHTML = '';
  const valvesForSide = getValvesList(currentStatisticsArea, currentStatisticsSide);


  document.getElementById('statistics-side-title').textContent =
    `Selecione uma Válvula do Lado ${currentStatisticsSide} (${currentStatisticsArea})`;

  valvesForSide.forEach(valveName => {
    const div = document.createElement('div');
    div.className = 'valvula-item';
    div.textContent = valveName;
    div.onclick = () => handleValveSelection(valveName);
    if (currentSelectedValve === valveName) div.classList.add('selected');
    container.appendChild(div);
  });
}

async function handleValveSelection(valveName) {
  currentSelectedValve = valveName;
  document
    .querySelectorAll('#valvulas-statistics-container .valvula-item')
    .forEach(item => {
      item.classList.toggle('selected', item.textContent === valveName);
    });
  document.getElementById('statistics-side-title').textContent =
    `Gráfico de Sujeira para ${valveName} (Lado ${currentStatisticsSide}, ${currentStatisticsArea})`;

  // Gera o gráfico **apenas aqui**, lendo o período selecionado
  await generateValveDirtChart(valveName);
}

async function generateValveDirtChart(valveName) {
  const canvas = document.getElementById('grafico-sujeira-valvula');
  if (!canvas) {
    console.error("Canvas 'grafico-sujeira-valvula' não encontrado!");
    return;
  }
  const ctx = canvas.getContext('2d');
  if (statisticsChart) statisticsChart.destroy();

  // 1) Monta e executa a query
  const snapshot = await db.collection('registros')
    .where('lado', '==', currentStatisticsSide)
    .where('area', '==', currentStatisticsArea)
    .get();

  // 2) Extrai somente as entradas da válvula
  const allEntries = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.valvulas && data.valvulas[valveName] !== undefined) {
      allEntries.push({
        data: data.data,  // string ISO
        nota: Number(data.valvulas[valveName])
      });
    }
  });

  // 3) Filtra pelo período atual
  const dias = document.getElementById('statistics-periodo-select').value;  // '7','30' ou 'all'
  let entries = allEntries;
  if (dias !== 'all') {
    const limite = Date.now() - parseInt(dias,10) * 86400000;
    entries = entries.filter(e => new Date(e.data).getTime() >= limite);
  }

  // 4) Ordena por data
  entries.sort((a,b) => new Date(a.data) - new Date(b.data));

  // 5) Prepara arrays para o Chart
  const labels = entries.map(e => {
    const d = new Date(e.data);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const dataPoints = entries.map(e => e.nota);

  // Se não houver dados, exibe mensagem no gráfico
  const hasData = dataPoints.length > 0;
  const finalLabels = hasData ? labels : ['Sem dados'];
  const finalData   = hasData ? dataPoints : [0];

  // 6) Cria o gráfico
  statisticsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: finalLabels,
      datasets: [{
        label: `Nível de Sujeira - ${valveName}`,
        data: finalData,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0,123,255,0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Evolução da Sujeira: ${valveName}`
        }
      },
      scales: {
        x: { title: { display: true, text: 'Data' } },
        y: {
          title: { display: true, text: 'Nota (1–5)' },
          beginAtZero: true,
          max: 5,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

// Botões de LADO
function updateStatisticsSideButtons() {
  document.querySelectorAll('#statistics-view .sides .side-btn')
    .forEach(btn => {
      btn.classList.toggle('active', btn.dataset.side === currentStatisticsSide);
    });
}

// Botões de ÁREA
function updateStatisticsAreaButtons() {
  document.querySelectorAll('#statistics-view .area-button')
    .forEach(btn => {
      btn.classList.toggle(
        'active',
        btn.dataset.area.toLowerCase() === currentStatisticsArea.toLowerCase()
      );
    });
}

// Listeners de clique em LADO e ÁREA
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#statistics-view .sides .side-btn')
    .forEach(btn => btn.addEventListener('click', async () => {
      currentStatisticsSide = btn.dataset.side;
      currentSelectedValve = null;
      updateStatisticsSideButtons();
      renderStatisticsValves();
    }));

  document.querySelectorAll('#statistics-view .area-button')
    .forEach(btn => btn.addEventListener('click', async () => {
      currentStatisticsArea = btn.dataset.area;
      currentSelectedValve = null;
      updateStatisticsAreaButtons();
      renderStatisticsValves();
    }));

  // Inicializa a view
  initStatisticsView();
});
