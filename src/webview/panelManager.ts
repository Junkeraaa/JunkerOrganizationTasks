import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageService } from '../services/storageService';
import { TaskTreeProvider } from '../providers/taskTreeProvider';
import { Task, Project, ProjectLink, ProjectEvidence, TaskCategory } from '../types/task';

export class PanelManager {
  private static _instance: PanelManager | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _storage: StorageService;
  private readonly _treeProvider: TaskTreeProvider;
  private readonly _disposables: vscode.Disposable[] = [];

  static createOrShow(
    context: vscode.ExtensionContext,
    storage: StorageService,
    treeProvider: TaskTreeProvider
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PanelManager._instance) {
      PanelManager._instance._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'jkOrganization',
      'JK Organization Tasks',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'ui'),
        ],
        retainContextWhenHidden: true,
      }
    );

    PanelManager._instance = new PanelManager(panel, context, storage, treeProvider);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    storage: StorageService,
    treeProvider: TaskTreeProvider
  ) {
    this._panel = panel;
    this._storage = storage;
    this._treeProvider = treeProvider;

    this._panel.webview.html = this._buildHtml(context);
    this._registerMessageHandler();

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
  }

  private _refreshTree(): void {
    this._treeProvider.refresh(this._storage.getTasks(), this._storage.buildCategoryList());
  }

  private _registerMessageHandler(): void {
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        try {
          switch (message.command) {
            case 'getState':
              this._sendState();
              break;

            // ── Tasks (unified, with categories) ─────────
            case 'addTask': {
              const tasks = this._storage.getTasks();
              const newTask: Task = {
                id: Date.now().toString(),
                title: message.title.trim(),
                status: 'pending',
                createdAt: new Date().toISOString(),
                categoryId: message.categoryId || 'daily',
              };
              tasks.push(newTask);
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'toggleTask': {
              const tasks = this._storage.getTasks().map((t) =>
                t.id === message.id
                  ? { ...t, status: (t.status === 'done' ? 'pending' : 'done') as Task['status'] }
                  : t
              );
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'removeTask': {
              const tasks = this._storage.getTasks().filter((t) => t.id !== message.id);
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'moveTask': {
              const tasks = this._storage.getTasks().map((t) =>
                t.id === message.id ? { ...t, categoryId: message.categoryId } : t
              );
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'saveNotes': {
              this._storage.saveNotes(message.notes);
              break;
            }

            case 'closeDay': {
              this._storage.closeDay();
              this._refreshTree();
              this._sendState();
              this._panel.webview.postMessage({ command: 'dayClosedSuccess' });
              break;
            }

            case 'closeDayLastBusinessDay': {
              const lastBizDay = this._storage.getLastBusinessDay();
              this._storage.closeDay(lastBizDay);
              this._refreshTree();
              this._sendState();
              this._panel.webview.postMessage({ command: 'dayClosedSuccess', date: lastBizDay });
              break;
            }

            // ── Categories ───────────────────────────────
            case 'addCategory': {
              const categories = this._storage.getCategories();
              const cat: TaskCategory = {
                id: Date.now().toString(),
                name: message.name.trim(),
                type: 'custom',
                createdAt: new Date().toISOString(),
              };
              categories.push(cat);
              this._storage.saveCategories(categories);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'removeCategory': {
              const categories = this._storage.getCategories().filter((c) => c.id !== message.id);
              this._storage.saveCategories(categories);
              // Move tasks from deleted category to daily
              const tasks = this._storage.getTasks().map((t) =>
                t.categoryId === message.id ? { ...t, categoryId: 'daily' } : t
              );
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            // ── Backlog ──────────────────────────────────
            case 'completeBacklogTask': {
              const backlog = this._storage.getBacklog();
              let foundTask: Task | undefined;
              for (const entry of backlog) {
                const idx = entry.tasks.findIndex((t) => t.id === message.id);
                if (idx !== -1) {
                  foundTask = entry.tasks[idx];
                  entry.tasks.splice(idx, 1);
                  break;
                }
              }
              this._storage.saveBacklog(backlog.filter((e) => e.tasks.length > 0));
              if (foundTask) {
                const tasks = this._storage.getTasks();
                tasks.push({ ...foundTask, status: 'done', createdAt: new Date().toISOString(), categoryId: 'daily' });
                this._storage.saveTasks(tasks);
                this._refreshTree();
              }
              this._sendState();
              break;
            }

            case 'removeBacklogTask': {
              const backlog = this._storage.getBacklog();
              for (const entry of backlog) {
                const idx = entry.tasks.findIndex((t) => t.id === message.id);
                if (idx !== -1) { entry.tasks.splice(idx, 1); break; }
              }
              this._storage.saveBacklog(backlog.filter((e) => e.tasks.length > 0));
              this._sendState();
              break;
            }

            // ── History edit ─────────────────────────────
            case 'toggleHistoryTask': {
              const history = this._storage.getHistory();
              for (const record of history) {
                const task = record.tasks.find((t) => t.id === message.id);
                if (task) {
                  task.status = task.status === 'done' ? 'pending' : 'done';
                  break;
                }
              }
              this._storage.saveHistory(history);
              this._sendState();
              break;
            }

            case 'removeHistoryTask': {
              const history = this._storage.getHistory();
              for (const record of history) {
                const idx = record.tasks.findIndex((t) => t.id === message.id);
                if (idx !== -1) { record.tasks.splice(idx, 1); break; }
              }
              this._storage.saveHistory(history.filter((r) => r.tasks.length > 0));
              this._sendState();
              break;
            }

            // ── Projects ─────────────────────────────────
            case 'addProject': {
              const projects = this._storage.getProjects();
              const project: Project = {
                id: Date.now().toString(),
                title: message.title.trim(),
                status: 'active',
                sprint: '',
                notes: '',
                subtasks: [],
                links: [],
                evidences: [],
                createdAt: new Date().toISOString(),
              };
              projects.push(project);
              this._storage.saveProjects(projects);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'updateProject': {
              const projects = this._storage.getProjects();
              const idx = projects.findIndex((p) => p.id === message.id);
              if (idx !== -1) {
                const p = projects[idx];
                if (message.field === 'sprint') { p.sprint = message.value; }
                else if (message.field === 'notes') { p.notes = message.value; }
                else if (message.field === 'status') {
                  p.status = message.value as Project['status'];
                }
                this._storage.saveProjects(projects);
                this._refreshTree();
              }
              this._sendState();
              break;
            }

            case 'removeProject': {
              const projects = this._storage.getProjects().filter((p) => p.id !== message.id);
              this._storage.saveProjects(projects);
              // Move project tasks to daily
              const tasks = this._storage.getTasks().map((t) =>
                t.categoryId === message.id ? { ...t, categoryId: 'daily' } : t
              );
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            // ── Project subtasks (now unified with tasks) ──
            case 'addProjectSubtask': {
              const tasks = this._storage.getTasks();
              tasks.push({
                id: Date.now().toString(),
                title: message.title.trim(),
                status: 'pending',
                createdAt: new Date().toISOString(),
                categoryId: message.projectId,
              });
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'toggleProjectSubtask': {
              const tasks = this._storage.getTasks().map((t) =>
                t.id === message.id
                  ? { ...t, status: (t.status === 'done' ? 'pending' : 'done') as Task['status'] }
                  : t
              );
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'removeProjectSubtask': {
              const tasks = this._storage.getTasks().filter((t) => t.id !== message.id);
              this._storage.saveTasks(tasks);
              this._refreshTree();
              this._sendState();
              break;
            }

            case 'addProjectLink': {
              const projects = this._storage.getProjects();
              const project = projects.find((p) => p.id === message.projectId);
              if (project) {
                const link: ProjectLink = {
                  id: Date.now().toString(),
                  label: message.label.trim() || message.url.trim(),
                  url: message.url.trim(),
                };
                project.links.push(link);
                this._storage.saveProjects(projects);
              }
              this._sendState();
              break;
            }

            case 'removeProjectLink': {
              const projects = this._storage.getProjects();
              for (const p of projects) {
                const idx = p.links.findIndex((l) => l.id === message.id);
                if (idx !== -1) { p.links.splice(idx, 1); break; }
              }
              this._storage.saveProjects(projects);
              this._sendState();
              break;
            }

            case 'addProjectEvidence': {
              const projects = this._storage.getProjects();
              const project = projects.find((p) => p.id === message.projectId);
              if (project) {
                if (!project.evidences) { project.evidences = []; }
                const evidence: ProjectEvidence = {
                  id: Date.now().toString(),
                  label: message.label.trim() || 'Evidência',
                  dataUrl: message.dataUrl,
                  createdAt: new Date().toISOString(),
                };
                project.evidences.push(evidence);
                this._storage.saveProjects(projects);
              }
              this._sendState();
              break;
            }

            case 'removeProjectEvidence': {
              const projects = this._storage.getProjects();
              for (const p of projects) {
                if (!p.evidences) { continue; }
                const idx = p.evidences.findIndex((e) => e.id === message.id);
                if (idx !== -1) { p.evidences.splice(idx, 1); break; }
              }
              this._storage.saveProjects(projects);
              this._sendState();
              break;
            }

            case 'downloadEvidence': {
              const evLabel = (message as any).label || 'evidence';
              const evDataUrl = (message as any).dataUrl as string;
              const b64 = evDataUrl.split(',')[1];
              if (!b64) { break; }
              const buf = Buffer.from(b64, 'base64');
              const safeName = evLabel.replace(/[<>:"\/\\|?*]/g, '_');
              vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(safeName + '.png'),
                filters: { Images: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
              }).then((uri) => {
                if (uri) {
                  vscode.workspace.fs.writeFile(uri, buf).then(() => {
                    this._panel.webview.postMessage({ command: 'evidenceDownloaded' });
                  });
                }
              });
              break;
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this._panel.webview.postMessage({ command: 'error', message: msg });
        }
      },
      undefined,
      this._disposables
    );
  }

  private _sendState(): void {
    this._panel.webview.postMessage({
      command: 'setState',
      tasks: this._storage.getTasks(),
      categories: this._storage.buildCategoryList(),
      history: this._storage.getHistory(),
      notes: this._storage.getNotes(),
      backlog: this._storage.getBacklog(),
      projects: this._storage.getProjects(),
    });
  }

  private _buildHtml(context: vscode.ExtensionContext): string {
    const webview = this._panel.webview;
    const uiPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'ui');

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(uiPath, 'style.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(uiPath, 'main.js'));

    const nonce = generateNonce();

    const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'ui', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    html = html
      .replace(/\$\{cspNonce\}/g, nonce)
      .replace('${cspSource}', webview.cspSource.toString())
      .replace('${styleUri}', styleUri.toString())
      .replace('${scriptUri}', scriptUri.toString());

    return html;
  }

  private _dispose(): void {
    PanelManager._instance = undefined;
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables.length = 0;
  }
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

type WebviewMessage =
  | { command: 'getState' }
  | { command: 'addTask'; title: string; categoryId?: string }
  | { command: 'toggleTask'; id: string }
  | { command: 'removeTask'; id: string }
  | { command: 'moveTask'; id: string; categoryId: string }
  | { command: 'saveNotes'; notes: string }
  | { command: 'closeDay' }
  | { command: 'closeDayLastBusinessDay' }
  | { command: 'addCategory'; name: string }
  | { command: 'removeCategory'; id: string }
  | { command: 'completeBacklogTask'; id: string }
  | { command: 'removeBacklogTask'; id: string }
  | { command: 'toggleHistoryTask'; id: string }
  | { command: 'removeHistoryTask'; id: string }
  | { command: 'addProject'; title: string }
  | { command: 'updateProject'; id: string; field: string; value: string }
  | { command: 'removeProject'; id: string }
  | { command: 'addProjectSubtask'; projectId: string; title: string }
  | { command: 'toggleProjectSubtask'; id: string }
  | { command: 'removeProjectSubtask'; id: string }
  | { command: 'addProjectLink'; projectId: string; label: string; url: string }
  | { command: 'removeProjectLink'; id: string }
  | { command: 'addProjectEvidence'; projectId: string; label: string; dataUrl: string }
  | { command: 'removeProjectEvidence'; id: string }
  | { command: 'downloadEvidence'; dataUrl: string; label: string };
