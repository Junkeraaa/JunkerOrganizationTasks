// @ts-check
/// <reference lib="dom" />

/**
 * JK Organization Tasks — Frontend Logic
 *
 * Communicates with the extension backend via the VSCode postMessage API.
 * All state lives in the TypeScript backend; this file only renders and dispatches events.
 *
 * @typedef {'pending' | 'done'} TaskStatus
 * @typedef {{ id: string; title: string; status: TaskStatus; createdAt: string }} Task
 * @typedef {{ date: string; tasks: Task[]; closedAt: string }} DayRecord
 */

(function () {
  // @ts-ignore — acquireVsCodeApi is injected by the VSCode Webview runtime
  const vscode = acquireVsCodeApi();

  // ── DOM references ──────────────────────────────────────────────────────────
  const todayDateEl = /** @type {HTMLElement} */ (document.getElementById('today-date'));
  const addTaskBtn = /** @type {HTMLButtonElement} */ (document.getElementById('add-task-btn'));
  const addTaskForm = /** @type {HTMLElement} */ (document.getElementById('add-task-form'));
  const newTaskInput = /** @type {HTMLInputElement} */ (document.getElementById('new-task-input'));
  const confirmAddBtn = /** @type {HTMLButtonElement} */ (document.getElementById('confirm-add-btn'));
  const cancelAddBtn = /** @type {HTMLButtonElement} */ (document.getElementById('cancel-add-btn'));
  const taskListEl = /** @type {HTMLUListElement} */ (document.getElementById('task-list'));
  const emptyStateEl = /** @type {HTMLElement} */ (document.getElementById('empty-state'));
  const closeDayBtn = /** @type {HTMLButtonElement} */ (document.getElementById('close-day-btn'));
  const progressFill = /** @type {HTMLElement} */ (document.getElementById('progress-fill'));
  const progressLabel = /** @type {HTMLElement} */ (document.getElementById('progress-label'));
  const historyListEl = /** @type {HTMLElement} */ (document.getElementById('history-list'));
  const historyEmptyEl = /** @type {HTMLElement} */ (document.getElementById('history-empty-state'));
  const toastEl = /** @type {HTMLElement} */ (document.getElementById('toast'));

  /** @type {Task[]} */
  let currentTasks = [];

  /** @type {DayRecord[]} */
  let currentHistory = [];

  // ── Tab switching ────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = /** @type {HTMLElement} */ (tab).dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => {
        t.classList.remove('tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.panel').forEach((p) => {
        p.classList.remove('panel--active');
      });
      tab.classList.add('tab--active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('panel-' + target);
      if (panel) {
        panel.classList.add('panel--active');
      }
    });
  });

  // ── Add task form ────────────────────────────────────────────────────────────
  addTaskBtn.addEventListener('click', () => {
    addTaskForm.classList.remove('hidden');
    newTaskInput.focus();
    addTaskBtn.classList.add('hidden');
  });

  cancelAddBtn.addEventListener('click', closeAddForm);

  confirmAddBtn.addEventListener('click', submitNewTask);

  newTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitNewTask();
    } else if (e.key === 'Escape') {
      closeAddForm();
    }
  });

  function closeAddForm() {
    addTaskForm.classList.add('hidden');
    addTaskBtn.classList.remove('hidden');
    newTaskInput.value = '';
  }

  function submitNewTask() {
    const title = newTaskInput.value.trim();
    if (!title) {
      newTaskInput.focus();
      return;
    }
    vscode.postMessage({ command: 'addTask', title });
    closeAddForm();
  }

  // ── Close day ────────────────────────────────────────────────────────────────
  closeDayBtn.addEventListener('click', () => {
    if (currentTasks.length === 0) {
      showToast('⚠️ Não há tarefas para encerrar o dia.');
      return;
    }
    vscode.postMessage({ command: 'closeDay' });
  });

  // ── Render tasks ─────────────────────────────────────────────────────────────
  /**
   * @param {Task[]} tasks
   */
  function renderTasks(tasks) {
    taskListEl.innerHTML = '';

    if (tasks.length === 0) {
      emptyStateEl.classList.remove('hidden');
      closeDayBtn.disabled = true;
      updateProgress(0, 0);
      return;
    }

    emptyStateEl.classList.add('hidden');
    closeDayBtn.disabled = false;

    const done = tasks.filter((t) => t.status === 'done').length;
    updateProgress(done, tasks.length);

    tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.status === 'done' ? ' task-item--done' : '');
      li.dataset.id = task.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.status === 'done';
      checkbox.setAttribute('aria-label', 'Marcar tarefa como concluída');
      checkbox.addEventListener('change', () => {
        vscode.postMessage({ command: 'toggleTask', id: task.id });
      });

      const titleEl = document.createElement('span');
      titleEl.className = 'task-title';
      titleEl.textContent = task.title;

      const timeEl = document.createElement('span');
      timeEl.className = 'task-meta';
      timeEl.textContent = formatTime(task.createdAt);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--icon';
      removeBtn.title = 'Remover tarefa';
      removeBtn.innerHTML = '✕';
      removeBtn.setAttribute('aria-label', 'Remover tarefa');
      removeBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'removeTask', id: task.id });
      });

      li.appendChild(checkbox);
      li.appendChild(titleEl);
      li.appendChild(timeEl);
      li.appendChild(removeBtn);
      taskListEl.appendChild(li);
    });
  }

  /**
   * @param {number} done
   * @param {number} total
   */
  function updateProgress(done, total) {
    if (total === 0) {
      progressLabel.textContent = '';
      progressFill.style.width = '0%';
      return;
    }
    const pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + '%';
    progressLabel.textContent = done + ' de ' + total + ' tarefa' + (total !== 1 ? 's' : '') + ' concluída' + (done !== 1 ? 's' : '') + ' (' + pct + '%)';
  }

  // ── Render history ───────────────────────────────────────────────────────────
  /**
   * @param {DayRecord[]} history
   */
  function renderHistory(history) {
    historyListEl.innerHTML = '';

    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) {
      historyEmptyEl.classList.remove('hidden');
      return;
    }

    historyEmptyEl.classList.add('hidden');

    sorted.forEach((record) => {
      const done = record.tasks.filter((t) => t.status === 'done').length;
      const pending = record.tasks.length - done;

      const card = document.createElement('div');
      card.className = 'history-card';

      const header = document.createElement('div');
      header.className = 'history-card-header';
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute('aria-expanded', 'false');

      const chevron = document.createElement('span');
      chevron.className = 'history-chevron';
      chevron.textContent = '▶';

      const dateEl = document.createElement('span');
      dateEl.className = 'history-date';
      dateEl.textContent = formatDate(record.date);

      const stats = document.createElement('div');
      stats.className = 'history-stats';

      const doneBadge = document.createElement('span');
      doneBadge.className = 'stat-badge stat-badge--done';
      doneBadge.textContent = '✓ ' + done;
      doneBadge.title = done + ' concluída(s)';

      if (pending > 0) {
        const pendingBadge = document.createElement('span');
        pendingBadge.className = 'stat-badge stat-badge--pending';
        pendingBadge.textContent = '⏳ ' + pending;
        pendingBadge.title = pending + ' pendente(s)';
        stats.appendChild(doneBadge);
        stats.appendChild(pendingBadge);
      } else {
        stats.appendChild(doneBadge);
      }

      header.appendChild(chevron);
      header.appendChild(dateEl);
      header.appendChild(stats);

      const tasksContainer = document.createElement('div');
      tasksContainer.className = 'history-tasks';

      record.tasks.forEach((task) => {
        const item = document.createElement('div');
        item.className = 'history-task-item';

        const icon = document.createElement('span');
        icon.className = 'status-icon';
        icon.textContent = task.status === 'done' ? '✅' : '⏳';

        const titleEl = document.createElement('span');
        titleEl.className = 'history-task-title' + (task.status === 'done' ? ' history-task-title--done' : '');
        titleEl.textContent = task.title;

        item.appendChild(icon);
        item.appendChild(titleEl);
        tasksContainer.appendChild(item);
      });

      card.appendChild(header);
      card.appendChild(tasksContainer);
      historyListEl.appendChild(card);

      // Toggle expand/collapse
      function toggleCard() {
        const isOpen = card.classList.toggle('history-card--open');
        header.setAttribute('aria-expanded', String(isOpen));
      }

      header.addEventListener('click', toggleCard);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCard();
        }
      });
    });
  }

  // ── Toast notification ───────────────────────────────────────────────────────
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let toastTimer;

  /**
   * @param {string} message
   */
  function showToast(message) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 3500);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  /**
   * @param {string} iso
   * @returns {string}
   */
  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  /**
   * @param {string} dateStr YYYY-MM-DD
   * @returns {string}
   */
  function formatDate(dateStr) {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function updateTodayDate() {
    const now = new Date();
    todayDateEl.textContent = now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  // ── Message handling from backend ────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    const message = /** @type {{ command: string; tasks?: Task[]; history?: DayRecord[]; message?: string }} */ (event.data);

    switch (message.command) {
      case 'setState': {
        currentTasks = message.tasks ?? [];
        currentHistory = message.history ?? [];
        renderTasks(currentTasks);
        renderHistory(currentHistory);
        break;
      }
      case 'dayClosedSuccess': {
        showToast('🌙 Dia encerrado com sucesso! Histórico salvo.');
        renderTasks([]);
        renderHistory(currentHistory);
        break;
      }
      case 'error': {
        showToast('❌ ' + (message.message ?? 'Erro desconhecido.'));
        break;
      }
    }
  });

  // ── Init ─────────────────────────────────────────────────────────────────────
  updateTodayDate();
  vscode.postMessage({ command: 'getState' });
})();
