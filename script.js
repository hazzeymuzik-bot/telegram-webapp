// Telegram WebApp integration + app logic
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
    tg.expand();
    // apply theme colors if provided
    try {
        const theme = tg.colorScheme; // 'dark' or 'light'
        if (theme === 'dark') document.documentElement.style.background = '#071022';
    } catch(e){}
}

// storage key
const KEY = 'beat_sales_v1';

function loadData(){
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch(e){ return []; }
}

function saveData(arr){
    localStorage.setItem(KEY, JSON.stringify(arr));
    renderAll();
}

function addPurchase(p){
    const arr = loadData();
    arr.unshift(p); // latest first
    saveData(arr);
}

function formatCurrency(v){ return Number(v).toLocaleString('ru-RU') + ' ₽'; }

function renderRecent(){
    const list = document.getElementById('recentList');
    list.innerHTML = '';
    const arr = loadData();
    arr.slice(0,10).forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.beatName}</strong> — ${formatCurrency(item.amount)}<br><small>${item.clientName} ${item.clientUsername ? '('+item.clientUsername+')':''} • ${new Date(item.date).toLocaleString()}</small>`;
        list.appendChild(li);
    });
}

function calcStats(){
    const arr = loadData();
    const total = arr.reduce((s,i)=>s+Number(i.amount),0);
    const sales = arr.length;
    const avg = sales? Math.round(total/sales):0;
    const beats = new Set(arr.map(i=>i.beatName)).size;
    return {total, sales, avg, beats, arr};
}

function renderStats(){
    const s = calcStats();
    document.getElementById('totalIncome').textContent = formatCurrency(s.total);
    document.getElementById('totalSales').textContent = s.sales;
    document.getElementById('avgCheck').textContent = formatCurrency(s.avg);
    document.getElementById('beatsSold').textContent = s.beats;
    renderChart(s.arr);
    // ai simple forecast: average * 30 / period length (demo heuristic)
    const days = Math.max(1, Math.ceil((Date.now() - (s.arr[s.arr.length-1]?.date || Date.now()))/ (1000*60*60*24) ));
    const forecast = Math.round(s.avg * 30); // naive
    document.getElementById('aiResult').textContent = forecast ? formatCurrency(forecast) : '—';
    document.getElementById('aiText').textContent = 'Простейший прогноз на основе среднего чека (демо).';
}

let chartInstance = null;
function renderChart(arr){
    const ctx = document.getElementById('incomeChart').getContext('2d');
    // build daily sums for last 30 days
    const days = 30;
    const map = new Map();
    for(let i=0;i<days;i++){
        const d = new Date(); d.setDate(d.getDate()- (days-1-i)); d.setHours(0,0,0,0);
        map.set(d.toISOString().slice(0,10), 0);
    }
    arr.forEach(it => {
        const d = new Date(it.date); d.setHours(0,0,0,0);
        const key = d.toISOString().slice(0,10);
        if (map.has(key)) map.set(key, map.get(key)+Number(it.amount));
    });
    const labels = Array.from(map.keys()).map(k=>{ const d=new Date(k); return (d.getDate()+' '+['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][d.getMonth()]) });
    const data = Array.from(map.values());
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Доход', data, tension:0.3, fill:true, backgroundColor:'rgba(36,129,204,0.08)', borderColor:'#2481cc' }]},
        options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true}, x:{grid:{display:false}} } }
    });
}

function renderAll(){ renderRecent(); renderStats(); }

// form handling
document.getElementById('purchaseForm').addEventListener('submit', function(e){
    e.preventDefault();
    const amount = Number(document.getElementById('amount').value) || 0;
    const beatName = document.getElementById('beatName').value.trim();
    const clientName = document.getElementById('clientName').value.trim();
    const clientUsername = document.getElementById('clientUsername').value.trim();
    const item = { amount, beatName, clientName, clientUsername, date: Date.now() };
    addPurchase(item);
    // clear minimal fields
    document.getElementById('amount').value = '';
    document.getElementById('beatName').value = '';
    document.getElementById('clientName').value = '';
    document.getElementById('clientUsername').value = '';
    // notify Telegram (optional) — send summary string
    if (tg) {
        try {
            tg.sendData(JSON.stringify({type:'new_purchase', data:item}));
        } catch(e){ /* ignore */ }
    }
});

// export CSV
document.getElementById('exportCsv').addEventListener('click', function(){
    const arr = loadData();
    if (!arr.length) return alert('Нет данных для экспорта.');
    const rows = [['date','amount','beatName','clientName','clientUsername']];
    arr.slice().reverse().forEach(it => rows.push([new Date(it.date).toISOString(), it.amount, it.beatName, it.clientName, it.clientUsername]));
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'beat_sales.csv'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
});

// send summary to chat via tg.MainButton or sendData
document.getElementById('sendSummary').addEventListener('click', function(){
    const s = calcStats();
    const text = `Отчет: доход ${s.total} ₽, продаж ${s.sales}, средний чек ${s.avg} ₽`;
    if (tg) {
        try { tg.sendData(JSON.stringify({type:'summary', text})); } catch(e){ alert(text); }
    } else { alert(text); }
});

// tabs
document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', function(){
        document.querySelectorAll('.tab-button').forEach(b=>b.classList.remove('active'));
        this.classList.add('active');
        const target = this.dataset.target;
        document.querySelectorAll('.tab-content').forEach(tc=>tc.classList.remove('active'));
        document.getElementById(target).classList.add('active');
    });
});

// initial render
renderAll();
