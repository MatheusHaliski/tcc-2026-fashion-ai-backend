# Lote R90-flair-3d-motor — requisitos do motor CBC extraídos de `CbcRules` + tipos do FLAIR 3D

Branch: `claude/adoring-davinci-mufbri`. Pacote: `fai-application/src/main/java/br/com/fashionai/application/flair/`.
Motivo: os 100 jogos do FLAIR 3D pedem cinco tipos novos na DSL de requisitos, vagas opcionais e duas regras puras
novas (faixas de Hype e efeitos por vaga). `CbcRules.java` está congelado (615) e não podia crescer, então a avaliação
de requisitos (o `switch` de `requirement(...)`, ~110 linhas, e o helper `tagMatch` usado só por ele) saiu para arquivos
próprios e o original delega.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `flair/CbcRules.java` (`java-other`, 250; congelado) | 615 | 517 | `CbcRequirements.java` (86), `CbcRequirementsBoard.java` (95), `CbcRequirementsTags.java` (152), `Flair3dHype.java` (118), `Flair3dEffects.java` (74) | nenhum |

Testes novos (≤400 cada): `CbcRequirementsTest` (152), `CbcOptionalSlotsTest` (121), `Flair3dHypeTest` (161),
`Flair3dEffectsTest` (74).

## Como foi dividido

- `CbcRules.requirement(r, slots, board, cards, sintonia, ctx)` mantém assinatura e visibilidade (package-private;
  `CbcRulesRequisitosTest` chama por ela) e delega em uma linha para `CbcRequirements.evaluate(...)`, que calcula
  `n` e `args` e despacha para dois grupos coesos, cada um com um `switch` que devolve `null` quando o tipo não é dele:
  - `CbcRequirementsBoard` — tipos que olham a mesa: `tier`, `ovrAvg`, `ovrMin`, `sintonia`, `strictPosition` e os novos
    `cards {min}`, `mala {max}` (pesos Bronze 1 · Prata 2 · Ouro 3 · Especial 4), `position {position, count}`;
  - `CbcRequirementsTags` — tipos que olham as tags da carta: `brand`, `sameBrand`, `distinctBrands`, `tag`, `theme`,
    `hype`, `origin`, `noBuy`, `rediscovery` e os novos `distinctTags {field, count}` (cores contadas por família da
    taxonomia, como `colorMatch` já faz) e `hypeBand {min, count, scope, positions}` (faixa pela nota HYP via
    `Flair3dHype.bandOf`; sem `scope` = pelo menos `count`; `all` = todas as colocadas; `positions` = cartas nas posições
    listadas, `count` padrão = nº de posições).
  - Tipo desconhecido continua reprovando com `(ok=false, have=0, need=1)`.
- Os corpos dos 14 casos clássicos foram movidos sem alteração (mesmos comentários, mesmos `have/need`), com uma
  exceção deliberada para as vagas opcionais: `ovrAvg` passa de `cards.size() == n` para `cards.size() >= n`.
- Helpers compartilhados (`positionOk`, `harmonious`, `themeAny`, `themeFocus`, `idleDays`, `misses`, `tier`, `intOf`,
  `strings`, `norm`, `intersects`, `colorsMatch`) ficaram em `CbcRules` com a mesma visibilidade e entram nos novos
  arquivos por `import static`; nada foi duplicado. Só `tagMatch` (usado apenas pelo caso `tag`) mudou de dono. O
  `import java.util.HashMap`, que servia apenas a `sameBrand`, saiu de `CbcRules`.
- Validação (`CbcRules.validate`): os cinco tipos novos entraram em `TYPES`; a forma deles é checada por
  `CbcRequirements.validateShape(t, r, slots)` (erros `requirements.cards|mala|position|distinctTags|hypeBand`), chamada
  em uma linha dentro do laço existente; o teste genérico de `count` (1..nº de vagas) continua valendo para todos.
- Vaga opcional: `"optional"` entrou em `ACCEPT_KEYS`; `Slot.optional()` lê `accepts.optional == true`;
  `CbcRules.requiredSlots(slots)` conta as vagas não opcionais; `evaluate` passa a ter `complete` = todas as vagas NÃO
  opcionais preenchidas (Javadoc), `sintoniaMax` continua `3 × todas as vagas`, e `n` em `CbcRequirements` é o número
  de vagas não opcionais (tier only/max, ovrAvg, ovrMin sem count, origin, noBuy, strictPosition, cards sem min).
  `misses()` não olha `optional` (a chave não é uma exigência da carta).
- `Flair3dHype` (público, puro): `Band` (LOW_SIGNAL…VIRAL), limiares 20/40/60/75/90, `bandOf`, `parse`, `clampMax`,
  `shifted`, `playBonus` (NONE, BONUS_ABOVE_RELEVANT{cap}, LOW_IS_GOOD{bonus}, DIMENSION{dim, per, cap}, TIEBREAK),
  `partialShift` (NONE, UP_ONLY, UP_DOWN, ALL_UP_IF_COMPLETE) e `perfect(ev, requiredSlots)` = `ok && sintonia ≥ 2 × vagas
  obrigatórias` (R2).
- `Flair3dEffects` (público, puro): `Kind` (COMUM, METAMORFOSE, IMPERSONATION), `Effect(slot, kind, bonus)`, `of`, `bonusOf`,
  `all` e `total`; o chamador decide `metamorfoseAllowed` e as vagas `impersonationReady` (nível e aura, R21).

## Por que nenhum padrão GoF

O despacho `CbcRequirements → Board | Tags` com retorno `null` parece uma Chain of Responsibility, mas não há cadeia
configurável nem ordem que importe: são dois `switch` estáticos sobre um conjunto fechado de tipos, divididos por
responsabilidade para caber no limite. Uma interface `Requirement` com uma classe por tipo (Strategy) daria 19 classes
de 5 a 10 linhas para um `switch` que já é a forma mais legível de uma DSL pequena; nenhum tipo é escolhido em tempo
de execução por código, só pelo JSON do desafio. Registrado como "nenhum".

## Testes e equivalência

Caracterização: `CbcRulesTest` (8) e `CbcRulesRequisitosTest` (12) rodados antes e depois, sem alteração nos testes.

```
mvn -B -ntp -o -q -pl fai-application -am -Djacoco.skip=true test -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='CbcRulesTest,CbcRulesRequisitosTest,CbcRequirementsTest,CbcOptionalSlotsTest,Flair3dHypeTest,Flair3dEffectsTest,CbcSeedTest,FlairChallengeServiceTest'
python -m scripts.refactoring.line_ratchet --update && python -m scripts.refactoring.line_ratchet
```

| Etapa | Resultado |
|---|---|
| Original, `CbcRulesTest` + `CbcRulesRequisitosTest` | 8 + 12 testes, 0 falhas |
| Após a extração, os mesmos | 8 + 12 testes, 0 falhas |
| Novos: `CbcRequirementsTest`, `CbcOptionalSlotsTest`, `Flair3dHypeTest`, `Flair3dEffectsTest` | 8 + 5 + 7 + 3 testes, 0 falhas |
| `CbcSeedTest` (16 desafios da V56 continuam válidos) + `FlairChallengeServiceTest` | 1 + 10 testes, 0 falhas |
| Catraca | `CbcRules.java` 615 → 517 (`--update`); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, rede, IA, migration ou mudança de DTO/URL/i18n.
