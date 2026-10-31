# Módulo 06 — looks, schemes, DNA, espelho, planejamento: lote FLOW-SCHEME-REMIX-PROTOTYPE-001

Base: `04bf53f` (branch `claude/serene-thompson-yetcg5`, após o lote 02). Branch: `gof/06-looks`.
`git status --short` limpo antes do lote.

## Mapeamento real do fluxo de remix de look

Botão "Remixar" (card/detalhe do look, interação social) → `SocialService.remix(user, SCHEME, id)` (delegação) ou
`POST /api/schemes/{id}/remix` (`SchemeController.remix`, `fai-web`)
→ `SchemeService.remix` (`@Transactional`): `guard.requireCanCreate`, `SchemeRepository.findById`, `requireView`
(visibilidade efetiva, bloqueio), recusa `INDISPONIVEL` → `SchemeItemRepository.findBySchemeIdOrderBySortOrder` +
`WardrobeService.eligible` → **`SchemeRemixPrototype.mapPieces` + `prefill`** (novo, puro)
→ resposta `{prefill, missingPieces, source{id,title,owner}, next:"/create-look?remix=<id>"}`
→ editor do look; o salvamento volta por `SchemeService.create` com `remixedFromId` (revalida visibilidade e
disponibilidade da origem, grava `originalScheme`, `origin=REMIX`, incrementa `remixCount`, notifica o autor e emite
`HypeSignal LOOK_REMIXED`). Entidades: `Scheme`, `SchemeItem`, `WardrobeItem`; DTO `SchemeService.ItemForm`, `Views.PieceRow`.

Tamanhos atuais dos serviços do domínio (todos congelados no line_baseline): `DnaService` 1461, `SchemeService` 1311,
`MirrorService` 1254, `LookbookService` 781. `LookPreviewService` (199) já está abaixo do limite.

## Problema concreto e decisão

`remix()` misturava a orquestração transacional (autorização, leitura, recusa) com duas regras puras: (1) o casamento
de cada peça da origem com a peça mais parecida do acervo de quem remixa (similaridade subcategoria/categoria/cor/
família de cor, limiar 1.0, sem repetir peça, empate fica no primeiro candidato, dono mantém as próprias peças) e (2) a
cópia do look-origem para um **rascunho com nova identidade** (11 chaves em ordem fixa, sem id JPA, autoria,
visibilidade, status, tags ou selos). Nenhuma das duas era testável sem montar o serviço inteiro.

O prompt pede explicitamente "duplicar rascunho/arranjo mantendo nova identidade e sem copiar `id` JPA, permissões ou
selos": é o caso de **Prototype** (variante cópia por fábrica — o look-origem é o protótipo; a cópia é um rascunho, não
uma entidade, logo não se usa `Cloneable`/`clone()` em entidade JPA, o que copiaria id/versão). `SchemeRemixPrototype`
(package-private, mesmo pacote): `mapPieces(sourceItems, candidates, ownLook)` → `PieceMapping(items, missing)`,
`prefill(source, items)`, `similarity(a, b)` e `MATCH_THRESHOLD = 1.0`. Sem Spring, repositório ou relógio.

Permanecem no serviço, sem alteração: `@Transactional`, `requireCanCreate`, `requireView`, `INDISPONIVEL`, leitura das
peças e do acervo elegível, montagem do envelope da resposta (`source`, `next`). O stream de casamento foi movido
literalmente (mesma ordem de candidatos e mesmo `max` + `filter`, preservando o desempate).

### Padrões avaliados e não aplicados neste lote

- **Builder (montagem de look):** `SchemeForm`/`ItemForm` são records já usados como DTO de entrada; um builder só
  duplicaria o record. O ponto frágil real é `replaceItems` (I/O + regra), candidato a lote próprio.
- **Strategy (ocasião/estação):** a composição local (`LocalSchemeComposer`) não tem variação de política por ocasião
  que hoje seja escolhida em runtime; não há `switch` a eliminar no fluxo tocado.
- **Composite (slots):** os slots upper/lower/shoes/accessory são lista plana com `zIndex`; não há hierarquia.
- **Memento (undo/redo):** o editor não tem undo no backend; a prévia de layout já é sem gravação (`layoutPreview`).
- **Facade:** `SchemeService` já é a fachada transacional do controller.
- **Singleton:** nenhum introduzido (beans Spring).

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (5 testes novos em `SchemeRemixCharacterizationTest`: ordem exata das 11 chaves do prefill e ausência de id/selos/visibilidade/status/tags; casamento por subcategoria mantendo slot/ordem; dono reusa peças e copia layout+filtros; limiar 1.0 vs 0.75, peça usada não repete, faltantes com `sourcePiece`/`action`; `INDISPONIVEL`) + `SchemeServiceTest` existente | `mvn -B -q -pl fai-application -Dtest='SchemeRemixCharacterizationTest,SchemeServiceTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 5 + 11 = 16 testes, 0 falhas |
| Depois da extração + `SchemeRemixPrototypeTest` (4 testes puros: pesos da similaridade, limiar/faltantes/sem repetição, desempate no primeiro candidato e dono, rascunho sem identidade) + consumidores (`SocialServiceTest`, `PieceRemixTest`) + vizinhos do serviço (`SchemeRulesTest`, `SchemeFiltersTest`) | `mvn -B -q -pl fai-application -Dtest='SchemeRemix*Test,SchemeServiceTest,SocialServiceTest,PieceRemixTest,SchemeRulesTest,SchemeFiltersTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 43 testes, 0 falhas/erros |
| Regra de tamanho | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações (aviso APERTAR: `SchemeService.java` teto 1311 → 1271) |

Suíte completa não executada (máquina compartilhada com outros agentes); API pública de `SchemeService` inalterada
(só o método `private static similarity` saiu), então `fai-web`/`ServiceFakes` não são afetados.

Logs: `evidence/06-scheme-remix-baseline.log`, `evidence/06-scheme-remix-after.log`.
Sem banco, servidor, navegador, rede, GPU ou IA paga.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `SchemeService.java` | 1311 linhas | 1271 (−40; −3,05 %) |
| `remix()` | 41 linhas (+ `similarity` 15) | 17 |
| `SchemeRemixPrototype.java` (novo) | — | 99 |
| Runtime combinado | 1311 | 1370 (+59: javadoc, record e assinaturas) |
| Testes novos | — | 198 (`SchemeRemixCharacterizationTest`) + 71 (`SchemeRemixPrototypeTest`) |

O ganho é testabilidade isolada da regra de remix e redução do arquivo congelado, não redução global de linhas.

## Contratos preservados

URL/método do remix, chaves e ordem do `prefill`, chaves de `missingPieces` e `source`, `next`, códigos
(`INDISPONIVEL`, 404), mensagens i18n (`scheme.remix_de`, `scheme.adicionar_ao_guarda_roupa_ou`), slots
upper/lower/shoes/accessory copiados da origem, layout/filtros por peça, origem do remix (`remixedFromId`, `REMIX`) e
autoria (o rascunho não carrega `user`; o salvamento usa quem remixa e mantém `originalScheme`). Limite de tags e
`TipoLook` opcional não são tocados (o prefill nunca copiou tags). Sem mudança de DTO, schema, migration, transação,
autorização ou configuração. Selos/FLAIR/Hype, `Msg`, `Views` e `ApiException` não foram alterados.

## Riscos e pendências do domínio 06

- `SchemeService` continua PARTIAL (1271): `create`/`replaceItems` (validação de posse + upsert de itens + preço/capa),
  `compose` (IA), `mine` (filtros/hype) e render do card. Próximo candidato: separar o mapeamento `ItemForm → SchemeItem`
  de `replaceItems` com caracterização de reordenação e de peça removida (RF9.CA02).
- `DnaService` (1461) e `MirrorService` (1254) não foram tocados neste lote; `LookbookService` (781) idem.
- Frontend (`/schemes`, `/dna*`, `/mirror`, `/lookbook`) não alterado.
- COVERAGE/INDEX ficam para o orquestrador; `line_baseline.json` não editado (teto de `SchemeService` pode ser apertado
  para 1271 com `--update` na integração).
