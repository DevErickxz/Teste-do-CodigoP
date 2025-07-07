// statistics.js

// Variáveis globais para a view de estatísticas
let currentStatisticsSide = 'A';
let currentStatisticsArea = 'Raizer'; // Nova variável para a área nas estatísticas
let currentSelectedValve = null;
let statisticsChart = null; // Para o gráfico de linha

// Função para inicializar a view de estatísticas
async function initStatisticsView() {
    // Garante que o lado padrão seja 'A' e a área padrão seja 'Raizer'
    currentStatisticsSide = 'A';
    currentStatisticsArea = 'Raizer';
    currentSelectedValve = null;
    updateStatisticsSideButtons();
    updateStatisticsAreaButtons(); // Atualiza os botões de área das estatísticas
    await renderStatisticsValves(); // Renderiza as válvulas do lado A e da área Raizer
    // Limpa o gráfico existente, se houver
    if (statisticsChart) {
        statisticsChart.destroy();
        statisticsChart = null;
    }
    document.getElementById('statistics-side-title').textContent = `Selecione uma Válvula do Lado ${currentStatisticsSide} (${currentStatisticsArea})`;
    // Resetar o seletor de período para o padrão
    document.getElementById('statistics-periodo-select').value = '7';
}

// Renderiza as válvulas para o lado e área selecionados na view de estatísticas
// Agora recebe dateFilter para filtrar a lista de válvulas disponíveis
async function renderStatisticsValves(dateFilter = null, area = currentStatisticsArea, side = currentStatisticsSide) {
    const container = document.getElementById('valvulas-statistics-container');
    container.innerHTML = '';
    const valvesForSide = sides[side];

    let query = db.collection('registros')
        .where('lado', '==', side)
        .where('area', '==', area)
        .orderBy('data', 'asc');

    let titleText = `Selecione uma Válvula do Lado ${side} (${area})`;

    if (dateFilter) {
        const selectedDate = new Date(dateFilter);
        selectedDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(selectedDate);
        nextDay.setDate(selectedDate.getDate() + 1);

        const startOfDayISO = selectedDate.toISOString();
        const startOfNextDayISO = nextDay.toISOString();

        query = query
            .where('data', '>=', startOfDayISO)
            .where('data', '<', startOfNextDayISO);
        
        titleText = `Selecione uma Válvula do Lado ${side} (${area}) em ${formatarData(selectedDate.toISOString())}`;
    }

    const snapshot = await query.get();
    const valvesWithData = new Set(); // Para armazenar apenas as válvulas que têm dados no dia/filtros

    snapshot.forEach(doc => {
        const valvulas = doc.data().valvulas || {};
        Object.keys(valvulas).forEach(valveName => {
            valvesWithData.add(valveName);
        });
    });

    document.getElementById('statistics-side-title').textContent = titleText;


    valvesForSide.forEach((valveName, index) => {
        // Renderiza a válvula apenas se ela tiver dados para o filtro aplicado
        if (dateFilter && !valvesWithData.has(valveName)) {
            return; // Pula esta válvula se não houver dados para o filtro de data
        }

        const div = document.createElement('div');
        div.className = 'valvula-item';
        div.textContent = valveName;
        div.dataset.valveIndex = index; // Armazena o índice da válvula no lado (0-11)

        // Adiciona classe 'selected' se for a válvula atualmente selecionada
        if (currentSelectedValve === valveName) {
            div.classList.add('selected');
        }

        div.onclick = () => handleValveSelection(valveName, index, dateFilter, area, side); // Passa os filtros
        container.appendChild(div);
    });
}

// Lida com a seleção de uma válvula na view de estatísticas
// Agora aceita dateFilter, area e side para passar para generateValveDirtChart
async function handleValveSelection(valveName, valveIndex, dateFilter = null, area = currentStatisticsArea, side = currentStatisticsSide) {
    currentSelectedValve = valveName;

    // Atualiza a classe 'selected' nos itens da lista de válvulas
    document.querySelectorAll('#valvulas-statistics-container .valvula-item, #searched-valvulas-statistics-container .valvula-item').forEach(item => {
        if (item.textContent === valveName) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    const titleElement = document.getElementById('searched-statistics-title'); // Usar o título da pesquisa
    titleElement.textContent = `Gráfico de Sujeira para ${valveName} (Lado ${side}, ${area})`;
    if (dateFilter) {
        titleElement.textContent += ` em ${formatarData(dateFilter)}`;
    }
    
    // Passa os filtros para a função de geração de gráfico
    await generateValveDirtChart(valveName, dateFilter, area, side);
}

// Gera o gráfico de linha para a sujeira de uma válvula específica
// Adaptação para aceitar dateFilter, area e side para consultas
async function generateValveDirtChart(valveName, dateFilter = null, area = currentStatisticsArea, side = currentStatisticsSide) {
    const ctx = document.getElementById('searched-grafico-sujeira-valvula').getContext('2d');

    // Destruir gráfico existente para evitar sobreposição
    if (searchedStatisticsChart) {
        searchedStatisticsChart.destroy();
    }

    let query = db.collection('registros')
        .where('lado', '==', side)
        .where('area', '==', area)
        .orderBy('data', 'asc'); // Ordena por data para o gráfico de linha

    let chartTitle = `Evolução do Nível de Sujeira de ${valveName} (${area} - Lado ${side})`;

    if (dateFilter) {
        // Para filtrar por um dia específico, precisamos de um range que cubra o dia inteiro
        const selectedDate = new Date(dateFilter);
        selectedDate.setHours(0, 0, 0, 0); // Início do dia
        const nextDay = new Date(selectedDate);
        nextDay.setDate(selectedDate.getDate() + 1); // Início do próximo dia

        const startOfDayISO = selectedDate.toISOString();
        const startOfNextDayISO = nextDay.toISOString();

        query = query
            .where('data', '>=', startOfDayISO)
            .where('data', '<', startOfNextDayISO);
        
        chartTitle = `Nível de Sujeira de ${valveName} (${area} - Lado ${side}) em ${formatarData(selectedDate.toISOString())}`;

    } else {
        // Lógica de período de 7 ou 30 dias para uso fora da pesquisa específica
        const periodoSelect = document.getElementById('statistics-periodo-select');
        const dias = periodoSelect ? periodoSelect.value : '7'; // Padrão 7 se não houver select

        if (dias !== 'all') {
            const numDays = parseInt(dias);
            const agora = new Date();
            const limite = new Date(agora.getTime() - numDays * 86400000);
            limite.setHours(0, 0, 0, 0); // Zera a hora para pegar desde o início do dia
            const limiteISO = limite.toISOString();
            query = query.where('data', '>=', limiteISO);
        }
    }


    const snapshot = await query.get();

    const dates = [];
    const dirtScores = [];
    const uniqueDates = new Set(); // Para garantir que cada dia apareça apenas uma vez se houver múltiplos registros no mesmo dia

    snapshot.forEach(doc => {
        const docDate = formatarData(doc.data().data);
        const valvulas = doc.data().valvulas || {};

        if (valvulas[valveName] !== undefined && !uniqueDates.has(docDate)) {
            dates.push(docDate);
            dirtScores.push(parseInt(valvulas[valveName]));
            uniqueDates.add(docDate);
        }
    });

    searchedStatisticsChart = new Chart(ctx, {
        type: 'line', // Tipo de gráfico de linha
        data: {
            labels: dates.length ? dates : ['Nenhum dado'],
            datasets: [{
                label: `Nível de Sujeira - ${valveName}`,
                data: dates.length ? dirtScores : [0],
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.4 // Deixa a linha curvada
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: chartTitle,
                    font: {
                        size: 16
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Nível de Sujeira (Nota)'
                    },
                    beginAtZero: true,
                    max: 5, // Notas vão de 1 a 5
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                }
            }
        }
    });
    document.getElementById('btn-baixar-searched-statistics-chart').style.display = 'block';
}


// Função para renderizar as válvulas na área de pesquisa de estatísticas
// Este é uma nova função para a pesquisa, diferente de renderStatisticsValves
async function renderSearchedStatisticsValves(dateFilter, area, side) {
    const container = document.getElementById('searched-valvulas-statistics-container');
    container.innerHTML = '';
    const valvesForSide = sides[side];

    let query = db.collection('registros')
        .where('lado', '==', side)
        .where('area', '==', area)
        .orderBy('data', 'asc'); // Ordena por data para o gráfico de linha

    const titleElement = document.getElementById('searched-statistics-title');
    titleElement.textContent = `Selecione uma Válvula do Lado ${side} (${area})`;
    if (dateFilter) {
        const selectedDate = new Date(dateFilter);
        titleElement.textContent += ` em ${formatarData(selectedDate.toISOString())}`;
        
        const nextDay = new Date(selectedDate);
        nextDay.setDate(selectedDate.getDate() + 1);

        const startOfDayISO = selectedDate.toISOString();
        const startOfNextDayISO = nextDay.toISOString();

        query = query
            .where('data', '>=', startOfDayISO)
            .where('data', '<', startOfNextDayISO);
    }
    
    const snapshot = await query.get();
    const valvesWithData = new Set(); // Para armazenar apenas as válvulas que têm dados no dia/filtros

    snapshot.forEach(doc => {
        const valvulas = doc.data().valvulas || {};
        Object.keys(valvulas).forEach(valveName => {
            valvesWithData.add(valveName);
        });
    });

    valvesForSide.forEach((valveName, index) => {
        // Renderiza a válvula apenas se ela tiver dados para o filtro aplicado
        if (!valvesWithData.has(valveName)) {
            return; // Pula esta válvula se não houver dados para o filtro de data
        }

        const div = document.createElement('div');
        div.className = 'valvula-item';
        div.textContent = valveName;
        div.dataset.valveIndex = index;

        div.onclick = () => handleValveSelection(valveName, index, dateFilter, area, side); // Passa os filtros
        container.appendChild(div);
    });

    // Limpa o gráfico de estatísticas se ele existir e nenhuma válvula estiver selecionada
    if (searchedStatisticsChart) {
        searchedStatisticsChart.destroy();
        searchedStatisticsChart = null;
    }
    // Esconde o botão de download até uma válvula ser selecionada
    document.getElementById('btn-baixar-searched-statistics-chart').style.display = 'none';
}


document.addEventListener('DOMContentLoaded', () => {
    // Listeners para os botões de lado das estatísticas
    document.querySelectorAll('#statistics-view .sides .side-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentStatisticsSide = btn.dataset.side;
            currentSelectedValve = null; // Reseta a válvula selecionada ao trocar de lado
            updateStatisticsSideButtons(); // Atualiza o estado ativo dos botões de lado
            await renderStatisticsValves(); // Renderiza as válvulas para o novo lado
            if (statisticsChart) {
                statisticsChart.destroy(); // Destruir gráfico ao trocar de lado
                statisticsChart = null;
            }
            document.getElementById('statistics-side-title').textContent = `Selecione uma Válvula do Lado ${currentStatisticsSide} (${currentStatisticsArea})`;
            // Resetar o seletor de período para o padrão
            document.getElementById('statistics-periodo-select').value = '7';
        });
    });

    // Listeners para os novos botões de ÁREA nas estatísticas
    document.querySelectorAll('#statistics-view .area-button').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentStatisticsArea = btn.dataset.area;
            currentSelectedValve = null; // Reseta a válvula selecionada ao trocar de área
            updateStatisticsAreaButtons(); // Atualiza o estado ativo dos botões de área
            await renderStatisticsValves(); // Renderiza as válvulas para a nova área
            if (statisticsChart) {
                statisticsChart.destroy(); // Destruir gráfico ao trocar de área
                statisticsChart = null;
            }
            document.getElementById('statistics-side-title').textContent = `Selecione uma Válvula do Lado ${currentStatisticsSide} (${currentStatisticsArea})`;
            // Resetar o seletor de período para o padrão
            document.getElementById('statistics-periodo-select').value = '7';
        });
    });

    // Adiciona listener para o seletor de período do gráfico de estatísticas
    document.getElementById('statistics-periodo-select').addEventListener('change', async () => {
        if (currentSelectedValve) { // Apenas regera o gráfico se uma válvula já estiver selecionada
            await generateValveDirtChart(currentSelectedValve);
        }
    });
});