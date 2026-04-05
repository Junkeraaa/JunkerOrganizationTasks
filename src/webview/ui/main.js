// @ts-check
/// <reference lib="dom" />

/**
 * JK Organization Tasks — Frontend Logic (v3 — Categories)
 *
 * @typedef {'pending' | 'done'} TaskStatus
 * @typedef {'daily' | 'project' | 'custom'} CategoryType
 * @typedef {{ id: string; title: string; status: TaskStatus; createdAt: string; categoryId: string }} Task
 * @typedef {{ id: string; name: string; type: CategoryType; createdAt: string }} TaskCategory
 * @typedef {{ date: string; tasks: Task[]; notes?: string; closedAt: string }} DayRecord
 * @typedef {{ date: string; tasks: Task[] }} BacklogEntry
 * @typedef {{ id: string; label: string; url: string }} ProjectLink
 * @typedef {'active' | 'done'} ProjectStatus
 * @typedef {{ id: string; title: string; status: ProjectStatus; sprint: string; notes: string; subtasks: Task[]; links: ProjectLink[]; createdAt: string }} Project
 */

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // ── DOM references ──────────────────────────────────────────────────────────
  const todayDateEl = /** @type {HTMLElement} */ (document.getElementById('today-date'));
  const addTaskBtn = /** @type {HTMLButtonElement} */ (document.getElementById('add-task-btn'));
  const addTaskForm = /** @type {HTMLElement} */ (document.getElementById('add-task-form'));
  const newTaskInput = /** @type {HTMLInputElement} */ (document.getElementById('new-task-input'));
  const newTaskCategory = /** @type {HTMLSelectElement} */ (document.getElementById('new-task-category'));
  const confirmAddBtn = /** @type {HTMLButtonElement} */ (document.getElementById('confirm-add-btn'));
  const cancelAddBtn = /** @type {HTMLButtonElement} */ (document.getElementById('cancel-add-btn'));
  const categoriesContainer = /** @type {HTMLElement} */ (document.getElementById('categories-container'));
  const emptyStateEl = /** @type {HTMLElement} */ (document.getElementById('empty-state'));
  const closeDayBtn = /** @type {HTMLButtonElement} */ (document.getElementById('close-day-btn'));
  const closeLastBizDayBtn = /** @type {HTMLButtonElement} */ (document.getElementById('close-last-business-day-btn'));
  const progressFill = /** @type {HTMLElement} */ (document.getElementById('progress-fill'));
  const progressLabel = /** @type {HTMLElement} */ (document.getElementById('progress-label'));
  const notesTextarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('notes-textarea'));
  const notesStatus = /** @type {HTMLElement} */ (document.getElementById('notes-status'));
  const backlogListEl = /** @type {HTMLElement} */ (document.getElementById('backlog-list'));
  const backlogEmptyEl = /** @type {HTMLElement} */ (document.getElementById('backlog-empty-state'));
  const historyListEl = /** @type {HTMLElement} */ (document.getElementById('history-list'));
  const historyEmptyEl = /** @type {HTMLElement} */ (document.getElementById('history-empty-state'));
  const toastEl = /** @type {HTMLElement} */ (document.getElementById('toast'));

  // Category form DOM
  const addCategoryBtn = /** @type {HTMLButtonElement} */ (document.getElementById('add-category-btn'));
  const addCategoryForm = /** @type {HTMLElement} */ (document.getElementById('add-category-form'));
  const newCategoryInput = /** @type {HTMLInputElement} */ (document.getElementById('new-category-input'));
  const confirmCategoryBtn = /** @type {HTMLButtonElement} */ (document.getElementById('confirm-category-btn'));
  const cancelCategoryBtn = /** @type {HTMLButtonElement} */ (document.getElementById('cancel-category-btn'));

  // Projects DOM
  const addProjectBtn = /** @type {HTMLButtonElement} */ (document.getElementById('add-project-btn'));
  const addProjectForm = /** @type {HTMLElement} */ (document.getElementById('add-project-form'));
  const newProjectInput = /** @type {HTMLInputElement} */ (document.getElementById('new-project-input'));
  const confirmProjectBtn = /** @type {HTMLButtonElement} */ (document.getElementById('confirm-project-btn'));
  const cancelProjectBtn = /** @type {HTMLButtonElement} */ (document.getElementById('cancel-project-btn'));
  const projectListEl = /** @type {HTMLElement} */ (document.getElementById('project-list'));
  const projectsEmptyEl = /** @type {HTMLElement} */ (document.getElementById('projects-empty-state'));

  // Project detail DOM
  const detailPanel = /** @type {HTMLElement} */ (document.getElementById('panel-project-detail'));
  const detailBackBtn = /** @type {HTMLButtonElement} */ (document.getElementById('detail-back-btn'));
  const detailStatusBadge = /** @type {HTMLElement} */ (document.getElementById('detail-status-badge'));
  const detailTitle = /** @type {HTMLElement} */ (document.getElementById('detail-title'));
  const detailSprint = /** @type {HTMLInputElement} */ (document.getElementById('detail-sprint'));
  const subtaskList = /** @type {HTMLUListElement} */ (document.getElementById('subtask-list'));
  const newSubtaskInput = /** @type {HTMLInputElement} */ (document.getElementById('new-subtask-input'));
  const confirmSubtaskBtn = /** @type {HTMLButtonElement} */ (document.getElementById('confirm-subtask-btn'));
  const detailNotes = /** @type {HTMLTextAreaElement} */ (document.getElementById('detail-notes'));
  const detailNotesStatus = /** @type {HTMLElement} */ (document.getElementById('detail-notes-status'));
  const linkList = /** @type {HTMLUListElement} */ (document.getElementById('link-list'));
  const newLinkLabel = /** @type {HTMLInputElement} */ (document.getElementById('new-link-label'));
  const newLinkUrl = /** @type {HTMLInputElement} */ (document.getElementById('new-link-url'));
  const confirmLinkBtn = /** @type {HTMLButtonElement} */ (document.getElementById('confirm-link-btn'));
  const completeProjectBtn = /** @type {HTMLButtonElement} */ (document.getElementById('complete-project-btn'));
  const deleteProjectBtn = /** @type {HTMLButtonElement} */ (document.getElementById('delete-project-btn'));

  // Evidence DOM
  const evidenceDropzone = /** @type {HTMLElement} */ (document.getElementById('evidence-dropzone'));
  const evidenceFileInput = /** @type {HTMLInputElement} */ (document.getElementById('evidence-file-input'));
  const evidenceGallery = /** @type {HTMLElement} */ (document.getElementById('evidence-gallery'));

  /** @type {Task[]} */
  let currentTasks = [];
  /** @type {TaskCategory[]} */
  let currentCategories = [];
  /** @type {DayRecord[]} */
  let currentHistory = [];
  /** @type {BacklogEntry[]} */
  let currentBacklog = [];
  /** @type {Project[]} */
  let currentProjects = [];
  /** @type {string|null} */
  let openProjectId = null;
  /** @type {Set<string>} Track collapsed category ids */
  const collapsedCategories = new Set();

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

      if (target === 'projects') {
        if (openProjectId) {
          detailPanel.classList.add('panel--active');
        } else {
          const panel = document.getElementById('panel-projects');
          if (panel) { panel.classList.add('panel--active'); }
        }
      } else {
        openProjectId = null;
        const panel = document.getElementById('panel-' + target);
        if (panel) { panel.classList.add('panel--active'); }
      }
    });
  });

  // ── Add task form ────────────────────────────────────────────────────────────
  addTaskBtn.addEventListener('click', () => {
    addTaskForm.classList.remove('hidden');
    addCategoryForm.classList.add('hidden');
    newTaskInput.focus();
    addTaskBtn.classList.add('hidden');
    populateCategorySelect(newTaskCategory, 'daily');
  });

  cancelAddBtn.addEventListener('click', closeAddForm);
  confirmAddBtn.addEventListener('click', submitNewTask);

  newTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { submitNewTask(); }
    else if (e.key === 'Escape') { closeAddForm(); }
  });

  function closeAddForm() {
    addTaskForm.classList.add('hidden');
    addTaskBtn.classList.remove('hidden');
    newTaskInput.value = '';
  }

  function submitNewTask() {
    const title = newTaskInput.value.trim();
    if (!title) { newTaskInput.focus(); return; }
    const categoryId = newTaskCategory.value || 'daily';
    vscode.postMessage({ command: 'addTask', title, categoryId });
    closeAddForm();
  }

  // ── Add category form ────────────────────────────────────────────────────────
  addCategoryBtn.addEventListener('click', () => {
    addCategoryForm.classList.remove('hidden');
    addTaskForm.classList.add('hidden');
    addTaskBtn.classList.remove('hidden');
    newCategoryInput.focus();
  });

  cancelCategoryBtn.addEventListener('click', closeCategoryForm);
  confirmCategoryBtn.addEventListener('click', submitNewCategory);

  newCategoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { submitNewCategory(); }
    else if (e.key === 'Escape') { closeCategoryForm(); }
  });

  function closeCategoryForm() {
    addCategoryForm.classList.add('hidden');
    newCategoryInput.value = '';
  }

  function submitNewCategory() {
    const name = newCategoryInput.value.trim();
    if (!name) { newCategoryInput.focus(); return; }
    vscode.postMessage({ command: 'addCategory', name });
    closeCategoryForm();
  }

  // ── Category select helper ───────────────────────────────────────────────────
  /** @param {HTMLSelectElement} select @param {string} selectedId */
  function populateCategorySelect(select, selectedId) {
    select.innerHTML = '';
    currentCategories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (cat.id === selectedId) { opt.selected = true; }
      select.appendChild(opt);
    });
  }

  // ── Notes auto-save ──────────────────────────────────────────────────────────
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let notesSaveTimer;

  notesTextarea.addEventListener('input', () => {
    clearTimeout(notesSaveTimer);
    notesStatus.textContent = '';
    notesSaveTimer = setTimeout(() => {
      vscode.postMessage({ command: 'saveNotes', notes: notesTextarea.value });
      notesStatus.textContent = '✓ Salvo';
      setTimeout(() => { notesStatus.textContent = ''; }, 2000);
    }, 600);
  });

  // ── Close day ────────────────────────────────────────────────────────────────
  closeDayBtn.addEventListener('click', () => {
    const dailyTasks = currentTasks.filter((t) => t.categoryId === 'daily');
    if (dailyTasks.length === 0 && currentTasks.length === 0) {
      showToast('⚠️ Não há tarefas para encerrar o dia.');
      return;
    }
    vscode.postMessage({ command: 'closeDay' });
  });

  closeLastBizDayBtn.addEventListener('click', () => {
    if (currentTasks.length === 0) {
      showToast('⚠️ Não há tarefas para encerrar o dia.');
      return;
    }
    vscode.postMessage({ command: 'closeDayLastBusinessDay' });
  });

  // ── Render tasks with categories ─────────────────────────────────────────────
  /** @param {Task[]} tasks @param {TaskCategory[]} categories */
  function renderTasksPage(tasks, categories) {
    categoriesContainer.innerHTML = '';

    if (tasks.length === 0 && categories.length <= 1) {
      emptyStateEl.classList.remove('hidden');
      closeDayBtn.disabled = true;
      updateProgress(0, 0);
      return;
    }

    emptyStateEl.classList.add('hidden');
    closeDayBtn.disabled = false;

    // Progress: only daily tasks
    const dailyTasks = tasks.filter((t) => t.categoryId === 'daily');
    const dailyDone = dailyTasks.filter((t) => t.status === 'done').length;
    updateProgress(dailyDone, dailyTasks.length);

    categories.forEach((cat) => {
      const catTasks = tasks.filter((t) => t.categoryId === cat.id);
      const section = buildCategorySection(cat, catTasks, categories);
      categoriesContainer.appendChild(section);
    });
  }

  /**
   * @param {TaskCategory} category
   * @param {Task[]} tasks
   * @param {TaskCategory[]} allCategories
   * @returns {HTMLElement}
   */
  function buildCategorySection(category, tasks, allCategories) {
    const section = document.createElement('div');
    section.className = 'category-section';
    if (collapsedCategories.has(category.id)) {
      section.classList.add('category-section--collapsed');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');

    const chevron = document.createElement('span');
    chevron.className = 'category-chevron';
    chevron.textContent = '▼';

    const icon = document.createElement('span');
    icon.className = 'category-icon';
    if (category.type === 'daily') { icon.textContent = '📌'; }
    else if (category.type === 'project') { icon.textContent = '📂'; }
    else { icon.textContent = '📁'; }

    const nameEl = document.createElement('span');
    nameEl.className = 'category-name';
    nameEl.textContent = category.name;

    const countEl = document.createElement('span');
    countEl.className = 'category-count';
    const doneTasks = tasks.filter((t) => t.status === 'done').length;
    countEl.textContent = doneTasks + '/' + tasks.length;

    const headerActions = document.createElement('div');
    headerActions.className = 'category-header-actions';

    // Inline add button
    const inlineAddBtn = document.createElement('button');
    inlineAddBtn.className = 'btn btn--icon category-inline-add';
    inlineAddBtn.title = 'Adicionar tarefa';
    inlineAddBtn.textContent = '+';
    inlineAddBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Make sure the section is expanded
      section.classList.remove('category-section--collapsed');
      collapsedCategories.delete(category.id);
      const form = section.querySelector('.category-inline-form');
      if (form) {
        form.classList.toggle('hidden');
        const input = /** @type {HTMLInputElement|null} */ (form.querySelector('.category-inline-input'));
        if (input) { input.focus(); }
      }
    });
    headerActions.appendChild(inlineAddBtn);

    // Delete button for custom categories
    if (category.type === 'custom') {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn--icon';
      delBtn.title = 'Remover categoria';
      delBtn.innerHTML = '✕';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'removeCategory', id: category.id });
      });
      headerActions.appendChild(delBtn);
    }

    header.appendChild(chevron);
    header.appendChild(icon);
    header.appendChild(nameEl);
    header.appendChild(countEl);
    header.appendChild(headerActions);

    // Toggle collapse
    header.addEventListener('click', () => {
      const isCollapsed = section.classList.toggle('category-section--collapsed');
      if (isCollapsed) { collapsedCategories.add(category.id); }
      else { collapsedCategories.delete(category.id); }
    });
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click(); }
    });

    // Body
    const body = document.createElement('div');
    body.className = 'category-body';

    // Inline add form
    const inlineForm = document.createElement('div');
    inlineForm.className = 'category-inline-form hidden';

    const inlineRow = document.createElement('div');
    inlineRow.className = 'input-row';

    const inlineInput = document.createElement('input');
    inlineInput.type = 'text';
    inlineInput.className = 'task-input category-inline-input';
    inlineInput.placeholder = 'Nova tarefa...';
    inlineInput.maxLength = 200;
    inlineInput.autocomplete = 'off';

    const inlineConfirm = document.createElement('button');
    inlineConfirm.className = 'btn btn--confirm btn--small';
    inlineConfirm.textContent = 'Adicionar';

    function submitInline() {
      const title = inlineInput.value.trim();
      if (!title) { inlineInput.focus(); return; }
      vscode.postMessage({ command: 'addTask', title, categoryId: category.id });
      inlineInput.value = '';
      inlineInput.focus();
    }

    inlineConfirm.addEventListener('click', submitInline);
    inlineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { submitInline(); }
      else if (e.key === 'Escape') { inlineForm.classList.add('hidden'); }
    });

    inlineRow.appendChild(inlineInput);
    inlineRow.appendChild(inlineConfirm);
    inlineForm.appendChild(inlineRow);
    body.appendChild(inlineForm);

    // Task items
    if (tasks.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'category-empty';
      emptyMsg.textContent = 'Sem tarefas nesta categoria';
      body.appendChild(emptyMsg);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'task-list';
      tasks.forEach((task) => {
        ul.appendChild(buildTaskItem(task, allCategories));
      });
      body.appendChild(ul);
    }

    section.appendChild(header);
    section.appendChild(body);
    return section;
  }

  /**
   * @param {Task} task
   * @param {TaskCategory[]} allCategories
   * @returns {HTMLLIElement}
   */
  function buildTaskItem(task, allCategories) {
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

    // Move dropdown
    const moveSelect = document.createElement('select');
    moveSelect.className = 'task-move-select';
    moveSelect.title = 'Mover para outra categoria';
    allCategories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (cat.id === task.categoryId) { opt.selected = true; }
      moveSelect.appendChild(opt);
    });
    moveSelect.addEventListener('change', () => {
      vscode.postMessage({ command: 'moveTask', id: task.id, categoryId: moveSelect.value });
    });

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
    li.appendChild(moveSelect);
    li.appendChild(removeBtn);
    return li;
  }

  /** @param {number} done @param {number} total */
  function updateProgress(done, total) {
    if (total === 0) {
      progressLabel.textContent = 'Tarefas Diárias: nenhuma tarefa';
      progressFill.style.width = '0%';
      return;
    }
    const pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + '%';
    progressLabel.textContent = 'Tarefas Diárias: ' + done + ' de ' + total + ' concluída' + (done !== 1 ? 's' : '') + ' (' + pct + '%)';
  }

  // ── Render backlog ───────────────────────────────────────────────────────────
  /** @param {BacklogEntry[]} backlog */
  function renderBacklog(backlog) {
    backlogListEl.innerHTML = '';

    const sorted = [...backlog].sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) {
      backlogEmptyEl.classList.remove('hidden');
      return;
    }

    backlogEmptyEl.classList.add('hidden');

    sorted.forEach((entry) => {
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
      dateEl.textContent = formatDate(entry.date);

      const stats = document.createElement('div');
      stats.className = 'history-stats';

      const pendingBadge = document.createElement('span');
      pendingBadge.className = 'stat-badge stat-badge--pending';
      pendingBadge.textContent = '⏳ ' + entry.tasks.length;
      stats.appendChild(pendingBadge);

      header.appendChild(chevron);
      header.appendChild(dateEl);
      header.appendChild(stats);

      const tasksContainer = document.createElement('div');
      tasksContainer.className = 'history-tasks';

      entry.tasks.forEach((task) => {
        const item = document.createElement('div');
        item.className = 'history-task-item backlog-task-item';

        const iconEl = document.createElement('span');
        iconEl.className = 'status-icon';
        iconEl.textContent = '⏳';

        const titleEl = document.createElement('span');
        titleEl.className = 'history-task-title';
        titleEl.textContent = task.title;

        const actions = document.createElement('div');
        actions.className = 'backlog-actions';

        const completeBtn = document.createElement('button');
        completeBtn.className = 'btn btn--small btn--confirm';
        completeBtn.textContent = '✓ Concluir';
        completeBtn.title = 'Marcar como concluída e mover para hoje';
        completeBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'completeBacklogTask', id: task.id });
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn--icon';
        removeBtn.title = 'Remover tarefa pendente';
        removeBtn.innerHTML = '✕';
        removeBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'removeBacklogTask', id: task.id });
        });

        actions.appendChild(completeBtn);
        actions.appendChild(removeBtn);

        item.appendChild(iconEl);
        item.appendChild(titleEl);
        item.appendChild(actions);
        tasksContainer.appendChild(item);
      });

      card.appendChild(header);
      card.appendChild(tasksContainer);
      backlogListEl.appendChild(card);

      function toggleCard() {
        const isOpen = card.classList.toggle('history-card--open');
        header.setAttribute('aria-expanded', String(isOpen));
      }
      header.addEventListener('click', toggleCard);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(); }
      });
    });
  }

  // ── Render history ───────────────────────────────────────────────────────────
  /** @param {DayRecord[]} history */
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
      stats.appendChild(doneBadge);

      if (pending > 0) {
        const pendingBadge = document.createElement('span');
        pendingBadge.className = 'stat-badge stat-badge--pending';
        pendingBadge.textContent = '⏳ ' + pending;
        stats.appendChild(pendingBadge);
      }

      if (record.notes) {
        const notesBadge = document.createElement('span');
        notesBadge.className = 'stat-badge stat-badge--notes';
        notesBadge.textContent = '📝';
        stats.appendChild(notesBadge);
      }

      header.appendChild(chevron);
      header.appendChild(dateEl);
      header.appendChild(stats);

      const tasksContainer = document.createElement('div');
      tasksContainer.className = 'history-tasks';

      record.tasks.forEach((task) => {
        const item = document.createElement('div');
        item.className = 'history-task-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox task-checkbox--small';
        checkbox.checked = task.status === 'done';
        checkbox.setAttribute('aria-label', 'Alterar status da tarefa');
        checkbox.addEventListener('change', () => {
          vscode.postMessage({ command: 'toggleHistoryTask', id: task.id });
        });

        const titleEl = document.createElement('span');
        titleEl.className = 'history-task-title' + (task.status === 'done' ? ' history-task-title--done' : '');
        titleEl.textContent = task.title;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn--icon';
        removeBtn.title = 'Remover do histórico';
        removeBtn.innerHTML = '✕';
        removeBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'removeHistoryTask', id: task.id });
        });

        item.appendChild(checkbox);
        item.appendChild(titleEl);
        item.appendChild(removeBtn);
        tasksContainer.appendChild(item);
      });

      // Show notes if present
      if (record.notes) {
        const notesBlock = document.createElement('div');
        notesBlock.className = 'history-notes';
        notesBlock.textContent = record.notes;
        tasksContainer.appendChild(notesBlock);
      }

      card.appendChild(header);
      card.appendChild(tasksContainer);
      historyListEl.appendChild(card);

      function toggleCard() {
        const isOpen = card.classList.toggle('history-card--open');
        header.setAttribute('aria-expanded', String(isOpen));
      }
      header.addEventListener('click', toggleCard);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(); }
      });
    });
  }

  // ── Projects ─────────────────────────────────────────────────────────────────
  addProjectBtn.addEventListener('click', () => {
    addProjectForm.classList.remove('hidden');
    newProjectInput.focus();
    addProjectBtn.classList.add('hidden');
  });

  cancelProjectBtn.addEventListener('click', closeProjectForm);
  confirmProjectBtn.addEventListener('click', submitNewProject);
  newProjectInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { submitNewProject(); }
    else if (e.key === 'Escape') { closeProjectForm(); }
  });

  function closeProjectForm() {
    addProjectForm.classList.add('hidden');
    addProjectBtn.classList.remove('hidden');
    newProjectInput.value = '';
  }

  function submitNewProject() {
    const title = newProjectInput.value.trim();
    if (!title) { newProjectInput.focus(); return; }
    vscode.postMessage({ command: 'addProject', title });
    closeProjectForm();
  }

  /** @param {Project[]} projects */
  function renderProjects(projects) {
    projectListEl.innerHTML = '';

    if (projects.length === 0) {
      projectsEmptyEl.classList.remove('hidden');
      return;
    }

    projectsEmptyEl.classList.add('hidden');

    // Active projects first, then done
    const sorted = [...projects].sort((a, b) => {
      if (a.status !== b.status) { return a.status === 'active' ? -1 : 1; }
      return b.createdAt.localeCompare(a.createdAt);
    });

    sorted.forEach((project) => {
      const card = document.createElement('div');
      card.className = 'project-card' + (project.status === 'done' ? ' project-card--done' : '');
      card.addEventListener('click', () => openProject(project.id));

      const titleRow = document.createElement('div');
      titleRow.className = 'project-card-title-row';

      const statusIcon = document.createElement('span');
      statusIcon.className = 'project-status-icon';
      statusIcon.textContent = project.status === 'done' ? '✅' : '📂';

      const titleEl = document.createElement('span');
      titleEl.className = 'project-card-title';
      titleEl.textContent = project.title;

      titleRow.appendChild(statusIcon);
      titleRow.appendChild(titleEl);

      const meta = document.createElement('div');
      meta.className = 'project-card-meta';

      if (project.sprint) {
        const sprintBadge = document.createElement('span');
        sprintBadge.className = 'sprint-badge';
        sprintBadge.textContent = project.sprint;
        meta.appendChild(sprintBadge);
      }

      // Subtasks count from the unified task list
      const projectTasks = currentTasks.filter((t) => t.categoryId === project.id);
      const subtasksDone = projectTasks.filter((s) => s.status === 'done').length;
      if (projectTasks.length > 0) {
        const progress = document.createElement('span');
        progress.className = 'project-card-progress';
        progress.textContent = subtasksDone + '/' + projectTasks.length + ' subtarefas';
        meta.appendChild(progress);
      }

      if (project.links.length > 0) {
        const linksCount = document.createElement('span');
        linksCount.className = 'project-card-links';
        linksCount.textContent = '🔗 ' + project.links.length;
        meta.appendChild(linksCount);
      }

      card.appendChild(titleRow);
      card.appendChild(meta);
      projectListEl.appendChild(card);
    });
  }

  /** @param {string} projectId */
  function openProject(projectId) {
    openProjectId = projectId;
    const projectsPanel = document.getElementById('panel-projects');
    if (projectsPanel) { projectsPanel.classList.remove('panel--active'); }
    detailPanel.classList.add('panel--active');
    renderProjectDetail();
  }

  function renderProjectDetail() {
    const project = currentProjects.find((p) => p.id === openProjectId);
    if (!project) {
      openProjectId = null;
      return;
    }

    detailTitle.textContent = project.title;
    detailStatusBadge.textContent = project.status === 'done' ? '✅ Concluído' : '🟢 Ativo';
    detailStatusBadge.className = 'detail-status-badge detail-status-badge--' + project.status;
    detailSprint.value = project.sprint;
    detailNotes.value = project.notes;

    // Update complete button text
    if (project.status === 'done') {
      completeProjectBtn.textContent = '🔄 Reabrir Projeto';
      completeProjectBtn.className = 'btn btn--reopen';
    } else {
      completeProjectBtn.textContent = '✅ Marcar como Concluída';
      completeProjectBtn.className = 'btn btn--complete';
    }

    // Subtasks from the unified task list
    const projectTasks = currentTasks.filter((t) => t.categoryId === project.id);
    subtaskList.innerHTML = '';
    projectTasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.status === 'done' ? ' task-item--done' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.status === 'done';
      checkbox.addEventListener('change', () => {
        vscode.postMessage({ command: 'toggleProjectSubtask', id: task.id });
      });

      const titleEl = document.createElement('span');
      titleEl.className = 'task-title';
      titleEl.textContent = task.title;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--icon';
      removeBtn.title = 'Remover subtarefa';
      removeBtn.innerHTML = '✕';
      removeBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'removeProjectSubtask', id: task.id });
      });

      li.appendChild(checkbox);
      li.appendChild(titleEl);
      li.appendChild(removeBtn);
      subtaskList.appendChild(li);
    });

    // Links
    linkList.innerHTML = '';
    project.links.forEach((link) => {
      const li = document.createElement('li');
      li.className = 'link-item';

      const anchor = document.createElement('a');
      anchor.className = 'link-anchor';
      anchor.textContent = link.label;
      anchor.title = link.url;
      anchor.href = '#';
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(link.url).then(() => {
          showToast('🔗 Link copiado: ' + link.url);
        });
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--icon';
      removeBtn.title = 'Remover link';
      removeBtn.innerHTML = '✕';
      removeBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'removeProjectLink', id: link.id });
      });

      li.appendChild(anchor);
      li.appendChild(removeBtn);
      linkList.appendChild(li);
    });

    // Evidences
    evidenceGallery.innerHTML = '';
    const evidences = project.evidences || [];
    evidences.forEach((ev) => {
      const card = document.createElement('div');
      card.className = 'evidence-card';

      const img = document.createElement('img');
      img.className = 'evidence-thumb';
      img.src = ev.dataUrl;
      img.alt = ev.label;
      img.title = ev.label;
      img.addEventListener('click', () => {
        // Open image in a modal-like overlay
        const overlay = document.createElement('div');
        overlay.className = 'evidence-overlay';
        const fullImg = document.createElement('img');
        fullImg.className = 'evidence-full';
        fullImg.src = ev.dataUrl;
        fullImg.alt = ev.label;
        overlay.appendChild(fullImg);
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
      });

      const info = document.createElement('div');
      info.className = 'evidence-info';

      const labelEl = document.createElement('span');
      labelEl.className = 'evidence-label';
      labelEl.textContent = ev.label;

      const actions = document.createElement('div');
      actions.className = 'evidence-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn--icon evidence-action-btn';
      copyBtn.title = 'Copiar imagem';
      copyBtn.textContent = '📋';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          const blob = dataUrlToBlob(ev.dataUrl);
          navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
            .then(() => showToast('📋 Imagem copiada!'))
            .catch(() => {
              navigator.clipboard.writeText(ev.dataUrl)
                .then(() => showToast('📋 Dados da imagem copiados!'))
                .catch(() => showToast('❌ Erro ao copiar.'));
            });
        } catch (_err) {
          showToast('❌ Erro ao copiar imagem.');
        }
      });

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn--icon evidence-action-btn';
      downloadBtn.title = 'Baixar imagem';
      downloadBtn.textContent = '⬇️';
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'downloadEvidence', dataUrl: ev.dataUrl, label: ev.label });
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--icon evidence-action-btn';
      removeBtn.title = 'Remover evidência';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'removeProjectEvidence', id: ev.id });
      });

      actions.appendChild(copyBtn);
      actions.appendChild(downloadBtn);
      actions.appendChild(removeBtn);

      info.appendChild(labelEl);
      info.appendChild(actions);

      card.appendChild(img);
      card.appendChild(info);
      evidenceGallery.appendChild(card);
    });
  }

  // ── Evidence: paste & upload ──────────────────────────────────────────────────
  /** @param {File} file */
  function uploadEvidenceFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('⚠️ Apenas imagens são permitidas.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('⚠️ Imagem muito grande (máx 5 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (!openProjectId || typeof reader.result !== 'string') { return; }
      const label = file.name || 'Evidência';
      vscode.postMessage({ command: 'addProjectEvidence', projectId: openProjectId, label, dataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  }

  evidenceDropzone.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) { return; }
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) { uploadEvidenceFile(file); }
        return;
      }
    }
  });

  // Also listen for paste on the whole detail panel so Ctrl+V works anywhere in the detail view
  detailPanel.addEventListener('paste', (e) => {
    // Only handle if we're in an open project and not pasting into a text field
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') { return; }
    const items = e.clipboardData?.items;
    if (!items || !openProjectId) { return; }
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) { uploadEvidenceFile(file); }
        return;
      }
    }
  });

  evidenceFileInput.addEventListener('change', () => {
    const file = evidenceFileInput.files?.[0];
    if (file) { uploadEvidenceFile(file); }
    evidenceFileInput.value = '';
  });

  // Detail: Back
  detailBackBtn.addEventListener('click', () => {
    openProjectId = null;
    detailPanel.classList.remove('panel--active');
    const projectsPanel = document.getElementById('panel-projects');
    if (projectsPanel) { projectsPanel.classList.add('panel--active'); }
  });

  // Detail: Sprint save
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let sprintSaveTimer;
  detailSprint.addEventListener('input', () => {
    clearTimeout(sprintSaveTimer);
    sprintSaveTimer = setTimeout(() => {
      if (!openProjectId) { return; }
      vscode.postMessage({ command: 'updateProject', id: openProjectId, field: 'sprint', value: detailSprint.value });
    }, 600);
  });

  // Detail: Notes save
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let detailNotesSaveTimer;
  detailNotes.addEventListener('input', () => {
    clearTimeout(detailNotesSaveTimer);
    detailNotesStatus.textContent = '';
    detailNotesSaveTimer = setTimeout(() => {
      if (!openProjectId) { return; }
      vscode.postMessage({ command: 'updateProject', id: openProjectId, field: 'notes', value: detailNotes.value });
      detailNotesStatus.textContent = '✓ Salvo';
      setTimeout(() => { detailNotesStatus.textContent = ''; }, 2000);
    }, 600);
  });

  // Detail: Add subtask
  confirmSubtaskBtn.addEventListener('click', submitNewSubtask);
  newSubtaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { submitNewSubtask(); }
  });
  function submitNewSubtask() {
    const title = newSubtaskInput.value.trim();
    if (!title || !openProjectId) { newSubtaskInput.focus(); return; }
    vscode.postMessage({ command: 'addProjectSubtask', projectId: openProjectId, title });
    newSubtaskInput.value = '';
  }

  // Detail: Add link
  confirmLinkBtn.addEventListener('click', submitNewLink);
  newLinkUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { submitNewLink(); }
  });
  function submitNewLink() {
    const url = newLinkUrl.value.trim();
    if (!url || !openProjectId) { newLinkUrl.focus(); return; }
    const label = newLinkLabel.value.trim();
    vscode.postMessage({ command: 'addProjectLink', projectId: openProjectId, label, url });
    newLinkLabel.value = '';
    newLinkUrl.value = '';
  }

  // Detail: Complete / Reopen
  completeProjectBtn.addEventListener('click', () => {
    if (!openProjectId) { return; }
    const project = currentProjects.find((p) => p.id === openProjectId);
    if (!project) { return; }
    const newStatus = project.status === 'done' ? 'active' : 'done';
    vscode.postMessage({ command: 'updateProject', id: openProjectId, field: 'status', value: newStatus });
  });

  // Detail: Delete
  deleteProjectBtn.addEventListener('click', () => {
    if (!openProjectId) { return; }
    vscode.postMessage({ command: 'removeProject', id: openProjectId });
    openProjectId = null;
    detailPanel.classList.remove('panel--active');
    const projectsPanel = document.getElementById('panel-projects');
    if (projectsPanel) { projectsPanel.classList.add('panel--active'); }
  });

  // ── Toast notification ───────────────────────────────────────────────────────
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let toastTimer;

  /** @param {string} message */
  function showToast(message) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    toastTimer = setTimeout(() => { toastEl.classList.add('hidden'); }, 3500);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  /** @param {string} dataUrl @returns {Blob} */
  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(parts[1]);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) { arr[i] = binary.charCodeAt(i); }
    return new Blob([arr], { type: mime });
  }

  /** @param {string} iso @returns {string} */
  function formatTime(iso) {
    try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  }

  /** @param {string} dateStr @returns {string} */
  function formatDate(dateStr) {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  }

  function updateTodayDate() {
    const now = new Date();
    todayDateEl.textContent = now.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  // ── Message handling from backend ────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.command) {
      case 'setState': {
        currentTasks = message.tasks ?? [];
        currentCategories = message.categories ?? [];
        currentHistory = message.history ?? [];
        currentBacklog = message.backlog ?? [];
        currentProjects = message.projects ?? [];
        renderTasksPage(currentTasks, currentCategories);
        renderBacklog(currentBacklog);
        renderHistory(currentHistory);
        renderProjects(currentProjects);
        if (openProjectId) { renderProjectDetail(); }
        if (message.notes !== undefined) {
          notesTextarea.value = message.notes;
        }
        break;
      }
      case 'dayClosedSuccess': {
        if (message.date) {
          showToast('📅 Dia encerrado como ' + formatDate(message.date) + '! Histórico salvo.');
        } else {
          showToast('🌙 Dia encerrado com sucesso! Histórico salvo.');
        }
        break;
      }
      case 'evidenceDownloaded': {
        showToast('⬇️ Imagem salva com sucesso!');
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
