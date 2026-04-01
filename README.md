# JK Organization Tasks

Extensão do VSCode para gerenciar tarefas de sprints diárias. Adicione tarefas ao longo do dia, marque-as como concluídas e encerre o dia salvando tudo no histórico — sem sair do editor.

---

## ✨ Funcionalidades

- **Tarefas do Dia** — adicione, conclua e remova tarefas rapidamente
- **Barra lateral** — visualize as tarefas do dia na activity bar do VSCode
- **Encerrar Dia 🌙** — salva o snapshot do dia no histórico e zera a lista ativa
- **Histórico** — consulte dias anteriores com status de cada tarefa
- **Persistência real** — dados salvos via `globalState` (não somem ao fechar o VSCode)
- **Tema automático** — segue o tema dark/light do VSCode via variáveis CSS nativas

---

## 🚀 Como rodar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [VSCode](https://code.visualstudio.com/)

### Passos

```bash
# 1. Instale as dependências
npm install

# 2. Compile o TypeScript (modo watch — recompila ao salvar)
npm run watch
```

Depois, pressione **F5** no VSCode para abrir a janela de desenvolvimento da extensão (**Extension Development Host**).

Na nova janela aberta, use `Ctrl+Shift+P` → **JK Organization: Abrir Painel**.

---

## 🏗️ Estrutura do projeto

```
src/
├── extension.ts                ← ponto de entrada
├── types/
│   └── task.ts                 ← interfaces Task, DayRecord, TaskStatus
├── services/
│   └── storageService.ts       ← persistência via globalState
├── providers/
│   └── taskTreeProvider.ts     ← TreeView lateral
└── webview/
    ├── panelManager.ts         ← ciclo de vida do WebviewPanel
    └── ui/
        ├── index.html          ← HTML da interface
        ├── style.css           ← estilos dark/light com variáveis VSCode
        └── main.js             ← lógica frontend (postMessage API)
```

---

## 📦 Gerar o pacote `.vsix`

```bash
# Instale o vsce globalmente (se ainda não tiver)
npm install -g @vscode/vsce

# Gere o pacote
vsce package
```

O arquivo `.vsix` gerado pode ser instalado manualmente via:
`Extensões` → `...` → **Instalar pelo VSIX...**

---

## 🛠️ Comandos disponíveis

| Comando | Descrição |
|---|---|
| `JK Organization: Abrir Painel` | Abre o painel principal da extensão |

---

## 📝 Licença

MIT