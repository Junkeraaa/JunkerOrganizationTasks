# JK Organization Tasks

Extensão do VSCode para gerenciamento de tarefas. Adicione tarefas ao longo do dia, marque-as como concluídas e encerre o dia salvando tudo no histórico — sem sair do editor.

---

## ✨ Funcionalidades

- **Tarefas do Dia** — adicione, conclua e remova tarefas rapidamente
- **Barra lateral** — visualize as tarefas do dia na activity bar do VSCode
- **Encerrar Dia 🌙** — salva o snapshot do dia no histórico e zera a lista ativa
- **Histórico** — consulte dias anteriores com status de cada tarefa
- **Persistência real** — dados salvos via `globalState` (não somem ao fechar o VSCode)
- **Tema automático** — segue o tema dark/light do VSCode via variáveis CSS nativas

---

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

## 🛠️ Comandos disponíveis

| Comando | Descrição |
|---|---|
| `JK Organization: Abrir Painel` | Abre o painel principal da extensão |

---

## 📝 Licença

MIT