import * as vscode from 'vscode';
import { Task, DayRecord, BacklogEntry, Project } from '../types/task';

const TASKS_KEY = 'jkOrganization.tasks';
const HISTORY_KEY = 'jkOrganization.history';
const NOTES_KEY = 'jkOrganization.notes';
const BACKLOG_KEY = 'jkOrganization.backlog';
const PROJECTS_KEY = 'jkOrganization.projects';

export class StorageService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getTasks(): Task[] {
    return this.context.globalState.get<Task[]>(TASKS_KEY) ?? [];
  }

  saveTasks(tasks: Task[]): void {
    this.context.globalState.update(TASKS_KEY, tasks);
  }

  getNotes(): string {
    return this.context.globalState.get<string>(NOTES_KEY) ?? '';
  }

  saveNotes(notes: string): void {
    this.context.globalState.update(NOTES_KEY, notes);
  }

  getHistory(): DayRecord[] {
    return this.context.globalState.get<DayRecord[]>(HISTORY_KEY) ?? [];
  }

  saveHistory(history: DayRecord[]): void {
    this.context.globalState.update(HISTORY_KEY, history);
  }

  getBacklog(): BacklogEntry[] {
    return this.context.globalState.get<BacklogEntry[]>(BACKLOG_KEY) ?? [];
  }

  saveBacklog(backlog: BacklogEntry[]): void {
    this.context.globalState.update(BACKLOG_KEY, backlog);
  }

  getProjects(): Project[] {
    return this.context.globalState.get<Project[]>(PROJECTS_KEY) ?? [];
  }

  saveProjects(projects: Project[]): void {
    this.context.globalState.update(PROJECTS_KEY, projects);
  }

  closeDay(tasks: Task[]): void {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const notes = this.getNotes();

    const history = this.getHistory();
    const existing = history.find((r) => r.date === date);

    if (existing) {
      // Merge into existing same-day record
      existing.tasks.push(...tasks);
      if (notes) {
        existing.notes = existing.notes
          ? existing.notes + '\n\n' + notes
          : notes;
      }
      existing.closedAt = now.toISOString();
    } else {
      history.push({
        date,
        tasks,
        notes,
        closedAt: now.toISOString(),
      });
    }
    this.context.globalState.update(HISTORY_KEY, history);

    // Move pending tasks to backlog
    const pendingTasks = tasks.filter((t) => t.status === 'pending');
    if (pendingTasks.length > 0) {
      const backlog = this.getBacklog();
      const existingBacklog = backlog.find((e) => e.date === date);
      if (existingBacklog) {
        existingBacklog.tasks.push(...pendingTasks);
      } else {
        backlog.push({ date, tasks: pendingTasks });
      }
      this.context.globalState.update(BACKLOG_KEY, backlog);
    }

    // Clear active tasks and notes
    this.context.globalState.update(TASKS_KEY, []);
    this.context.globalState.update(NOTES_KEY, '');
  }
}
