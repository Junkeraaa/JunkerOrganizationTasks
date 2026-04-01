// @ts-check
/// <reference lib="dom" />

/**
 * JK Organization Tasks — Frontend Logic
 *
 * @typedef {'pending' | 'done'} TaskStatus
 * @typedef {{ id: string; title: string; status: TaskStatus; createdAt: string }} Task
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
  const confirmAddBtn = /** @type {HTMLButtonElement} */ (document.getElementById('confirm-add-btn'));
  const cancelAddBtn = /** @type {HTMLButtonElement} */ (document.getElementById('cancel-add-btn'));
  const taskListEl = /** @type {HTMLUListElement} */ (document.getElementById('task-list'));
  const emptyStateEl = /** @type {HTMLElement} */ (document.getElementById('empty-state'));
  const closeDayBtn = /** @type {HTMLButtonElement} */ (document.getElementById('close-day-btn'));
  const progressFill = /** @type {HTMLElement} */ (document.getElementById('progress-fill'));
  const progressLabel = /** @type {HTMLElement} */ (document.getElementById('progress-label'));
  const notesTextarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('notes-textarea'));
  const notesStatus = /** @type {HTMLElement} */ (document.getElementById('notes-status'));
  const backlogListEl = /** @type {HTMLElement} */ (document.getElementById('backlog-list'));
  const backlogEmptyEl = /** @type {HTMLElement} */ (document.getElementById('backlog-empty-state'));
  const historyListEl = /** @type {HTMLElement} */ (document.getElementById('history-list'));
  const historyEmptyEl = /** @type {HTMLElement} */ (document.getElementById('history-empty-state'));
  const toastEl = /** @type {HTMLElement} */ (document.getElementById('toast'));

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

  /** @type {Task[]} */
  let currentTasks = [];
  /** @type {DayRecord[]} */
  let currentHistory = [];
  /** @type {BacklogEntry[]} */
  let currentBacklog = [];
  /** @type {Project[]} */
  let currentProjects = [];
  /** @type {string|null} */
  let openProjectId = null;

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

      // If switching to projects tab, show list (not detail) unless a project is open
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
    newTaskInput.focus();
    addTaskBtn.classList.add('hidden');
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
    vscode.postMessage({ command: 'addTask', title });
    closeAddForm();
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
    if (currentTasks.length === 0) {
      showToast('⚠️ Não há tarefas para encerrar o dia.');
      return;
    }
    vscode.postMessage({ command: 'closeDay' });
  });

  // ── Render tasks ─────────────────────────────────────────────────────────────
  /** @param {Task[]} tasks */
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

  /** @param {number} done @param {number} total */
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

        const icon = document.createElement('span');
        icon.className = 'status-icon';
        icon.textContent = '⏳';

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

        item.appendChild(icon);
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

      const subtasksDone = project.subtasks.filter((s) => s.status === 'done').length;
      if (project.subtasks.length > 0) {
        const progress = document.createElement('span');
        progress.className = 'project-card-progress';
        progress.textContent = subtasksDone + '/' + project.subtasks.length + ' subtarefas';
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

    // Subtasks
    subtaskList.innerHTML = '';
    project.subtasks.forEach((task) => {
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
        // Can't open URLs from webview directly; copy to clipboard
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
  }

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
        currentHistory = message.history ?? [];
        currentBacklog = message.backlog ?? [];
        currentProjects = message.projects ?? [];
        renderTasks(currentTasks);
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
        showToast('🌙 Dia encerrado com sucesso! Histórico salvo.');
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
