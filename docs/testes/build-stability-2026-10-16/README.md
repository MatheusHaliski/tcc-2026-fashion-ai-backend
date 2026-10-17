# Correções de build — 16/10/2026

Base revisada: `main` em `78893f98`. Correções de GPU ficam no PR #312; este relatório cobre a compilação da aplicação.

## Falhas confirmadas

| Evidência | Falha | Tratamento |
| --- | --- | --- |
| Vercel `c208de6`, CI #308 | Vírgula ausente antes de `nav.atelier` nos três JSONs | Sintaxe corrigida em português, inglês e espanhol. |
| Prebuild local | 47 textos embutidos bloqueavam o scanner | Textos traduzidos; dados de estilo e recompensas consultam o idioma no acesso, sem congelar o idioma na importação. |
| CI #308, job 116589009158 | Duas migrations V70 | A migration da loja física passa a V72. V70 Atelier e V71 catálogo permanecem. SQL preservado. |
| CI #307, job 116551803786 | Teste de Lookbook não esperava “Minhas Artes” | Expectativa atualizada sem remover a verificação da ordem/privacidade das abas. |
| Auditoria Chromium | Texto XP de 7,5 px bloqueava a regra mínima de 12 px | Ícone ampliado para 12 px, preservando o atalho e seu nome acessível. |
| Teste completo de card | Provider global disparava tarefas após fechar o jsdom | Teste usa apenas I18nProvider, sem sessão/efeitos globais desnecessários. |
| `npm run lint` local | `next lint` não existe no Next 16 | Script usa TypeScript, Stylelint, design checks e verificações i18n já presentes. |
| Compilação local | Processo PostCSS recebeu SIGKILL sob pressão de memória | Tailwind restringido a app/components/lib; catálogo, modelos e relatórios não são fontes de classes. Build final executado com concorrência limitada. |

Os erros de tipos dos PRs #303 e #305 (identificadores duplicados, VFX/contratos incompatíveis e referência ao editor removido) já estavam corrigidos na base atual. A verificação de tipos desta entrega confirma que não reaparecem.

## Verificações

- Instalação limpa por `npm ci`, sem alterar dependências/lockfile; Node 24.19.0, Next 16.4.0.
- `npm run lint`: TypeScript, Stylelint, regras de design e i18n. Os oito avisos de i18n são nomes próprios de locais; não são falhas.
- `npm run build`: compilação de produção e geração de 75 páginas concluídas. Redução local de concorrência: `NODE_OPTIONS=--max-old-space-size=2560 RAYON_NUM_THREADS=2`.
- Maven `verify` de todos os módulos: **BUILD SUCCESS**, 1.487 testes aprovados e 5 ignorados. Java 21; agente Mockito explícito para este ambiente. Relatório de cobertura não certificado nesta execução.
- Catálogo Python: **211 testes aprovados**.
- `npm audit --omit=dev --audit-level=high`: nenhuma vulnerabilidade reportada.
- Regressões de tradução dinâmica, cards e Lookbook: **20 testes aprovados**.

O banco Railway não foi migrado nesta sessão. Antes de aplicar V72 em um banco existente, confira `flyway_schema_history`: esta alteração pressupõe que a migration da loja física não tenha sido aplicada anteriormente como V70. Não execute repair nem altere histórico de migrations automaticamente.

O histórico completo da equipe Vercel retorna HTTP 403 para a integração. Foram revisados os logs fornecidos e os jobs GitHub dos PRs #303, #305, #307 e #308; não se afirma revisão de todos os deployments históricos. A conclusão local não substitui o próximo deployment Vercel/Railway.
