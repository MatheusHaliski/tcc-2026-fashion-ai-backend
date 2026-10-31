# Relatório de refatoração — primeiro lote

Base `a4c9e5d129cf6eb45e5c6ff23e0ba5ff2632b4b1`; alterações locais na branch `refactor/architecture-first-batch`.

## Resultado e limites

Foram implementadas extrações reais em React, Java e Python. O lote preserva os contratos públicos por facade/delegação. Não é uma declaração de que todo o projeto foi refatorado ou de que a validação global está concluída. Build completo e três cenários visuais posteriores estão pendentes por limitações observadas do ambiente. Duas falhas Python da baseline permanecem reproduzíveis e foram mantidas.

## Métricas físicas por conjunto

| Área / arquivo original | Antes | Depois no original | Novos módulos | Total depois | Delta líquido | Redução no original |
|---|---:|---:|---:|---:|---:|---:|
| React: `components/expanded-card.tsx` | 393 | 7 | 419 | 426 | +33 | 98.22% |
| Java: `fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java` | 2868 | 2827 | 55 | 2882 | +14 | 1.43% |
| Python: `scripts/catalog/process_photo_sets.py` | 275 | 245 | 49 | 294 | +19 | 10.91% |

**Total de runtime dos três conjuntos:** 3.536 → 3.602 linhas, aumento líquido de **66 linhas**. A redução do arquivo de entrada não foi apresentada como redução total de código. O ganho está nas fronteiras de responsabilidade e na localização de código testável.

Inventário global de fontes elegíveis: 2637 arquivos / 350968 linhas na revisão original; 2649 arquivos / 351384 linhas no estado auditado. A diferença inclui os scripts de auditoria/reprodução e testes novos, além dos módulos de runtime. Markdown, CSV, JSON e PNG de documentação não entram nessa contagem.

## Medidas por arquivo e responsabilidade

| Arquivo | Linhas antes → depois | Funções* antes → depois | Imports internos resolvidos antes → depois | Responsabilidade depois |
|---|---:|---:|---:|---|
| `components/expanded-card.tsx` | 393 → 7 | 22 → 0 | 49 → 4 | Facade pública; mesmos quatro exports |
| `components/expanded-card/expanded-piece.tsx` | 0 → 256 | 0 → 13 | 0 → 45 | Composição e fluxo do detalhe da peça |
| `components/expanded-card/expanded-scheme.tsx` | 0 → 63 | 0 → 5 | 0 → 10 | Detalhe e ações do look |
| `components/expanded-card/expanded-dna.tsx` | 0 → 21 | 0 → 1 | 0 → 6 | Detalhe e interações do DNA |
| `components/expanded-card/creation-success.tsx` | 0 → 32 | 0 → 1 | 0 → 6 | Janela de sucesso e navegação de saída |
| `components/expanded-card/piece-gallery.tsx` | 0 → 47 | 0 → 2 | 0 → 5 | Fotografias, navegação e fundo da galeria |
| `fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java` | 2868 → 2827 | 101 → 101 | 67 → 67 | Casos de uso de peça; delega montagem de taxonomia |
| `fai-application/src/main/java/br/com/fashionai/application/taxonomy/TaxonomyView.java` | 0 → 55 | 0 → 1 | 0 → 0 | Montagem pura do contrato estendido de taxonomia |
| `scripts/catalog/process_photo_sets.py` | 275 → 245 | 13 → 12 | 10 → 11 | Orquestração, CLI, política e CAS; conserva upload/ready_files |
| `scripts/catalog/photo_set_artifacts.py` | 0 → 49 | 0 → 2 | 0 → 0 | Validação de artefatos e upload verificado |

*Contagens de funções/imports são as estimativas do inventário; não certificam complexidade de execução. Cyclomatic complexity por função: **N/D**. Responsabilidades: classificação humana acima e sinais estimados no CSV. Cobertura: **N/D**. Não foi demonstrada redução global de ramificações nem eliminação mensurada de duplicações neste lote.

## Justificativa e padrões

| Extração | Problema | Solução/padrão | Alternativa considerada | Regressão |
|---|---|---|---|---|
| Cards | Um arquivo agrupava quatro fluxos de detalhe, galeria e ações sem relação de ownership. | Facade compatível + módulos por funcionalidade. | Manter tudo junto ou mover a lógica inteira para um hook; não melhoraria a localização das responsabilidades. | 48 testes React, contrato das abas e capturas disponíveis. |
| Taxonomia | WardrobeService montava uma resposta de catálogo/taxonomia sem precisar de repositórios ou mutações. | Assembler puro (`TaxonomyView`). | Criar um service/interface Spring para uma montagem estática; acrescentaria infraestrutura desnecessária. | 43 testes Java selecionados antes/depois, incluindo taxonomyV2. |
| Artefatos | Worker misturava política/orquestração com validação de PNG e conferência de storage. | Funções coesas com versão injetada; wrapper compatível. Não foi forçado um padrão GoF. | Copiar validações para outros consumidores ou criar uma hierarquia de provedores; desnecessário. | 4 testes novos de arquivo/hash e testes legados preservados. |

Não foram adicionados Strategy/Factory/Observer ou um novo sistema de eventos. O evento de atualização de peça já existente foi preservado. Nenhuma interface Java ou dependência nova foi criada.

## Arquivos adicionais e removidos

- Testes novos: `components/piece-card-panels.test.tsx`, `scripts/catalog/tests/test_photo_set_artifacts.py`.
- Ferramentas novas: `scripts/refactoring/audit_repository.py`, `scripts/refactoring/test_audit_repository.py`, `scripts/refactoring/browser-regression.cjs`.
- Arquivos removidos: nenhum. O arquivo público original do React e os entrypoints Java/Python continuam presentes.
- Docs novas: os seis relatórios solicitados, inventários baseline/atual, JSON do inventário, screenshots e comparação visual.

## Compatibilidade verificada

- Os corpos de ExpandedPiece, ExpandedScheme, ExpandedDna, CreationSuccess, PieceGallery e LookHype foram preservados byte a byte; somente localização, imports e export da galeria mudaram. A facade continua sendo client module.
- PieceCardPanels e seus IDs/roles/controle de seleção não foram alterados. Dois novos testes cobrem initial, escolha manual, teclado e associação ARIA.
- O carregamento dinâmico do visualizador 3D segue com SSR desligado; os diálogos mantêm handlers, ownership e limpeza anteriores.
- Não foram movidas mutações para fora de transações. TaxonomyView não conhece repositórios e o entrypoint anterior continua delegando.
- A CLI Python preserva execução por módulo e arquivo, com saída --help idêntica. Chave de upload, hash, tamanho, dimensões e política de erros foram mantidos.
- Sem novas SCCs normalizadas no grafo de imports estáticos: 10 grupos existentes antes e depois. Não equivale à resolução dos ciclos antigos.

## Pendências e evidências

Resultados completos e comandos: [REFACTORING_TESTS.md](REFACTORING_TESTS.md). Próximos candidatos e portas de validação: [REFACTORING_PLAN.md](REFACTORING_PLAN.md).

- Build bloqueado por ENOSPC depois da compilação; não aprovado como build completo.
- Dependências instaladas reutilizadas: Next 16.4.2, abaixo do ^16.4.3 declarado; validar novamente com lockfile exato em ambiente adequado.
- Comparação visual posterior parcial; não há certificação completa desktop/mobile/loading/erro/vazio.
- Duas falhas Python já reproduzidas na baseline permanecem para investigação funcional separada.
- Suítes globais, cobertura agregada, banco real e renderização GPU não foram executados.
- Nenhuma alteração de produção foi realizada. Commit, push e abertura de PR deste lote foram autorizados explicitamente pelo usuário após a entrega local.


## Checkpoint adicional — 30/10/2026

Nova auditoria por AST e primeiro lote de histórico do Atelier documentados em [gof/INDEX.md](gof/INDEX.md). Este adendo preserva o relato anterior e distingue a base5166f88c das novas alterações ainda não commitadas. Inventário abrangente não equivale a revisão semântica concluída.


### Continuação publicada em PR

Histórico e inspetor isolados; editor915→632 linhas, total combinado981 (+66).14 testes funcionais,14 da auditoria, tipagem, build completo e browser smoke passaram. Limites e três famílias/23 padrões em gof/LINE_LIMITS.md e gof/PATTERN_DECISIONS.md. A refatoração de todo o repositório não está concluída; pendências explícitas na matriz.
