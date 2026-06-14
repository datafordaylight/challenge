const DATA = window.DBD_DATA || {};
const STORAGE_KEY = 'dfd-standalone-challenge-v2';
const LEGACY_STORAGE_KEY = 'dfd-standalone-challenge-v1';
const app = document.getElementById('app');

const I18N = {
  'pt-BR': {
    'brand.subtitle': 'Gauntlet local para Dead by Daylight',
    'nav.tracker': 'Tracker',
    'nav.panel': 'Painel',
    'nav.roster': 'Lista',
    'hero.eyebrow': 'GitHub Pages · sem login · local first',
    'hero.title': 'Gauntlet Challenge',
    'hero.lead': 'Sorteie personagens, marque vitórias e volte automaticamente ao checkpoint em caso de falha. Tudo fica salvo apenas neste navegador.',
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
  },
  en: {
    'brand.subtitle': 'Local Dead by Daylight gauntlet',
    'nav.tracker': 'Tracker',
    'nav.panel': 'Control',
    'nav.roster': 'Roster',
    'hero.eyebrow': 'GitHub Pages · no login · local first',
    'hero.title': 'Gauntlet Challenge',
    'hero.lead': 'Spin characters, mark wins, and roll back to the latest checkpoint after a failure. Everything is saved only in this browser.',
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
  },
};

const FALLBACKS = {
  survivor: 'https://deadbydaylight.wiki.gg/wiki/Special:Redirect/file/IconHelpLoading_survivor.png',
  killer: 'https://deadbydaylight.wiki.gg/wiki/Special:Redirect/file/IconHelpLoading_killer.png',
};

const state = {
  locale: detectLocale(),
  panelTab: 'completed',
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
  currentRun.attempts += 1;
  addHistory(save.mode === 'killer' ? 'vitória' : 'escape', currentRun.currentId);
  currentRun.currentId = null;
  persist();
  if (save.autoSpinAfterComplete) spin();
  else render();
}

function failRollback() {
  const currentRun = run();
  const keep = Math.floor(currentRun.completedIds.length / save.checkpointSize) * save.checkpointSize;
  const removed = currentRun.completedIds.splice(keep);
  currentRun.currentId = null;
  currentRun.failures += 1;
  currentRun.attempts += 1;
  addHistory('falha', null, `${removed.length} removidos`);
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
  if (state.panelTab === 'help') {
    return `
      <div class="help-grid">
        <article>
          <h3>Como o desafio funciona</h3>
          <p>Escolha Sobreviventes ou Assassinos no topo. Cada modo tem progresso independente: escapes/vitórias, tentativas, falhas, sorteio atual, histórico, bloqueios e notas não se misturam.</p>
        </article>
        <article>
          <h3>Sorteio e conclusão</h3>
          <p>O botão Sortear escolhe uma entrada do pool permitido. Depois da partida, use Marcar escape ou Marcar vitória para concluir a entrada atual. A entrada sai do pool normal e o progresso avança.</p>
        </article>
        <article>
          <h3>Falha e checkpoints</h3>
          <p>Quando houver falha, o sistema volta ao último checkpoint seguro. Com checkpoint 10, por exemplo, um progresso de 27 volta para 20. As entradas removidas voltam a ficar disponíveis.</p>
        </article>
        <article>
          <h3>Entradas específicas</h3>
          <p>Na aba Entradas você pode concluir ou desfazer qualquer personagem, pular temporariamente, bloquear para remover do sorteio, desbloquear e priorizar para aumentar a chance de aparecer no próximo sorteio.</p>
        </article>
        <article>
          <h3>Regras locais</h3>
          <p>Em Regras você ajusta o tamanho do checkpoint, decide se o sorteio usa só disponíveis ou todos exceto bloqueados, ativa sorteio automático após concluir, oculta concluídos e registra notas.</p>
        </article>
        <article>
          <h3>Backup e privacidade</h3>
          <p>Não existe login nem servidor. Tudo fica salvo no navegador. Use Exportar tudo para criar um backup JSON e Importar backup para restaurar ou levar seu progresso para outro dispositivo.</p>
        </article>
      </div>
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

function render() {
  const current = progress();
  const picked = current.list.find(item => item.id === current.currentRun.currentId);
  const percent = current.total ? Math.round((current.done / current.total) * 100) : 0;
  const checkpoint = Math.floor(current.done / save.checkpointSize) * save.checkpointSize;
  const nextCheckpoint = Math.min(checkpoint + save.checkpointSize, current.total);
  const completedLabel = save.mode === 'killer' ? 'Vitórias' : 'Escapes';

  document.documentElement.lang = state.locale;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });

  app.innerHTML = `
    <section class="hero" id="tracker">
      <div class="hero-copy">
        <span class="eyebrow">${esc(t('hero.eyebrow'))}</span>
        <div class="mode-switch" role="tablist" aria-label="Modo do desafio">
          <button type="button" class="${save.mode === 'survivor' ? 'is-active' : ''}" data-action="mode" data-mode="survivor">${esc(t('mode.survivor'))}</button>
          <button type="button" class="${save.mode === 'killer' ? 'is-active' : ''}" data-action="mode" data-mode="killer">${esc(t('mode.killer'))}</button>
        </div>
        <h1>${esc(t('hero.title'))}</h1>
        <p>${esc(t('hero.lead'))}</p>
        <div class="actions">
          <button type="button" data-action="spin">${esc(t('action.spin'))}</button>
          <button type="button" data-action="complete" ${picked ? '' : 'disabled'}>${esc(t(save.mode === 'killer' ? 'action.completeKiller' : 'action.completeSurvivor'))}</button>
          <button type="button" data-action="fail">${esc(t('action.fail'))}</button>
        </div>
      </div>
      <aside class="pick-panel">
        <span class="eyebrow">${esc(t('pick.current'))}</span>
        ${picked ? `
          <img src="${esc(picked.image || FALLBACKS[save.mode])}" alt="" referrerpolicy="no-referrer">
          <h2>${esc(displayName(picked))}</h2>
          ${originalName(picked) ? `<p>${esc(originalName(picked))}</p>` : ''}
        ` : `<h2>${esc(t('pick.empty'))}</h2><p>${esc(t('pick.emptyHelp'))}</p>`}
      </aside>
    </section>

    <section class="stats">
      <div class="ring" style="--value: ${percent}%"><b>${percent}%</b><span>${current.done}/${current.total}</span></div>
      <div class="stat"><span>${completedLabel}</span><b>${current.done}</b></div>
      <div class="stat"><span>${esc(t('stat.remaining'))}</span><b>${current.available.length}</b></div>
      <div class="stat"><span>${esc(t('stat.attempts'))}</span><b>${current.currentRun.attempts}</b></div>
      <div class="stat"><span>${esc(t('stat.safe'))}</span><b>${checkpoint}</b></div>
      <div class="stat"><span>${esc(t('stat.next'))}</span><b>${nextCheckpoint}</b></div>
    </section>

    <section class="control-suite" id="panel">
      <aside class="panel-menu" aria-label="Menu do painel">
        ${[
          ['completed', 'Entradas'],
          ['history', 'Histórico'],
          ['rules', 'Regras'],
          ['backup', 'Backup'],
          ['help', 'Ajuda'],
        ].map(([tab, label]) => `<button type="button" class="${state.panelTab === tab ? 'is-active' : ''}" data-action="panel-tab" data-tab="${tab}">${label}</button>`).join('')}
      </aside>
      <section class="panel-body">
        <header>
          <div>
            <h2>Painel de controle</h2>
            <p>Gerencie entradas específicas, regras, histórico e backups do modo atual.</p>
          </div>
          <span class="locale-pill">Idioma automático: ${esc(state.locale)}</span>
        </header>
        ${panelContent(current)}
      </section>
    </section>

    <section class="roster" id="roster">
      ${current.list.map(item => characterCard(item, current)).join('')}
    </section>
  `;

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

render();
