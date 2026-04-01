import * as vscode from 'vscode';
import { Task } from '../types/task';

/**
 * Provides the TreeView shown in the activity bar sidebar.
 * Each item represents an active task for the current day.
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TaskItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: Task[] = [];

  /**
   * Refreshes the tree with a new list of tasks.
   */
  refresh(tasks: Task[]): void {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TaskItem[] {
    if (this.tasks.length === 0) {
      return [new TaskItem('Nenhuma tarefa ainda. Abra o painel para adicionar!', 'empty')];
    }
    return this.tasks.map((task) => new TaskItem(task.title, task.status, task.id));
  }
}

class TaskItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly taskStatus: string,
    public readonly taskId?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    if (taskStatus === 'done') {
      this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
      this.description = '✓ Concluída';
    } else if (taskStatus === 'pending') {
      this.iconPath = new vscode.ThemeIcon('circle-large-outline');
      this.description = 'Pendente';
    } else {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}
