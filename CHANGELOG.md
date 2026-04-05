# Changelog — JK Organization Tasks

Todas as mudanças relevantes desta extensão estão documentadas aqui.

---

## [0.3.0] — 2026-04-05

### ✨ Novidades
- **Evidências em Projetos** — Cada projeto agora tem uma seção de evidências onde você pode colar imagens diretamente (Ctrl+V) ou selecionar arquivos do computador. Suporta N evidências por projeto.
- **Download de evidências** — Botão de download abre o diálogo nativo de salvar arquivo do sistema operacional.
- **Cópia de evidências** — Botão de copiar coloca a imagem diretamente na área de transferência, pronta para colar em outros apps.
- **Encerrar Último Dia Útil** — Novo botão que registra o histórico do dia como se fosse o último dia útil (seg–sex), útil para quando você esquece de encerrar o dia. Aparece ao lado de "Encerrar Dia".
- **Atalho de teclado** — `Ctrl+Shift+J` (Windows/Linux) ou `Cmd+Shift+J` (macOS) abre o painel principal de qualquer lugar no VSCode.

### 🐛 Correções
- Corrigido: ao encerrar o dia, tarefas concluídas de categorias não-diárias eram silenciosamente deletadas. Agora **todas as tarefas concluídas** vão para o histórico.
- Corrigido: tarefas concluídas vinculadas a projetos agora **permanecem visíveis dentro do projeto** (marcadas como concluídas), em vez de serem removidas.

### 💅 Melhorias de UX
- Barra de progresso com gradiente animado e altura aumentada para melhor leitura.
- Task items com **borda lateral colorida** (azul = pendente, verde = concluída).
- Contagem de tarefas por categoria exibida como **pill badge**.
- Cards de projeto e evidência com **efeito de elevação** no hover.
- Abas do header com borda inferior mais proeminente e bordas arredondadas.
- Scrollbar customizada seguindo o tema do VSCode.
- Toast de notificação mais largo e com sombra aprimorada.
- Dropzone de evidências com fundo visível e feedback visual de hover.

---

## [0.2.0] — 2026-03-01

### ✨ Novidades
- **Sistema de Categorias** — Tarefas agora são organizadas por categorias. A categoria "Tarefas Diárias" é fixa; projetos ativos geram suas próprias categorias automaticamente; categorias customizadas podem ser criadas livremente.
- **Projetos** — Nova aba de Projetos com suporte a subtarefas, sprint, anotações, links úteis e status (ativo/concluído).
- **Backlog** — Tarefas diárias pendentes ao encerrar o dia vão automaticamente para a aba de Pendentes, onde podem ser concluídas ou removidas.
- **Movimento de tarefas** — Dropdown em cada tarefa permite movê-la entre categorias sem precisar recriar.
- **Encerrar Dia revisado** — Apenas tarefas diárias pendentes vão para o backlog; tarefas de outras categorias permanecem ativas.
- **Barra lateral com hierarquia** — A TreeView lateral exibe tarefas agrupadas por categoria.
- Botão de adicionar tarefa inline dentro de cada categoria (sem abrir o formulário global).

### 🗑️ Alterações
- "Tarefas do Dia" renomeado para "Tarefas" (agora engloba todas as categorias).

---

## [0.1.0] — 2025-01-01

### ✨ Lançamento inicial
- Lista de tarefas do dia com adição, conclusão e remoção.
- Encerramento do dia salvando snapshot no histórico.
- Histórico consultável com status de cada tarefa.
- Anotações do dia com auto-save.
- Barra lateral (Activity Bar) com TreeView das tarefas.
- Interface que segue o tema dark/light do VSCode automaticamente.
- Persistência de dados via `globalState` (dados não se perdem ao fechar o editor).
