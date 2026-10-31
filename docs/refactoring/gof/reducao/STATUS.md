# Fase de redução de linhas — estado

Data: 2026-10-31. Branch `claude/serene-thompson-yetcg5`.

## Concluído e integrado (verificado)

| Lote | Escopo | Resultado |
|---|---|---|
| R01-css | `app/(site)/globals.css`, `components/heist/heist.css` | 4329→31 e 294→2 (índices de @import); concatenação idêntica byte a byte |
| R02-wardrobe | `WardrobeService` | 2730→1001 (Facade sobre 25 colaboradores); verificação em 3 lentes, 7 achados corrigidos; 418 testes |
| R03-imaging | 7 classes de `imaging/` | todas ≤ 250; 52 digests SHA-256 idênticos; 141 testes |
| R04-testes | 8 testes de Momentos/Selos | 16 classes + fixtures (Template Method); 171 testes, nomes idênticos |
| R60a/R60b | 5 controllers, BFF de auth, 2 hooks (limites por categoria) | todos dentro do limite da categoria; verificação dupla, 4 achados corrigidos |

## Pendente: 243 arquivos acima do limite (congelados em `scripts/refactoring/line_baseline.json`)

Por categoria: java-service 51, java-outro 48, python 38, componente 37, lib-ts 31, teste 30, script-js 4, pagina 2, java-entidade 1, java-adapter 1.

Maiores: `ServiceFakes.java` 4643, `SealService.java` 2097, `MomentService.java` 1902, `ChallengeService.java` 1852, `FlairModesService.java` 1643, `HypeQueryService.java` 1512, `DnaService.java` 1461, `RoomService.java` 1436, `gerar.py` 1430, `CopilotService.java` 1419, `LensService.java` 1363, `SchemeService.java` 1271, `MirrorService.java` 1254, `garments.ts` 1205, `InventoryScoreService.java` 1178.

Os lotes R05–R59 (os arquivos acima, agrupados por pacote) foram iniciados por workflow e
interrompidos por limite de uso antes da verificação/integração; o trabalho local não verificado não entra no PR e
deve ser refeito a partir desta branch.

## Como retomar

1. Agrupar arquivos do baseline por pacote/diretório (4–12 arquivos por lote; serviços > 1000 linhas sozinhos).
2. Por lote: worktree a partir desta branch → caracterização no código original → extração em arquivos auxiliares
   (regras em `docs/refactoring/LINE_RULES.md`, sem comprimir formatação) → testes → `line_ratchet.py --update`.
3. Verificação independente em duas lentes (equivalência de comportamento; regras/coesão/GoF real) antes de integrar.
4. Integrar um lote por vez: rebase, `line_ratchet.py` sem violações, compilar módulos tocados, push.
5. Ao fim: suíte Java completa, `npx vitest run`, `npx tsc --noEmit`, build Next de produção.
