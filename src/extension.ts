import * as vscode from 'vscode';
import { StorageService } from './services/storageService';
import { TaskTreeProvider } from './providers/taskTreeProvider';
import { PanelManager } from './webview/panelManager';

/**
 * Called by VSCode when the extension is activated.
 * Registers commands, providers, and subscriptions.
 */
export function activate(context: vscode.ExtensionContext): void {
  const storage = new StorageService(context);
  const treeProvider = new TaskTreeProvider();

  // Register sidebar TreeView
  const treeView = vscode.window.createTreeView('jkOrganizationTasks', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Populate the tree with persisted tasks on activation
  treeProvider.refresh(storage.getTasks(), storage.buildCategoryList());

  // Register the open panel command
  const openPanelCommand = vscode.commands.registerCommand(
    'jkOrganization.openPanel',
    () => {
      PanelManager.createOrShow(context, storage, treeProvider);
    }
  );

  context.subscriptions.push(treeView, openPanelCommand);
}

/** Called by VSCode when the extension is deactivated. */
export function deactivate(): void {
  // Nothing to clean up — VSCode handles subscription disposal.
}
