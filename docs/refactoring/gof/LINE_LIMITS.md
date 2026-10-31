# Política de linhas e prioridade

Escopo: todos os arquivos-fonte versionados no GitHub, inclusive testes e ferramentas. O inventário também inclui fontes novas deste PR. Arquivos ausentes em checkout esparso precisam ser materializados; a auditoria agora falha explicitamente quando falta uma fonte versionada. Demais documentos, configurações, dados e assets constam de all-repository-files.csv.

| Linhas físicas | Faixa | Ação |
|---|---|---|
|0–250 | Dentro da meta geral | Avaliar coesão e responsabilidades; não é aprovação automática |
|251–400 | REVIEW | Revisar responsabilidades e registrar refatoração ou exceção |
|401–600 | PRIORITY | Prioridade de análise/refatoração |
|601–1.000 | HIGH | Alta prioridade de análise/refatoração |
|1.001 ou mais | CRITICAL | Prioridade crítica |

Esses intervalos preservam exatamente os limiares dos prompts. Mais de250 significa251, mais de400 significa401. As faixas são triagem, não ordem para divisão mecânica nem critério isolado de aprovação.

| Tipo | Meta recomendada |
|---|---|
| Componente visual simples |40–150 linhas |
| Componente visual complexo |100–250 linhas |
| Hook próprio |40–150 linhas |
| Utilitário |20–120 linhas |
| Página Next.js | Preferencialmente até250 linhas |

O limite inferior não exige adicionar código. Para backend e pipelines usa-se a meta geral e, sobretudo, a fronteira real de responsabilidade. SQL já aplicado, fontes geradas, traduções, fixtures e definições extensas devem ser examinados sem fragmentação artificial. Migrations aplicadas não são reescritas para satisfazer tamanho.

## Registro e acompanhamento

LINE_LIMITS.csv ordena todos os arquivos-fonte por tamanho, com faixa e ação. A implementação compartilhada está em scripts/refactoring/line_policy.py, com teste das oito fronteiras. COVERAGE_FINAL.csv conserva PENDING quando não há decisão semântica; um arquivo pequeno também pode precisar de refatoração.

Exceção deve registrar caminho, responsabilidade coesa, razão para manter tamanho, testes/contratos e pendência. Não usar aprovação genérica para todos os arquivos grandes. Também medir total original+extraídos, duplicação e ramos; nenhum ganho líquido de tamanho deve ser inventado.

## Exceção temporária deste lote

components/atelier3d/editor.tsx permanece com632 linhas (HIGH). Foi reduzido de915 e mantém coordenação de sessão, carregamento/cleanup de GLB, permissões, autosave, conflito e persistência. Separar esses efeitos sem caracterização própria aumenta risco de corrida e perda de documento; portanto o arquivo continua PARTIAL, com revisão posterior obrigatória, e não é considerado dentro da meta. Os módulos novos têm38,111 e200 linhas.

Próximos arquivos críticos seguem o ranking completo, incluindo WardrobeService, SealService, ChallengeService e demais fontes acima de1.000 linhas. O escopo total não é limitado a esses nomes ou ao editor.

## Verificação automática no GitHub

O workflow architecture.yml roda testes leves e gera um CSV com cada fonte versionada, sua quantidade de linhas e faixa. Falta de fonte faz a ferramenta falhar; tamanho acima da meta gera fila de revisão. Isso preserva a instrução dos prompts de não aprovar/reprovar apenas pela quantidade de linhas.
