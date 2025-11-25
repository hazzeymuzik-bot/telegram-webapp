
// Финансовый WebApp (client-side)
// Поддерживает: локальную IndexedDB (по умолчанию) и опционально Supabase (если задать URL+KEY).
// Важно: для полноценной серверной БД создайте таблицы в Supabase (expenses, income, categories, savings, recurring, users).
// Параметры Supabase — заполните свои значения:
const SUPABASE_URL = ""; // <-- Вставьте SUPABASE URL или оставьте пустым для локального хранилища
const SUPABASE_ANON_KEY = ""; // <-- Вставьте публичный anon key

// ----------------- Инициализация Supabase (опционально) -----------------
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ----------------- Удобство: определяем userId -----------------
function getUserId() {
  // Попытка получить id из Telegram WebApp (если встроено)
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      const init = tg.initDataUnsafe || tg.initData || {};
      if (init.user && init.user.id) return `tg_${init.user.id}`;
      if (init.user_id) return `tg_${init.user_id}`;
    }
  } catch (e) { /* ignore */ }

  // fallback: сохранённый локально userId
  let uid = localStorage.getItem("fw_user_id");
  if (!uid) {
    uid = "loc_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("fw_user_id", uid);
  }
  return uid;
}

const USER_ID = getUserId();
document.addEventListener("DOMContentLoaded", initApp);

// ----------------- Простая обёртка IndexedDB -----------------
const DB_NAME = "finance_webapp_db_v1";
const DB_VERSION = 1;
let idb = null;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("expenses")) {
        const s = db.createObjectStore("expenses", { keyPath: "id" });
        s.createIndex("by_user", "userId", {unique:false});
        s.createIndex("by_date", "date", {unique:false});
      }
      if (!db.objectStoreNames.contains("income")) {
        const s = db.createObjectStore("income", { keyPath: "id" });
        s.createIndex("by_user", "userId", {unique:false});
        s.createIndex("by_date", "date", {unique:false});
      }
      if (!db.objectStoreNames.contains("categories")) {
        const s = db.createObjectStore("categories", { keyPath: "id" });
        s.createIndex("by_user", "userId", {unique:false});
      }
      if (!db.objectStoreNames.contains("savings")) {
        const s = db.createObjectStore("savings", { keyPath: "id" });
        s.createIndex("by_user", "userId", {unique:false});
      }
      if (!db.objectStoreNames.contains("recurring")) {
        const s = db.createObjectStore("recurring", { keyPath: "id" });
        s.createIndex("by_user", "userId", {unique:false});
      }
    };
    req.onsuccess = (e) => { idb = e.target.result; resolve(idb); };
    req.onerror = (e) => reject(e);
  });
}

async function idbPut(store, obj) {
  if (!idb) await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    s.put(obj);
    tx.oncomplete = () => resolve(obj);
    tx.onerror = (e) => reject(e);
  });
}

async function idbGetAllByUser(store, userId) {
  if (!idb) await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, "readonly");
    const s = tx.objectStore(store);
    const idx = s.index("by_user");
    const req = idx.getAll(IDBKeyRange.only(userId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e);
  });
}

async function idbDelete(store, key) {
  if (!idb) await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    s.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

// ----------------- Утилиты -----------------
function uid(prefix="id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
}

function formatMoney(n) {
  return Number(n).toLocaleString("ru-RU", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// ----------------- UI и логика -----------------
let charts = { pie: null, line: null };

async function initApp() {
  document.getElementById("user-info").innerText = "Пользователь: " + USER_ID;
  await openIdb();

  setupTabs();
  setupForms();
  await ensureDefaultCategories();
  await refreshAll();

  document.getElementById("dark-toggle").addEventListener("change", (e) => {
    document.body.classList.toggle("dark", e.target.checked);
  });

  document.getElementById("export-csv").addEventListener("click", exportAllCSV);
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tabs button");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tabpanel").forEach(t => t.style.display = "none");
      const id = btn.dataset.tab;
      document.getElementById(id).style.display = "block";
    });
  });
}

function setupForms() {
  document.getElementById("expense-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById("expense-amount").value);
    const date = document.getElementById("expense-date").value;
    const category = document.getElementById("expense-category").value;
    const note = document.getElementById("expense-note").value || "";
    if (!amount || !date) return;
    const item = { id: uid("exp"), userId: USER_ID, amount, date, category, note, created_at: new Date().toISOString() };
    await saveItem("expenses", item);
    e.target.reset();
    await refreshAll();
  });

  document.getElementById("income-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById("income-amount").value);
    const date = document.getElementById("income-date").value;
    const category = document.getElementById("income-category").value;
    const note = document.getElementById("income-note").value || "";
    if (!amount || !date) return;
    const item = { id: uid("inc"), userId: USER_ID, amount, date, category, note, created_at: new Date().toISOString() };
    await saveItem("income", item);
    e.target.reset();
    await refreshAll();
  });

  document.getElementById("category-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("category-name").value.trim();
    const color = document.getElementById("category-color").value;
    if (!name) return;
    const c = { id: uid("cat"), userId: USER_ID, name, color };
    await saveItem("categories", c);
    e.target.reset();
    await refreshAll();
  });

  document.getElementById("budget-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = Number(document.getElementById("budget-month").value) || 0;
    const b = { id: USER_ID + "_budget", userId: USER_ID, amount: val, updated_at: new Date().toISOString() };
    await idbPut("savings", b); // reuse savings store for simple settings
    await refreshAll();
  });

  document.getElementById("savings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById("savings-amount").value);
    const note = document.getElementById("savings-note").value || "";
    if (!amount) return;
    const s = { id: uid("sav"), userId: USER_ID, amount, note, created_at: new Date().toISOString() };
    await saveItem("savings", s);
    e.target.reset();
    await refreshAll();
  });

  document.getElementById("recurring-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("recurring-name").value;
    const amount = Number(document.getElementById("recurring-amount").value);
    const type = document.getElementById("recurring-type").value;
    const interval = document.getElementById("recurring-interval").value;
    if (!name || !amount) return;
    const r = { id: uid("rec"), userId: USER_ID, name, amount, type, interval, created_at: new Date().toISOString() };
    await saveItem("recurring", r);
    e.target.reset();
    await refreshAll();
  });

}

async function saveItem(store, item) {
  // Если настроен Supabase — пробуем туда записать (опционально)
  if (supabase) {
    try {
      // NOTE: client cannot create tables — user must create tables manually in Supabase.
      await supabase.from(store).upsert(item);
      return;
    } catch (e) {
      console.warn("Supabase save failed, falling back to local IDB", e);
    }
  }
  // fallback: IndexedDB
  await idbPut(store, item);
}

async function fetchAll(store) {
  if (supabase) {
    try {
      const { data, error } = await supabase.from(store).select("*").eq("userId", USER_ID);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn("Supabase fetch failed, falling back to IDB", e);
    }
  }
  return idbGetAllByUser(store, USER_ID);
}

async function ensureDefaultCategories() {
  const cats = await fetchAll("categories");
  if (!cats || cats.length === 0) {
    const def = [
      { id: uid("cat"), userId: USER_ID, name: "Еда", color: "#f97316" },
      { id: uid("cat"), userId: USER_ID, name: "Транспорт", color: "#60a5fa" },
      { id: uid("cat"), userId: USER_ID, name: "Развлечения", color: "#a78bfa" },
      { id: uid("cat"), userId: USER_ID, name: "Коммуналка", color: "#34d399" }
    ];
    for (const c of def) await saveItem("categories", c);
  }
}

async function refreshAll() {
  await populateCategories();
  await renderExpenses();
  await renderIncome();
  await renderSavings();
  await renderRecurring();
  await updateBudgetSummary();
  await updateCharts();
  updateAnalytics();
}

async function populateCategories() {
  const cats = await fetchAll("categories");
  const expSel = document.getElementById("expense-category");
  const incSel = document.getElementById("income-category");
  expSel.innerHTML = ""; incSel.innerHTML = "";
  cats.forEach(c=>{
    const o = document.createElement("option"); o.value = c.id; o.textContent = c.name; expSel.appendChild(o);
    const o2 = o.cloneNode(true); incSel.appendChild(o2);
  });
  const catsList = document.getElementById("categories-list");
  catsList.innerHTML = cats.map(c=>`<div class="cat-item" data-id="${c.id}"><span class="dot" style="background:${c.color}"></span>${c.name} <button class="del-cat" data-id="${c.id}">Удалить</button></div>`).join("");
  catsList.querySelectorAll(".del-cat").forEach(btn=>{
    btn.addEventListener("click", async () => { await idbDelete("categories", btn.dataset.id); await refreshAll(); });
  });
}

async function renderExpenses() {
  const items = await fetchAll("expenses");
  items.sort((a,b)=> new Date(b.date) - new Date(a.date));
  const el = document.getElementById("expenses-list");
  el.innerHTML = items.slice(0,50).map(it=>`<div class="row"><div>${it.date}</div><div>${formatMoney(it.amount)} ₽</div><div>${it.note||""}</div><div><button class="del-exp" data-id="${it.id}">Удалить</button></div></div>`).join("");
  el.querySelectorAll(".del-exp").forEach(btn=> btn.addEventListener("click", async ()=>{ await idbDelete("expenses", btn.dataset.id); await refreshAll(); }));
}

async function renderIncome() {
  const items = await fetchAll("income");
  items.sort((a,b)=> new Date(b.date) - new Date(a.date));
  const el = document.getElementById("income-list");
  el.innerHTML = items.slice(0,50).map(it=>`<div class="row"><div>${it.date}</div><div>${formatMoney(it.amount)} ₽</div><div>${it.note||""}</div><div><button class="del-inc" data-id="${it.id}">Удалить</button></div></div>`).join("");
  el.querySelectorAll(".del-inc").forEach(btn=> btn.addEventListener("click", async ()=>{ await idbDelete("income", btn.dataset.id); await refreshAll(); }));
}

async function renderSavings() {
  const items = await fetchAll("savings");
  const el = document.getElementById("savings-list");
  if (!items || items.length===0) { el.innerHTML = "<p>Нет сбережений</p>"; return; }
  el.innerHTML = items.map(it=>`<div class="row"><div>${new Date(it.created_at||it.updated_at).toLocaleDateString()}</div><div>${formatMoney(it.amount||0)} ₽</div><div>${it.note||""}</div><div><button class="del-sav" data-id="${it.id}">Удалить</button></div></div>`).join("");
  el.querySelectorAll(".del-sav").forEach(btn=> btn.addEventListener("click", async ()=>{ await idbDelete("savings", btn.dataset.id); await refreshAll(); }));
}

async function renderRecurring() {
  const items = await fetchAll("recurring");
  const el = document.getElementById("recurring-list");
  if (!items || items.length===0) { el.innerHTML = "<p>Нет повторяющихся операций</p>"; return; }
  el.innerHTML = items.map(it=>`<div class="row"><div>${it.name}</div><div>${formatMoney(it.amount)} ₽</div><div>${it.interval}</div><div>${it.type}</div><div><button class="del-rec" data-id="${it.id}">Удалить</button></div></div>`).join("");
  el.querySelectorAll(".del-rec").forEach(btn=> btn.addEventListener("click", async ()=>{ await idbDelete("recurring", btn.dataset.id); await refreshAll(); }));
}

async function updateBudgetSummary() {
  const settings = await idbGetAllByUser("savings", USER_ID);
  const budget = settings.find(s => s.id === USER_ID + "_budget");
  const sumExp = (await fetchAll("expenses")).reduce((s,i)=>s+Number(i.amount||0),0);
  const sumInc = (await fetchAll("income")).reduce((s,i)=>s+Number(i.amount||0),0);
  const el = document.getElementById("budget-summary");
  el.innerHTML = `Доход всего: <strong>${formatMoney(sumInc)} ₽</strong> · Трат всего: <strong>${formatMoney(sumExp)} ₽</strong><br>`;
  if (budget) el.innerHTML += `Месячный бюджет: <strong>${formatMoney(budget.amount)} ₽</strong>`;
}

async function updateCharts() {
  const expenses = await fetchAll("expenses");
  const cats = await fetchAll("categories");
  // Pie by category
  const sums = {};
  expenses.forEach(e => { sums[e.category] = (sums[e.category]||0) + Number(e.amount||0); });
  const labels = Object.keys(sums).map(id => (cats.find(c=>c.id===id)?.name) || id);
  const data = Object.values(sums);
  // Destroy previous
  if (charts.pie) charts.pie.destroy();
  charts.pie = new Chart(document.getElementById("chart-pie"), {
    type: "pie",
    data: { labels, datasets: [{ data }] },
    options: { responsive:true, plugins:{legend:{position:'bottom'}} }
  });
  // Line: monthly totals
  const byMonth = {};
  expenses.forEach(e => {
    const m = (new Date(e.date)).toISOString().slice(0,7);
    byMonth[m] = (byMonth[m]||0) + Number(e.amount||0);
  });
  const months = Object.keys(byMonth).sort();
  const vals = months.map(m=>byMonth[m]);
  if (charts.line) charts.line.destroy();
  charts.line = new Chart(document.getElementById("chart-line"), {
    type: "line",
    data: { labels: months, datasets: [{ label: 'Траты по месяцам', data: vals, fill:false }] },
    options: { responsive:true }
  });
}

function updateAnalytics() {
  (async ()=>{
    const expenses = await fetchAll("expenses");
    const income = await fetchAll("income");
    const meanExp = expenses.length ? (expenses.reduce((s,e)=>s+Number(e.amount||0),0)/expenses.length) : 0;
    const totalExp = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    const totalInc = income.reduce((s,i)=>s+Number(i.amount||0),0);
    const summary = `Всего трат: ${formatMoney(totalExp)} ₽ · Средний чек: ${formatMoney(meanExp)} ₽ · Всего доходов: ${formatMoney(totalInc)} ₽`;
    document.getElementById("analytics-summary").innerText = summary;
  })();
}

// ----------------- Экспорт CSV -----------------
async function exportAllCSV() {
  const exp = await fetchAll("expenses");
  const inc = await fetchAll("income");
  const cats = await fetchAll("categories");
  function toCSV(arr, fields) {
    const header = fields.join(",");
    const rows = arr.map(r => fields.map(f => `"${(r[f]||"").toString().replace(/"/g,'""')}"`).join(","));
    return [header].concat(rows).join("\n");
  }
  const zipParts = [];
  const files = {
    "expenses.csv": toCSV(exp, ["id","userId","date","amount","category","note","created_at"]),
    "income.csv": toCSV(inc, ["id","userId","date","amount","category","note","created_at"]),
    "categories.csv": toCSV(cats, ["id","userId","name","color"])
  };
  // create blob and download
  const blob = new Blob([Object.entries(files).map(([name,content])=>`--- ${name} ---\n${content}`).join("\n\n")], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "finance_export.txt"; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  alert("Экспорт завершён: скачан файл finance_export.txt (с CSV секциями).");
}
