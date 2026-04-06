import * as vscode from 'vscode';
import { Task, TaskCategory } from '../types/task';

type TreeNode = CategoryNode | TaskNode | EmptyNode;

/**
 * Provides the TreeView shown in the activity bar sidebar.
 * Shows categories as parent nodes with tasks as children.
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: Task[] = [];
  private categories: TaskCategory[] = [];

  /**
   * Refreshes the tree with tasks grouped by categories.
   */
  refresh(tasks: Task[], categories: TaskCategory[]): void {
    this.tasks = tasks;
    this.categories = categories;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      // Root level: categories
      if (this.categories.length === 0 && this.tasks.length === 0) {
        return [new EmptyNode('Nenhuma tarefa ainda. Abra o painel para adicionar!')];
      }

      return this.categories.map((cat) => {
        const count = this.tasks.filter((t) => t.categoryId === cat.id).length;
        return new CategoryNode(cat.name, cat.id, count, cat.type);
      });
    }

    if (element instanceof CategoryNode) {
      const catTasks = this.tasks.filter((t) => t.categoryId === element.categoryId);
      if (catTasks.length === 0) {
        return [new EmptyNode('Sem tarefas')];
      }
      return catTasks.map((t) => new TaskNode(t.title, t.status, t.id));
    }

    return [];
  }
}

class CategoryNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly categoryId: string,
    taskCount: number,
    categoryType: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${taskCount} tarefa${taskCount !== 1 ? 's' : ''}`;
    this.contextValue = 'category';

    if (categoryType === 'daily') {
      this.iconPath = new vscode.ThemeIcon('calendar');
    } else if (categoryType === 'project') {
      this.iconPath = new vscode.ThemeIcon('project');
    } else {
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }
}

class TaskNode extends vscode.TreeItem {
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
    }
  }
}

class EmptyNode extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}
