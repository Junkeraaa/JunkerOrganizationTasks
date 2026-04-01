import * as vscode from 'vscode';
import { Task, DayRecord } from '../types/task';

const TASKS_KEY = 'jkOrganization.tasks';
const HISTORY_KEY = 'jkOrganization.history';

/**
 * Handles all persistence operations using VSCode's globalState.
 */
export class StorageService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Returns the current list of active tasks.
   */
  getTasks(): Task[] {
    return this.context.globalState.get<Task[]>(TASKS_KEY) ?? [];
  }

  /**
   * Persists the given list of tasks as the active task list.
   */
  saveTasks(tasks: Task[]): void {
    this.context.globalState.update(TASKS_KEY, tasks);
  }

  /**
   * Returns all past day records in chronological order (oldest first).
   */
  getHistory(): DayRecord[] {
    return this.context.globalState.get<DayRecord[]>(HISTORY_KEY) ?? [];
  }

  /**
   * Saves the current tasks to history as a completed day record,
   * then clears the active task list.
   */
  closeDay(tasks: Task[]): void {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const record: DayRecord = {
      date,
      tasks,
      closedAt: now.toISOString(),
    };
    const history = this.getHistory();
    history.push(record);
    this.context.globalState.update(HISTORY_KEY, history);
    this.context.globalState.update(TASKS_KEY, []);
  }
}
