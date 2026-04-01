import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageService } from '../services/storageService';
import { TaskTreeProvider } from '../providers/taskTreeProvider';
import { Task } from '../types/task';

/**
 * Manages the lifecycle of the JK Organization Webview panel.
 * Follows the Singleton pattern so only one panel can be open at a time.
 */
export class PanelManager {
  private static _instance: PanelManager | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _storage: StorageService;
  private readonly _treeProvider: TaskTreeProvider;
  private readonly _disposables: vscode.Disposable[] = [];

  /**
   * Opens the panel if it doesn't exist yet, or brings it to focus if it does.
   */
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

  /**
   * Handles all messages sent from the Webview frontend.
   */
  private _registerMessageHandler(): void {
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        try {
          switch (message.command) {
            case 'getState':
              this._sendState();
              break;

            case 'addTask': {
              const tasks = this._storage.getTasks();
              const newTask: Task = {
                id: Date.now().toString(),
                title: message.title.trim(),
                status: 'pending',
                createdAt: new Date().toISOString(),
              };
              tasks.push(newTask);
              this._storage.saveTasks(tasks);
              this._treeProvider.refresh(tasks);
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
              this._treeProvider.refresh(tasks);
              this._sendState();
              break;
            }

            case 'removeTask': {
              const tasks = this._storage.getTasks().filter((t) => t.id !== message.id);
              this._storage.saveTasks(tasks);
              this._treeProvider.refresh(tasks);
              this._sendState();
              break;
            }

            case 'closeDay': {
              const tasks = this._storage.getTasks();
              this._storage.closeDay(tasks);
              this._treeProvider.refresh([]);
              this._sendState();
              this._panel.webview.postMessage({ command: 'dayClosedSuccess' });
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

  /**
   * Sends the current tasks and history to the frontend.
   */
  private _sendState(): void {
    this._panel.webview.postMessage({
      command: 'setState',
      tasks: this._storage.getTasks(),
      history: this._storage.getHistory(),
    });
  }

  /**
   * Builds the HTML content for the Webview, injecting resource URIs and a CSP nonce.
   */
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

/**
 * Generates a cryptographically secure random nonce for use in the Content Security Policy.
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// ── Message types ──────────────────────────────────────────────────────────────

type WebviewMessage =
  | { command: 'getState' }
  | { command: 'addTask'; title: string }
  | { command: 'toggleTask'; id: string }
  | { command: 'removeTask'; id: string }
  | { command: 'closeDay' };
