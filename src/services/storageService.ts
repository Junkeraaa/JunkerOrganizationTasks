import * as vscode from 'vscode';
import { Task, DayRecord, BacklogEntry, Project, TaskCategory, CategoryType } from '../types/task';

const TASKS_KEY = 'jkOrganization.tasks';
const HISTORY_KEY = 'jkOrganization.history';
const NOTES_KEY = 'jkOrganization.notes';
const BACKLOG_KEY = 'jkOrganization.backlog';
const PROJECTS_KEY = 'jkOrganization.projects';
const CATEGORIES_KEY = 'jkOrganization.categories';
const MIGRATION_V3_KEY = 'jkOrganization.migrationV3';

export class StorageService {
  constructor(private readonly context: vscode.ExtensionContext) {
    this._migrateToV3();
  }

  // ── Tasks ───────────────────────────────────────────────
  getTasks(): Task[] {
    return this.context.globalState.get<Task[]>(TASKS_KEY) ?? [];
  }

  saveTasks(tasks: Task[]): void {
    this.context.globalState.update(TASKS_KEY, tasks);
  }

  // ── Categories (custom only; daily + project are derived) ──
  getCategories(): TaskCategory[] {
    return this.context.globalState.get<TaskCategory[]>(CATEGORIES_KEY) ?? [];
  }

  saveCategories(categories: TaskCategory[]): void {
    this.context.globalState.update(CATEGORIES_KEY, categories);
  }

  /**
   * Builds the full ordered category list:
   * 1. Fixed "Tarefas Diárias"
   * 2. One category per active project
   * 3. Custom user categories
   */
  buildCategoryList(): TaskCategory[] {
    const list: TaskCategory[] = [
      { id: 'daily', name: 'Tarefas Diárias', type: 'daily', createdAt: '' },
    ];

    const projects = this.getProjects().filter((p) => p.status === 'active');
    for (const p of projects) {
      list.push({ id: p.id, name: p.title, type: 'project', createdAt: p.createdAt });
    }

    list.push(...this.getCategories());
    return list;
  }

  // ── Notes ───────────────────────────────────────────────
  getNotes(): string {
    return this.context.globalState.get<string>(NOTES_KEY) ?? '';
  }

  saveNotes(notes: string): void {
    this.context.globalState.update(NOTES_KEY, notes);
  }

  // ── History ─────────────────────────────────────────────
  getHistory(): DayRecord[] {
    return this.context.globalState.get<DayRecord[]>(HISTORY_KEY) ?? [];
  }

  saveHistory(history: DayRecord[]): void {
    this.context.globalState.update(HISTORY_KEY, history);
  }

  // ── Backlog ─────────────────────────────────────────────
  getBacklog(): BacklogEntry[] {
    return this.context.globalState.get<BacklogEntry[]>(BACKLOG_KEY) ?? [];
  }

  saveBacklog(backlog: BacklogEntry[]): void {
    this.context.globalState.update(BACKLOG_KEY, backlog);
  }

  // ── Projects ────────────────────────────────────────────
  getProjects(): Project[] {
    return this.context.globalState.get<Project[]>(PROJECTS_KEY) ?? [];
  }

  saveProjects(projects: Project[]): void {
    this.context.globalState.update(PROJECTS_KEY, projects);
  }

  // ── Close Day ───────────────────────────────────────────
  /**
   * Closes the current day (or a specified date for "last business day"):
   * - All done tasks across every category → saved to history
   * - Done tasks linked to projects → STAY in the task list (visible in project detail)
   * - Done tasks from daily/custom categories → removed from task list
   * - Pending tasks in "Tarefas Diárias" → moved to backlog
   * - Pending tasks in other categories → stay untouched
   * - Notes are archived and cleared
   */
  closeDay(dateOverride?: string): void {
    const now = new Date();
    const date = dateOverride ?? now.toISOString().split('T')[0];
    const notes = this.getNotes();
    const allTasks = this.getTasks();

    // Collect ALL done tasks for history
    const allDoneTasks = allTasks.filter((t) => t.status === 'done');

    // Separate daily tasks for backlog logic
    const dailyTasks = allTasks.filter((t) => t.categoryId === 'daily');

    // History: save ALL done tasks from ALL categories
    const history = this.getHistory();
    const existing = history.find((r) => r.date === date);

    // Build history tasks: all done tasks + pending daily tasks
    const historyTasks = [...allDoneTasks, ...dailyTasks.filter((t) => t.status === 'pending')];

    if (existing) {
      existing.tasks.push(...historyTasks);
      if (notes) {
        existing.notes = existing.notes ? existing.notes + '\n\n' + notes : notes;
      }
      existing.closedAt = now.toISOString();
    } else {
      history.push({
        date,
        tasks: historyTasks,
        notes,
        closedAt: now.toISOString(),
      });
    }
    this.context.globalState.update(HISTORY_KEY, history);

    // Backlog: only pending daily tasks
    const pendingDaily = dailyTasks.filter((t) => t.status === 'pending');
    if (pendingDaily.length > 0) {
      const backlog = this.getBacklog();
      const existingBacklog = backlog.find((e) => e.date === date);
      if (existingBacklog) {
        existingBacklog.tasks.push(...pendingDaily);
      } else {
        backlog.push({ date, tasks: pendingDaily });
      }
      this.context.globalState.update(BACKLOG_KEY, backlog);
    }

    // Determine which project IDs exist
    const projectIds = new Set(this.getProjects().map((p) => p.id));

    // Remaining tasks:
    // - Remove all daily tasks (done → history, pending → backlog)
    // - Project tasks done → KEEP (they stay visible in the project)
    // - Project tasks pending → keep
    // - Custom category done → remove
    // - Custom category pending → keep
    const remainingTasks = allTasks.filter((t) => {
      if (t.categoryId === 'daily') { return false; } // all daily removed
      if (t.status === 'done' && !projectIds.has(t.categoryId)) { return false; } // custom done removed
      return true; // project tasks (done or pending) and custom pending stay
    });

    this.context.globalState.update(TASKS_KEY, remainingTasks);
    this.context.globalState.update(NOTES_KEY, '');
  }

  /**
   * Calculates the last business day (Mon-Fri) before today.
   */
  getLastBusinessDay(): string {
    const today = new Date();
    const d = new Date(today);
    do {
      d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || d.getDay() === 6); // skip Sat/Sun
    return d.toISOString().split('T')[0];
  }

  // ── Migration ───────────────────────────────────────────
  private _migrateToV3(): void {
    if (this.context.globalState.get<boolean>(MIGRATION_V3_KEY)) {
      return;
    }

    // 1. Existing tasks without categoryId → assign 'daily'
    const tasks = this.getTasks();
    let changed = false;
    for (const t of tasks) {
      if (!t.categoryId) {
        (t as any).categoryId = 'daily';
        changed = true;
      }
    }

    // 2. Migrate project subtasks into the unified task list
    const projects = this.getProjects();
    for (const p of projects) {
      if (p.subtasks && p.subtasks.length > 0) {
        for (const st of p.subtasks) {
          if (!st.categoryId) {
            (st as any).categoryId = p.id;
          }
          // Avoid duplicates (check by id)
          if (!tasks.find((t) => t.id === st.id)) {
            tasks.push(st);
            changed = true;
          }
        }
        p.subtasks = [];
      }
    }

    if (changed) {
      this.saveTasks(tasks);
      this.saveProjects(projects);
    }

    this.context.globalState.update(MIGRATION_V3_KEY, true);
  }
}
