const DATA = window.DBD_DATA || {};
const STORAGE_KEY = 'dfd-standalone-challenge-v1';
const app = document.getElementById('app');

const I18N = {
  'pt-BR': {
    'brand.subtitle': 'Gauntlet local para Dead by Daylight',
    'nav.tracker': 'Tracker',
    'nav.control': 'Painel',
    'nav.roster': 'Lista',
    'hero.eyebrow': 'GitHub Pages · sem login · local first',
    'hero.title': 'Gauntlet Challenge',
    'hero.lead': 'Sorteie personagens, marque vitórias e volte automaticamente ao checkpoint em caso de falha. Tudo fica salvo apenas neste navegador.',
  },
};

const FALLBACKS = {
  survivor: 'https://deadbydaylight.wiki.gg/wiki/Special:Redirect/file/IconHelpLoading_survivor.png',
  killer: 'https://deadbydaylight.wiki.gg/wiki/Special:Redirect/file/IconHelpLoading_killer.png',
};

const state = {
  locale: 'pt-BR',
};

function t(key) {
  return I18N[state.locale]?.[key] || I18N['pt-BR'][key] || key;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

function displayName(item) {
  return item?.namePt || item?.name || '';
}

function byName(a, b) {
  return displayName(a).localeCompare(displayName(b), 'pt-BR');
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'sem data';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function defaultSave() {
  return {
    version: 1,
    locale: 'pt-BR',
    mode: 'survivor',
    checkpointSize: 10,
    runs: {
      survivor: { currentId: null, completedIds: [], attempts: 0, history: [] },
      killer: { currentId: null, completedIds: [], attempts: 0, history: [] },
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSave(saved) {
  const base = defaultSave();
  if (!saved || typeof saved !== 'object') return base;
  const next = { ...base, ...saved, runs: { ...base.runs, ...(saved.runs || {}) } };
  next.mode = ['survivor', 'killer'].includes(next.mode) ? next.mode : 'survivor';
  next.locale = I18N[next.locale] ? next.locale : 'pt-BR';
  for (const mode of ['survivor', 'killer']) {
    next.runs[mode] = { ...base.runs[mode], ...(saved.runs?.[mode] || {}) };
    next.runs[mode].completedIds = Array.isArray(next.runs[mode].completedIds) ? next.runs[mode].completedIds : [];
    next.runs[mode].history = Array.isArray(next.runs[mode].history) ? next.runs[mode].history : [];
  }
  return next;
}

function loadSave() {
  try {
    return normalizeSave(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return defaultSave();
  }
}

let save = loadSave();
state.locale = save.locale;

function persist() {
  save.updatedAt = new Date().toISOString();
  save.locale = state.locale;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

function roster(mode = save.mode) {
  return [...(mode === 'killer' ? DATA.killers || [] : DATA.survivors || [])].sort(byName);
}

function run(mode = save.mode) {
  return save.runs[mode];
}

function progress(mode = save.mode) {
  const list = roster(mode);
  const currentRun = run(mode);
  const completed = new Set(currentRun.completedIds);
  return {
    list,
    currentRun,
    completed,
    done: completed.size,
    total: list.length,
    remaining: list.filter(item => !completed.has(item.id)),
  };
}

function addHistory(type, name) {
  const currentRun = run();
  currentRun.history.unshift({ type, name, at: new Date().toISOString() });
  currentRun.history = currentRun.history.slice(0, 30);
}

function spin() {
  const current = progress();
  if (!current.remaining.length) return;
  const next = current.remaining[Math.floor(Math.random() * current.remaining.length)];
  current.currentRun.currentId = next.id;
  addHistory('sorteio', displayName(next));
  persist();
  render();
}

function completeCurrent() {
  const currentRun = run();
  if (!currentRun.currentId || currentRun.completedIds.includes(currentRun.currentId)) return;
  const picked = roster().find(item => item.id === currentRun.currentId);
  currentRun.completedIds.push(currentRun.currentId);
  currentRun.currentId = null;
  currentRun.attempts += 1;
  addHistory('concluído', displayName(picked));
  persist();
  render();
}

function failRollback() {
  const currentRun = run();
  const keep = Math.floor(currentRun.completedIds.length / save.checkpointSize) * save.checkpointSize;
  const removed = currentRun.completedIds.splice(keep);
  currentRun.currentId = null;
  currentRun.attempts += 1;
  addHistory('falha', `${removed.length} removidos`);
  persist();
  render();
}

function resetMode() {
  if (!confirm('Resetar o modo atual neste navegador?')) return;
  save.runs[save.mode] = { currentId: null, completedIds: [], attempts: 0, history: [] };
  persist();
  render();
}

function exportSave() {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dfd-challenge-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importSave(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      save = normalizeSave(JSON.parse(reader.result));
      state.locale = save.locale;
      persist();
      render();
    } catch {
      alert('Arquivo de backup inválido.');
    }
  });
  reader.readAsText(file);
}

function toggleComplete(id) {
  const currentRun = run();
  currentRun.completedIds = currentRun.completedIds.includes(id)
    ? currentRun.completedIds.filter(item => item !== id)
    : [...currentRun.completedIds, id];
  if (currentRun.currentId === id) currentRun.currentId = null;
  persist();
  render();
}

function characterCard(item, current) {
  const done = current.completed.has(item.id);
  const active = current.currentRun.currentId === item.id;
  return `
    <button class="character ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}" type="button" data-action="toggle" data-id="${item.id}">
      <img src="${esc(item.image || FALLBACKS[save.mode])}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span>${esc(displayName(item))}</span>
    </button>
  `;
}

function render() {
  const current = progress();
  const picked = current.list.find(item => item.id === current.currentRun.currentId);
  const percent = current.total ? Math.round((current.done / current.total) * 100) : 0;
  const checkpoint = Math.floor(current.done / save.checkpointSize) * save.checkpointSize;
  const nextCheckpoint = Math.min(checkpoint + save.checkpointSize, current.total);

  document.documentElement.lang = state.locale;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });

  app.innerHTML = `
    <section class="hero" id="tracker">
      <div class="hero-copy">
        <span class="eyebrow">${esc(t('hero.eyebrow'))}</span>
        <h1>${esc(t('hero.title'))}</h1>
        <p>${esc(t('hero.lead'))}</p>
        <div class="actions">
          <button type="button" data-action="spin">Sortear</button>
          <button type="button" data-action="complete" ${picked ? '' : 'disabled'}>Marcar vitória</button>
          <button type="button" data-action="fail">Falha: voltar checkpoint</button>
        </div>
      </div>
      <aside class="pick-panel">
        <span class="eyebrow">Escolha atual</span>
        ${picked ? `
          <img src="${esc(picked.image || FALLBACKS[save.mode])}" alt="" referrerpolicy="no-referrer">
          <h2>${esc(displayName(picked))}</h2>
        ` : '<h2>Nenhum sorteio ativo</h2><p>Sortear escolhe automaticamente entre os restantes.</p>'}
      </aside>
    </section>

    <section class="stats">
      <div class="ring" style="--value: ${percent}%"><b>${percent}%</b><span>${current.done}/${current.total}</span></div>
      <div class="stat"><span>Restantes</span><b>${current.remaining.length}</b></div>
      <div class="stat"><span>Tentativas</span><b>${current.currentRun.attempts}</b></div>
      <div class="stat"><span>Checkpoint seguro</span><b>${checkpoint}</b></div>
      <div class="stat"><span>Próximo checkpoint</span><b>${nextCheckpoint}</b></div>
    </section>

    <section class="panel" id="control">
      <div>
        <h2>Painel de controle</h2>
        <p>Sem conta e sem servidor. O backup JSON é a forma de levar o progresso para outro navegador.</p>
      </div>
      <div class="controls">
        <label>Modo
          <select data-action="mode">
            <option value="survivor" ${save.mode === 'survivor' ? 'selected' : ''}>Sobreviventes</option>
            <option value="killer" ${save.mode === 'killer' ? 'selected' : ''}>Assassinos</option>
          </select>
        </label>
        <label>Idioma
          <select data-action="locale">
            ${Object.keys(I18N).map(locale => `<option value="${locale}" ${state.locale === locale ? 'selected' : ''}>${locale}</option>`).join('')}
          </select>
        </label>
        <label>Checkpoint
          <input data-action="checkpoint" type="number" min="1" max="99" value="${save.checkpointSize}">
        </label>
        <button type="button" data-action="export">Exportar</button>
        <label class="file-button">Importar<input data-action="import" type="file" accept="application/json"></label>
        <button type="button" data-action="reset">Resetar modo</button>
      </div>
    </section>

    <section class="roster" id="roster">
      ${current.list.map(item => characterCard(item, current)).join('')}
    </section>

    <section class="panel history">
      <h2>Histórico recente</h2>
      ${current.currentRun.history.length ? current.currentRun.history.map(entry => `<p><b>${esc(entry.type)}</b> · ${esc(entry.name)} · ${formatDate(entry.at)}</p>`).join('') : '<p>Nenhuma ação registrada ainda.</p>'}
    </section>
  `;

  app.querySelectorAll('button[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'spin') spin();
      if (action === 'complete') completeCurrent();
      if (action === 'fail') failRollback();
      if (action === 'export') exportSave();
      if (action === 'reset') resetMode();
      if (action === 'toggle') toggleComplete(Number(button.dataset.id));
    });
  });
  app.querySelector('[data-action="mode"]').addEventListener('change', event => {
    save.mode = event.target.value;
    persist();
    render();
  });
  app.querySelector('[data-action="locale"]').addEventListener('change', event => {
    state.locale = event.target.value;
    persist();
    render();
  });
  app.querySelector('[data-action="checkpoint"]').addEventListener('change', event => {
    save.checkpointSize = Math.max(1, Number(event.target.value) || 10);
    persist();
    render();
  });
  app.querySelector('[data-action="import"]').addEventListener('change', event => importSave(event.target.files[0]));
}

render();
