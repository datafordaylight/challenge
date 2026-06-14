const DATA = window.DBD_DATA || {};
const STORAGE_KEY = 'dfd-standalone-challenge-v2';
const LEGACY_STORAGE_KEY = 'dfd-standalone-challenge-v1';
const app = document.getElementById('app');

const I18N = {
  'pt-BR': {
    'brand.subtitle': 'Gauntlet local para Dead by Daylight',
    'nav.tracker': 'Tracker',
    'nav.panel': 'Painel',
    'nav.help': 'Ajuda',
    'hero.eyebrow': 'GitHub Pages · sem login · local first',
    'hero.title': 'Gauntlet Challenge',
    'hero.lead': 'Sorteie personagens, marque vitórias e volte automaticamente ao checkpoint em caso de falha. Tudo fica salvo apenas neste navegador.',
    'choose.title': 'Escolha seu caminho',
    'choose.lead': 'Selecione o modo da sua gauntlet para continuar.',
    'mode.survivor': 'Sobreviventes',
    'mode.killer': 'Assassinos',
    'action.spin': 'Sortear',
    'action.completeSurvivor': 'Marcar escape',
    'action.completeKiller': 'Marcar vitória',
    'action.fail': 'Falha: voltar checkpoint',
    'pick.current': 'Escolha atual',
    'pick.empty': 'Nenhum sorteio ativo',
    'pick.emptyHelp': 'Sortear escolhe automaticamente entre os restantes.',
    'stat.remaining': 'Restantes',
    'stat.attempts': 'Tentativas',
    'stat.safe': 'Checkpoint seguro',
    'stat.next': 'Próximo checkpoint',
    'stats.title': 'Challenge Statistics',
    'stats.subtitleSurvivor': 'Acompanhe sua performance de sobrevivente',
    'stats.subtitleKiller': 'Acompanhe sua performance de assassino',
  },
  en: {
    'brand.subtitle': 'Local Dead by Daylight gauntlet',
    'nav.tracker': 'Tracker',
    'nav.panel': 'Control',
    'nav.help': 'Help',
    'hero.eyebrow': 'GitHub Pages · no login · local first',
    'hero.title': 'Gauntlet Challenge',
    'hero.lead': 'Spin characters, mark wins, and roll back to the latest checkpoint after a failure. Everything is saved only in this browser.',
    'choose.title': 'Choose your path',
    'choose.lead': 'Select your gauntlet mode to continue.',
    'mode.survivor': 'Survivors',
    'mode.killer': 'Killers',
    'action.spin': 'Spin',
    'action.completeSurvivor': 'Mark escape',
    'action.completeKiller': 'Mark win',
    'action.fail': 'Failure: rollback',
    'pick.current': 'Current pick',
    'pick.empty': 'No active pick',
    'pick.emptyHelp': 'Spin automatically chooses from remaining entries.',
    'stat.remaining': 'Remaining',
    'stat.attempts': 'Attempts',
    'stat.safe': 'Safe checkpoint',
    'stat.next': 'Next checkpoint',
    'stats.title': 'Challenge Statistics',
    'stats.subtitleSurvivor': 'Track your survivor performance',
    'stats.subtitleKiller': 'Track your killer performance',
  },
};

const FALLBACKS = {
  survivor: 'https://deadbydaylight.wiki.gg/wiki/Special:Redirect/file/IconHelpLoading_survivor.png',
  killer: 'https://deadbydaylight.wiki.gg/wiki/Special:Redirect/file/IconHelpLoading_killer.png',
};

const state = {
  locale: detectLocale(),
  panelTab: 'completed',
  statsOpen: false,
};

function detectLocale() {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language || 'pt-BR'];
  const match = languages.find(language => I18N[language] || I18N[language.split('-')[0]]);
  if (!match) return 'pt-BR';
  return I18N[match] ? match : match.split('-')[0];
}

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

function originalName(item) {
  const pt = String(item?.namePt || '').trim();
  const en = String(item?.name || '').trim();
  return en && en !== pt ? en : '';
}

function byName(a, b) {
  return displayName(a).localeCompare(displayName(b), state.locale);
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'sem data';
  return new Intl.DateTimeFormat(state.locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function defaultRun() {
  return {
    currentId: null,
    completedIds: [],
    skippedIds: [],
    bannedIds: [],
    pinnedIds: [],
    attempts: 0,
    wins: 0,
    failures: 0,
    notes: '',
    winsById: {},
    failuresById: {},
    history: [],
  };
}

function defaultSave() {
  return {
    version: 2,
    mode: 'survivor',
    checkpointSize: 10,
    randomPool: 'available',
    autoSpinAfterComplete: false,
    showCompletedInRoster: true,
    runs: {
      survivor: defaultRun(),
      killer: defaultRun(),
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeRun(value) {
  const run = { ...defaultRun(), ...(value || {}) };
  for (const key of ['completedIds', 'skippedIds', 'bannedIds', 'pinnedIds', 'history']) {
    run[key] = Array.isArray(run[key]) ? run[key] : [];
  }
  run.attempts = Number(run.attempts) || 0;
  run.wins = Number(run.wins) || run.completedIds.length;
  run.failures = Number(run.failures) || 0;
  run.notes = String(run.notes || '');
  run.winsById = run.winsById && typeof run.winsById === 'object' ? run.winsById : {};
  run.failuresById = run.failuresById && typeof run.failuresById === 'object' ? run.failuresById : {};
  return run;
}

function normalizeSave(saved) {
  const base = defaultSave();
  if (!saved || typeof saved !== 'object') return base;
  const next = { ...base, ...saved, runs: { ...base.runs, ...(saved.runs || saved.modes || {}) } };
  next.version = 2;
  next.mode = ['survivor', 'killer'].includes(next.mode) ? next.mode : 'survivor';
  next.randomPool = ['available', 'all'].includes(next.randomPool) ? next.randomPool : 'available';
  next.checkpointSize = Math.max(1, Number(next.checkpointSize) || 10);
  next.runs.survivor = normalizeRun(next.runs.survivor);
  next.runs.killer = normalizeRun(next.runs.killer);
  return next;
}

function loadSave() {
  try {
    const current = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizeSave(JSON.parse(current));
  } catch {
    return defaultSave();
  }
}

let save = loadSave();

function persist() {
  save.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

function roster(mode = save.mode) {
  return [...(mode === 'killer' ? DATA.killers || [] : DATA.survivors || [])].sort(byName);
}

function run(mode = save.mode) {
  return save.runs[mode];
}

function itemById(id, mode = save.mode) {
  return roster(mode).find(item => item.id === id);
}

function progress(mode = save.mode) {
  const list = roster(mode);
  const currentRun = run(mode);
  const completed = new Set(currentRun.completedIds);
  const skipped = new Set(currentRun.skippedIds);
  const banned = new Set(currentRun.bannedIds);
  const pinned = new Set(currentRun.pinnedIds);
  const unavailable = new Set([...completed, ...skipped, ...banned]);
  const available = list.filter(item => !unavailable.has(item.id));
  const pool = save.randomPool === 'all' ? list.filter(item => !banned.has(item.id)) : available;
  return {
    list,
    currentRun,
    completed,
    skipped,
    banned,
    pinned,
    available,
    pool,
    done: completed.size,
    total: list.length,
  };
}

function addHistory(type, id, label) {
  const currentRun = run();
  const item = id ? itemById(id) : null;
  currentRun.history.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type,
    entryId: id || null,
    name: label || displayName(item),
    at: new Date().toISOString(),
  });
  currentRun.history = currentRun.history.slice(0, 80);
}

function setMode(mode) {
  save.mode = mode;
  persist();
  if (currentView() === 'choose') location.hash = '#tracker';
  render();
}

function spin() {
  const current = progress();
  if (!current.pool.length) return;
  const preferred = current.list.filter(item => current.pinned.has(item.id) && !current.banned.has(item.id) && !current.completed.has(item.id));
  const pool = preferred.length ? preferred : current.pool;
  const next = pool[Math.floor(Math.random() * pool.length)];
  current.currentRun.currentId = next.id;
  addHistory('sorteio', next.id);
  persist();
  render();
}

function completeCurrent() {
  const currentRun = run();
  if (!currentRun.currentId || currentRun.completedIds.includes(currentRun.currentId)) return;
  currentRun.completedIds.push(currentRun.currentId);
  currentRun.skippedIds = currentRun.skippedIds.filter(id => id !== currentRun.currentId);
  currentRun.wins += 1;
  currentRun.winsById[currentRun.currentId] = (Number(currentRun.winsById[currentRun.currentId]) || 0) + 1;
  currentRun.attempts += 1;
  addHistory(save.mode === 'killer' ? 'vitória' : 'escape', currentRun.currentId);
  currentRun.currentId = null;
  persist();
  if (save.autoSpinAfterComplete) spin();
  else render();
}

function failRollback() {
  const currentRun = run();
  const failedId = currentRun.currentId;
  const keep = Math.floor(currentRun.completedIds.length / save.checkpointSize) * save.checkpointSize;
  const removed = currentRun.completedIds.splice(keep);
  currentRun.currentId = null;
  currentRun.failures += 1;
  if (failedId) currentRun.failuresById[failedId] = (Number(currentRun.failuresById[failedId]) || 0) + 1;
  currentRun.attempts += 1;
  addHistory('falha', failedId, failedId ? displayName(itemById(failedId)) : `${removed.length} removidos`);
  persist();
  render();
}

function mutateEntry(id, action) {
  const currentRun = run();
  const removeFrom = key => {
    currentRun[key] = currentRun[key].filter(value => value !== id);
  };
  if (action === 'complete') {
    if (!currentRun.completedIds.includes(id)) currentRun.completedIds.push(id);
    currentRun.winsById[id] = (Number(currentRun.winsById[id]) || 0) + 1;
    removeFrom('skippedIds');
    removeFrom('bannedIds');
    addHistory('concluído manualmente', id);
  }
  if (action === 'uncomplete') {
    removeFrom('completedIds');
    addHistory('conclusão removida', id);
  }
  if (action === 'skip') {
    if (!currentRun.skippedIds.includes(id)) currentRun.skippedIds.push(id);
    if (currentRun.currentId === id) currentRun.currentId = null;
    addHistory('pulado', id);
  }
  if (action === 'unskip') {
    removeFrom('skippedIds');
    addHistory('pulo removido', id);
  }
  if (action === 'ban') {
    if (!currentRun.bannedIds.includes(id)) currentRun.bannedIds.push(id);
    if (currentRun.currentId === id) currentRun.currentId = null;
    addHistory('bloqueado', id);
  }
  if (action === 'unban') {
    removeFrom('bannedIds');
    addHistory('bloqueio removido', id);
  }
  if (action === 'pin') {
    currentRun.pinnedIds = currentRun.pinnedIds.includes(id)
      ? currentRun.pinnedIds.filter(value => value !== id)
      : [...currentRun.pinnedIds, id];
    addHistory(currentRun.pinnedIds.includes(id) ? 'priorizado' : 'prioridade removida', id);
  }
  persist();
  render();
}

function clearCurrent() {
  const currentRun = run();
  if (currentRun.currentId) addHistory('sorteio limpo', currentRun.currentId);
  currentRun.currentId = null;
  persist();
  render();
}

function resetMode() {
  if (!confirm('Resetar o modo atual neste navegador?')) return;
  save.runs[save.mode] = defaultRun();
  persist();
  render();
}

function resetAll() {
  if (!confirm('Apagar todos os dados locais do desafio?')) return;
  save = defaultSave();
  persist();
  render();
}

function clearHistory() {
  if (!confirm('Limpar o histórico do modo atual?')) return;
  run().history = [];
  persist();
  render();
}

function deleteHistory(id) {
  run().history = run().history.filter(entry => entry.id !== id);
  persist();
  render();
}

function exportSave(scope = 'all') {
  const payload = scope === 'mode'
    ? { ...save, runs: { [save.mode]: run() }, exportedMode: save.mode }
    : save;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dfd-challenge-${scope}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importSave(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      save = normalizeSave(JSON.parse(reader.result));
      persist();
      render();
    } catch {
      alert('Arquivo de backup inválido.');
    }
  });
  reader.readAsText(file);
}

function copySummary() {
  const current = progress();
  const text = [
    `Modo: ${t(`mode.${save.mode}`)}`,
    `Progresso: ${current.done}/${current.total}`,
    `Tentativas: ${current.currentRun.attempts}`,
    `Falhas: ${current.currentRun.failures}`,
    `Checkpoint: ${Math.floor(current.done / save.checkpointSize) * save.checkpointSize}`,
  ].join('\n');
  navigator.clipboard?.writeText(text);
}

function isWinEntry(entry) {
  return ['escape', 'vitória', 'concluído manualmente'].includes(entry.type);
}

function isFailureEntry(entry) {
  return entry.type === 'falha';
}

function streakStats(history = []) {
  let current = 0;
  let longest = 0;
  [...history].reverse().forEach(entry => {
    if (isWinEntry(entry)) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (isFailureEntry(entry)) {
      current = 0;
    }
  });
  return { current, longest };
}

function topEntryBy(map, mode = save.mode) {
  const entries = Object.entries(map || {})
    .map(([id, count]) => ({ item: itemById(Number(id), mode), count: Number(count) || 0 }))
    .filter(entry => entry.item && entry.count > 0)
    .sort((a, b) => b.count - a.count || displayName(a.item).localeCompare(displayName(b.item), state.locale));
  return entries[0] || null;
}

function modeMetrics(mode = save.mode) {
  const current = progress(mode);
  const currentRun = run(mode);
  const winRate = currentRun.attempts ? Math.round((currentRun.wins / currentRun.attempts) * 100) : 0;
  return {
    ...current,
    winRate,
    streak: streakStats(currentRun.history),
    best: topEntryBy(currentRun.winsById, mode),
    worst: topEntryBy(currentRun.failuresById, mode),
  };
}

function statusFor(item, current) {
  if (current.completed.has(item.id)) return 'completed';
  if (current.banned.has(item.id)) return 'banned';
  if (current.skipped.has(item.id)) return 'skipped';
  if (current.currentRun.currentId === item.id) return 'current';
  return 'available';
}

function entryRow(item, current) {
  const status = statusFor(item, current);
  return `
    <article class="entry-row ${status}">
      <img src="${esc(item.image || FALLBACKS[save.mode])}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <div>
        <b>${esc(displayName(item))}</b>
        ${originalName(item) ? `<span>${esc(originalName(item))}</span>` : ''}
        <small>${statusLabel(status)}${current.pinned.has(item.id) ? ' · prioridade' : ''}</small>
      </div>
      <div class="row-actions">
        ${current.completed.has(item.id)
          ? `<button type="button" data-action="entry" data-entry-action="uncomplete" data-id="${item.id}">Desfazer</button>`
          : `<button type="button" data-action="entry" data-entry-action="complete" data-id="${item.id}">Concluir</button>`}
        ${current.skipped.has(item.id)
          ? `<button type="button" data-action="entry" data-entry-action="unskip" data-id="${item.id}">Reativar</button>`
          : `<button type="button" data-action="entry" data-entry-action="skip" data-id="${item.id}">Pular</button>`}
        ${current.banned.has(item.id)
          ? `<button type="button" data-action="entry" data-entry-action="unban" data-id="${item.id}">Desbloquear</button>`
          : `<button type="button" data-action="entry" data-entry-action="ban" data-id="${item.id}">Bloquear</button>`}
        <button type="button" data-action="entry" data-entry-action="pin" data-id="${item.id}">${current.pinned.has(item.id) ? 'Tirar prioridade' : 'Priorizar'}</button>
      </div>
    </article>
  `;
}

function statusLabel(status) {
  return {
    completed: 'concluído',
    banned: 'fora do sorteio',
    skipped: 'pulado',
    current: 'sorteio atual',
    available: 'disponível',
  }[status] || status;
}

function characterCard(item, current) {
  const status = statusFor(item, current);
  const hidden = !save.showCompletedInRoster && status === 'completed';
  if (hidden) return '';
  return `
    <button class="character ${status} ${current.pinned.has(item.id) ? 'is-pinned' : ''}" type="button" data-action="entry" data-entry-action="${status === 'completed' ? 'uncomplete' : 'complete'}" data-id="${item.id}">
      <img src="${esc(item.image || FALLBACKS[save.mode])}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span>${esc(displayName(item))}</span>
      <small>${statusLabel(status)}</small>
    </button>
  `;
}

function panelContent(current) {
  if (state.panelTab === 'completed') {
    return `
      <div class="panel-tools">
        <button type="button" data-action="clear-current">Limpar sorteio atual</button>
        <button type="button" data-action="copy-summary">Copiar resumo</button>
      </div>
      <div class="entry-list">
        ${current.list.map(item => entryRow(item, current)).join('')}
      </div>
    `;
  }
  if (state.panelTab === 'history') {
    return `
      <div class="panel-tools">
        <button type="button" data-action="clear-history">Limpar histórico</button>
      </div>
      <div class="history-list">
        ${current.currentRun.history.length ? current.currentRun.history.map(entry => `
          <article class="history-item">
            <div><b>${esc(entry.type)}</b><span>${esc(entry.name)} · ${formatDate(entry.at)}</span></div>
            <button type="button" data-action="delete-history" data-history-id="${esc(entry.id)}">Apagar</button>
          </article>
        `).join('') : '<p>Nenhuma ação registrada ainda.</p>'}
      </div>
    `;
  }
  if (state.panelTab === 'backup') {
    return `
      <div class="backup-grid">
        <button type="button" data-action="export-all">Exportar tudo</button>
        <button type="button" data-action="export-mode">Exportar modo atual</button>
        <label class="file-button">Importar backup<input data-action="import" type="file" accept="application/json"></label>
        <button type="button" data-action="reset-mode">Resetar modo atual</button>
        <button type="button" data-action="reset-all">Apagar tudo</button>
      </div>
      <p class="fine-print">Os dados são salvos somente no navegador. O arquivo JSON é o seu backup portátil.</p>
    `;
  }
  return `
    <div class="rules-grid">
      <label>Checkpoint
        <input data-action="checkpoint" type="number" min="1" max="99" value="${save.checkpointSize}">
      </label>
      <label>Pool de sorteio
        <select data-action="random-pool">
          <option value="available" ${save.randomPool === 'available' ? 'selected' : ''}>Somente disponíveis</option>
          <option value="all" ${save.randomPool === 'all' ? 'selected' : ''}>Todos exceto bloqueados</option>
        </select>
      </label>
      <label class="check-row">
        <input data-action="auto-spin" type="checkbox" ${save.autoSpinAfterComplete ? 'checked' : ''}>
        Sortear automaticamente após concluir
      </label>
      <label class="check-row">
        <input data-action="show-completed" type="checkbox" ${save.showCompletedInRoster ? 'checked' : ''}>
        Mostrar concluídos na lista principal
      </label>
      <label class="notes-field">Notas do modo atual
        <textarea data-action="notes" rows="5">${esc(current.currentRun.notes)}</textarea>
      </label>
    </div>
  `;
}

function currentView() {
  const value = location.hash.replace('#', '') || 'choose';
  return ['choose', 'tracker', 'panel', 'help'].includes(value) ? value : 'choose';
}

function modeSwitcher() {
  return `
    <div class="mode-switch" role="tablist" aria-label="Modo do desafio">
      <button type="button" class="${save.mode === 'survivor' ? 'is-active' : ''}" data-action="mode" data-mode="survivor">${esc(t('mode.survivor'))}</button>
      <button type="button" class="${save.mode === 'killer' ? 'is-active' : ''}" data-action="mode" data-mode="killer">${esc(t('mode.killer'))}</button>
    </div>
  `;
}

function checkpointBar(metrics, mode) {
  const pct = metrics.total ? Math.max(2, Math.round((metrics.done / metrics.total) * 100)) : 0;
  const marks = [];
  for (let mark = save.checkpointSize; mark < metrics.total; mark += save.checkpointSize) marks.push(mark);
  if (!marks.includes(metrics.total)) marks.push(metrics.total);
  return `
    <div class="checkpoint-bar">
      <div class="checkpoint-fill ${mode}" style="width: ${pct}%"></div>
      ${marks.map(mark => `<span class="checkpoint-mark" style="left: ${Math.min(100, (mark / metrics.total) * 100)}%"><i></i><b>${mark}</b></span>`).join('')}
    </div>
  `;
}

function chooseView() {
  const survivor = modeMetrics('survivor');
  const killer = modeMetrics('killer');
  const cards = [
    ['survivor', survivor, 'fa-person-running', 'Escape com todos'],
    ['killer', killer, 'fa-skull', 'Mate com todos'],
  ];
  return `
    <section class="intro-screen">
      <div class="intro-brand">
        <span class="brand-chip">52</span>
        <strong>Gauntlet <span>Challenge</span></strong>
      </div>
      <div class="intro-copy">
        <h1>${esc(t('choose.title'))}</h1>
        <p>${esc(t('choose.lead'))}</p>
      </div>
      <div class="path-grid">
        ${cards.map(([mode, metrics, icon, text]) => `
          <button class="path-card ${mode}" type="button" data-action="mode" data-mode="${mode}">
            <i class="fa-solid ${icon}" aria-hidden="true"></i>
            <b>${esc(t(`mode.${mode}`))}</b>
            <span>${esc(text)} · ${metrics.total}</span>
            <small>${metrics.done} / ${metrics.total}</small>
            ${checkpointBar(metrics, mode)}
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function statisticsModal(metrics, picked) {
  if (!state.statsOpen) return '';
  const unit = save.mode === 'killer' ? 'vitórias' : 'escapes';
  const danger = metrics.currentRun.failures > metrics.currentRun.wins
    ? 'Você está em perigo. Foco no próximo teste.'
    : 'Ritmo estável. Continue avançando.';
  return `
    <div class="stats-backdrop" role="dialog" aria-modal="true" aria-labelledby="stats-title">
      <section class="stats-modal">
        <header>
          <div>
            <h2 id="stats-title"><i class="fa-solid fa-chart-column" aria-hidden="true"></i>${esc(t('stats.title'))}</h2>
            <p>${esc(t(save.mode === 'killer' ? 'stats.subtitleKiller' : 'stats.subtitleSurvivor'))}</p>
          </div>
          <button type="button" class="icon-button" data-action="close-stats" aria-label="Fechar estatísticas"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </header>
        <div class="stats-cards">
          <article><b>${metrics.done}</b><span>/ ${metrics.total} ${save.mode === 'killer' ? 'assassinos' : 'sobreviventes'}</span></article>
          <article><b>${metrics.currentRun.attempts}</b><span>partidas</span></article>
          <article class="good"><b>${metrics.winRate}%</b><span>win rate</span></article>
          <article class="bad"><b>${metrics.currentRun.failures}</b><span>falhas</span></article>
        </div>
        <div class="streak-grid">
          <article><span>Sequência atual</span><b>${metrics.streak.current}</b><em>${unit}</em></article>
          <article><span>Maior sequência</span><b>${metrics.streak.longest}</b><em>${unit}</em></article>
        </div>
        <div class="best-worst-grid">
          <article class="best"><span><i class="fa-solid fa-trophy" aria-hidden="true"></i> Melhor entrada</span>${metrics.best ? `<b>${esc(displayName(metrics.best.item))}</b><small>${metrics.best.count} ${unit}</small>` : '<em>Sem dados ainda</em>'}</article>
          <article class="worst"><span><i class="fa-solid fa-skull" aria-hidden="true"></i> Maior risco</span>${metrics.worst ? `<b>${esc(displayName(metrics.worst.item))}</b><small>${metrics.worst.count} falhas</small>` : '<em>Sem dados ainda</em>'}</article>
        </div>
        <div class="danger-note">${esc(danger)}</div>
      </section>
    </div>
  `;
}

function trackerView(current, picked, percent, checkpoint, nextCheckpoint, completedLabel) {
  const metrics = modeMetrics();
  return `
    <section class="trial-layout" id="tracker">
      <aside class="trial-sidebar">
        <span class="eyebrow">${esc(t('hero.eyebrow'))}</span>
        ${modeSwitcher()}
        <div class="progress-card">
          <header><b>Progress</b><span>${current.done} / ${current.total}</span></header>
          ${checkpointBar(metrics, save.mode)}
          <p>Próximo checkpoint em <b>${Math.max(0, nextCheckpoint - current.done)}</b> ${save.mode === 'killer' ? 'vitórias' : 'escapes'}</p>
        </div>
        <div class="current-card">
          <span class="eyebrow">${esc(t('pick.current'))}</span>
          ${picked ? `
            <img src="${esc(picked.image || FALLBACKS[save.mode])}" alt="" referrerpolicy="no-referrer">
            <h2>${esc(displayName(picked))}</h2>
            ${originalName(picked) ? `<p>${esc(originalName(picked))}</p>` : ''}
          ` : `<h2>${esc(t('pick.empty'))}</h2><p>${esc(t('pick.emptyHelp'))}</p>`}
        </div>
        <div class="trial-actions">
          <button class="won" type="button" data-action="complete" ${picked ? '' : 'disabled'}><i class="fa-solid fa-check" aria-hidden="true"></i>${esc(t(save.mode === 'killer' ? 'action.completeKiller' : 'action.completeSurvivor'))}</button>
          <button class="lost" type="button" data-action="fail"><i class="fa-solid fa-xmark" aria-hidden="true"></i>${esc(t('action.fail'))}</button>
        </div>
      </aside>
      <section class="trial-board">
        <header>
          <div>
            <h1>${esc(save.mode === 'killer' ? 'Killer Challenge' : 'Survivor Challenge')}</h1>
            <p>${esc(t('hero.lead'))}</p>
          </div>
          <div class="board-actions">
            <button type="button" data-action="spin">${esc(t('action.spin'))}</button>
            <button type="button" data-action="open-stats"><i class="fa-solid fa-chart-column" aria-hidden="true"></i> Estatísticas</button>
            <a href="#panel">Painel</a>
          </div>
        </header>
        <div class="roster-toolbar">
          <b>${current.done}</b><span>/ ${current.total} concluídos</span>
          <label><input data-action="show-completed" type="checkbox" ${save.showCompletedInRoster ? 'checked' : ''}> Mostrar concluídos</label>
        </div>
        <section class="roster compact" id="roster">
          ${current.list.map(item => characterCard(item, current)).join('')}
        </section>
      </section>
    </section>
    ${statisticsModal(metrics, picked)}
  `;
}

function panelView(current) {
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Administração</span>
        <h1>Painel</h1>
        <p>Gerencie entradas específicas, regras, histórico e backups. A lista administrativa aparece só aqui.</p>
      </div>
      ${modeSwitcher()}
    </section>
    <section class="control-suite" id="panel">
      <aside class="panel-menu" aria-label="Menu do painel">
        ${[
          ['completed', 'Entradas'],
          ['history', 'Histórico'],
          ['rules', 'Regras'],
          ['backup', 'Backup'],
        ].map(([tab, label]) => `<button type="button" class="${state.panelTab === tab ? 'is-active' : ''}" data-action="panel-tab" data-tab="${tab}">${label}</button>`).join('')}
      </aside>
      <section class="panel-body">
        <header>
          <div>
            <h2>${esc(t(`mode.${save.mode}`))}</h2>
            <p>Modo atual do painel. Alterações aqui afetam somente este modo.</p>
          </div>
          <span class="locale-pill">Idioma automático: ${esc(state.locale)}</span>
        </header>
        ${panelContent(current)}
      </section>
    </section>
  `;
}

function helpView() {
  return `
    <section class="page-head help-head" id="help">
      <div>
        <span class="eyebrow">Guia de uso</span>
        <h1>Ajuda</h1>
        <p>Entenda o fluxo do desafio, onde cada coisa fica e como proteger seu progresso.</p>
      </div>
      <a class="ghost-link" href="#tracker">Voltar ao tracker</a>
    </section>
    <section class="help-grid">
      <article>
        <h3>Como o desafio funciona</h3>
        <p>Escolha Sobreviventes ou Assassinos no Tracker. Cada modo tem progresso independente: escapes/vitórias, tentativas, falhas, sorteio atual, histórico, bloqueios e notas não se misturam.</p>
      </article>
      <article>
        <h3>Tracker</h3>
        <p>O Tracker é a tela de uso durante a run. Ele mostra o sorteio atual, progresso, estatísticas e o grid visual dos personagens. Clicar em um card alterna concluído/desfeito rapidamente.</p>
      </article>
      <article>
        <h3>Painel</h3>
        <p>O Painel é a área administrativa. Nele ficam a lista detalhada, histórico, regras e backups. A lista detalhada não aparece no Tracker para evitar duplicação visual.</p>
      </article>
      <article>
        <h3>Sorteio e conclusão</h3>
        <p>Sortear escolhe uma entrada do pool permitido. Depois da partida, use Marcar escape ou Marcar vitória para concluir a entrada atual. A entrada sai do pool normal e o progresso avança.</p>
      </article>
      <article>
        <h3>Falha e checkpoints</h3>
        <p>Quando houver falha, o sistema volta ao último checkpoint seguro. Com checkpoint 10, por exemplo, um progresso de 27 volta para 20. As entradas removidas voltam a ficar disponíveis.</p>
      </article>
      <article>
        <h3>Entradas específicas</h3>
        <p>Na aba Entradas do Painel você pode concluir ou desfazer qualquer personagem, pular temporariamente, bloquear para remover do sorteio, desbloquear e priorizar para o próximo sorteio.</p>
      </article>
      <article>
        <h3>Regras locais</h3>
        <p>Em Regras você ajusta checkpoint, pool de sorteio, sorteio automático após concluir, visibilidade de concluídos no grid e notas do modo atual.</p>
      </article>
      <article>
        <h3>Backup e privacidade</h3>
        <p>Não existe login nem servidor. Tudo fica no navegador. Use Exportar tudo para criar um backup JSON e Importar backup para restaurar ou levar o progresso para outro dispositivo.</p>
      </article>
    </section>
    <section class="credit-panel">
      <div>
        <span class="eyebrow">Créditos</span>
        <h2>Referência do projeto</h2>
        <p>Este tracker independente é inspirado pelo <a href="https://mayursoneji.com/projects/dbd-survivor-gauntlet/" target="_blank" rel="noreferrer">DBD Survivor Gauntlet</a> e pelo app público <a href="https://dbd-challenges.mayursoneji.com/" target="_blank" rel="noreferrer">DBD Challenges</a>, criados por Mayur Soneji. A proposta aqui é manter um projeto separado, local-first e sem backend.</p>
      </div>
      <a class="ghost-link" href="https://mayursoneji.com/projects/dbd-survivor-gauntlet/" target="_blank" rel="noreferrer">Ver referência original</a>
    </section>
  `;
}

function render() {
  const current = progress();
  const picked = current.list.find(item => item.id === current.currentRun.currentId);
  const percent = current.total ? Math.round((current.done / current.total) * 100) : 0;
  const checkpoint = Math.floor(current.done / save.checkpointSize) * save.checkpointSize;
  const nextCheckpoint = Math.min(checkpoint + save.checkpointSize, current.total);
  const completedLabel = save.mode === 'killer' ? 'Vitórias' : 'Escapes';
  const view = currentView();

  document.documentElement.lang = state.locale;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });

  app.innerHTML = view === 'choose'
    ? chooseView()
    : view === 'panel'
      ? panelView(current)
      : view === 'help'
        ? helpView()
        : trackerView(current, picked, percent, checkpoint, nextCheckpoint, completedLabel);

  bindControls();
}

function bindControls() {
  app.querySelectorAll('button[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'mode') setMode(button.dataset.mode);
      if (action === 'spin') spin();
      if (action === 'complete') completeCurrent();
      if (action === 'fail') failRollback();
      if (action === 'entry') mutateEntry(Number(button.dataset.id), button.dataset.entryAction);
      if (action === 'panel-tab') {
        state.panelTab = button.dataset.tab;
        render();
      }
      if (action === 'clear-current') clearCurrent();
      if (action === 'open-stats') {
        state.statsOpen = true;
        render();
      }
      if (action === 'close-stats') {
        state.statsOpen = false;
        render();
      }
      if (action === 'copy-summary') copySummary();
      if (action === 'clear-history') clearHistory();
      if (action === 'delete-history') deleteHistory(button.dataset.historyId);
      if (action === 'export-all') exportSave('all');
      if (action === 'export-mode') exportSave('mode');
      if (action === 'reset-mode') resetMode();
      if (action === 'reset-all') resetAll();
    });
  });
  app.querySelector('[data-action="checkpoint"]')?.addEventListener('change', event => {
    save.checkpointSize = Math.max(1, Number(event.target.value) || 10);
    persist();
    render();
  });
  app.querySelector('[data-action="random-pool"]')?.addEventListener('change', event => {
    save.randomPool = event.target.value;
    persist();
    render();
  });
  app.querySelector('[data-action="auto-spin"]')?.addEventListener('change', event => {
    save.autoSpinAfterComplete = event.target.checked;
    persist();
  });
  app.querySelector('[data-action="show-completed"]')?.addEventListener('change', event => {
    save.showCompletedInRoster = event.target.checked;
    persist();
    render();
  });
  app.querySelector('[data-action="notes"]')?.addEventListener('input', event => {
    run().notes = event.target.value;
    persist();
  });
  app.querySelector('[data-action="import"]')?.addEventListener('change', event => importSave(event.target.files[0]));
}

window.addEventListener('hashchange', render);

render();
