# Auditoria de IHC/UX — AURA, Metamorfose, Selos, Hype Score e níveis (2026-10-25)

Auditoria do código no commit `0b1ee4a` (main). Cada pergunta recebe **Aprovado**, **Parcial**, **Reprovado** ou
**Sem evidência**, com a referência ao código. "Sem evidência" quer dizer que o comportamento não foi encontrado no
código nem testado; não quer dizer que falha.

## 0. Achados que mudam a premissa da auditoria

1. **Existem 3 níveis, não 7.** `FaiPointsService.Level` tem só `ESTREIA` (exibido como Básico, 0 pts), `STUDIO`
   (300) e `LOFT` (900). A migração `V74__tres_niveis_basico_studio_loft.sql` converteu Closet, Atelier, Penthouse e
   Maison em Loft, e `Level.parse` mapeia esses nomes antigos para `LOFT`. O documento
   `docs/design/FAI_XP_NIVEIS_FLAIR.md` ainda lista os 7 níveis (com 2.000 / 4.000 / 7.500 / 12.000 pts) e está
   **desatualizado** em relação ao código.
2. **AURA Hype não abre no Loft.** A regra implementada (`AuraPermissionsService.HYPE_FINISH_TIERS` e
   `lib/fashion-card/aura-gating.ts` → `CARD_LEVEL_TIER`) é por acabamento da carta:
   - Comum → Básico (livre para todos, inclusive recém-cadastrados);
   - Rara e AURA dinâmica (`AURA_DYNAMIC`) → Studio;
   - Lendária e Collab/Drop → Loft.

   O cenário obrigatório "Estreia e Studio bloqueados, Loft desbloqueado" **não corresponde à regra do produto**. A
   equipe precisa decidir qual das duas regras vale (seção 16).
3. **AURA Metamorfose não tem autoria de marcas/celebridades.** Só o admin cria artes
   (`AuraCommerceService.save` → `guard.requireAdmin`). Marcas e celebridades aprovadas apenas **compram licença** de
   uma arte existente (`purchase` → `requireApprovedInstitutional`). Não há editor, dono, coleção, versão nem
   visibilidade por preset. As seções 2 e 3 ficam majoritariamente reprovadas.
4. **O número do AURA Hype é dado vivo.** `components/hype/aura-hype.tsx` renderiza `LedNumber value={displayScore(state.score)}`
   a partir de `/api/hype/summaries`, o mesmo cache (`lib/hype/use-hype.ts`) usado pelo verso do card
   (`hype-card-back.tsx`). Não há vídeo com número gravado: `aura-hype-presets.ts` não referencia mp4/vídeo.
5. **Build quebrado na main:** `CatalogImagePipelineService.java` usava `CatalogImageType` sem import (resultado de
   merge), e o módulo `fai-application` não compilava. Corrigido neste branch com uma linha de import.

### Testes executados

| Suite | Resultado |
|---|---|
| `mvn -pl fai-application -am test -Dtest=AuraPermissionsServiceTest,MetamorphoseInventoryServiceTest,AuraCommerceServiceTest,BackgroundStudioServiceTest,FashionCardLevelsTest,HypeLiveRecalcTest,AuraHypeDropServiceTest,PreferencesServiceTest,FaiPointsGamesTest` | 52 testes, 0 falhas (depois do fix de import) |
| `npx vitest run components/hype/aura-hype-picker.test.tsx components/hype/aura-hype.test.tsx components/card-border.test.tsx lib/hype/live-hype.test.tsx lib/hype/fashion-card.test.ts` | 23 testes, 0 falhas |

Nenhum teste E2E com app em execução foi rodado nesta auditoria.

---

## 1. Desbloqueio por XP e nível de perfil

| # | Status | Evidência / correção |
|---|---|---|
| 1 | Aprovado | Ledger append-only; `lifetime` soma só lançamentos com `countsLifetime=true` (`FaiPointsService.award`). |
| 2 | Aprovado | Saldo (`balance`) e vitalício (`lifetime`) separados; compras gravam `countsLifetime=false` (`AuraCommerceService.purchase`). Não há uma terceira pontuação cumulativa separada. |
| 3 | Parcial | Backend: `FaiPointsService.Level` + `AuraPermissionsService.AuraGatingConfig`. O frontend **duplica** a tabela em `lib/fashion-card/aura-gating.ts` em vez de ler `/api/me/aura-permissions` (que já devolve `requiredTier`). A documentação diverge (7 níveis). |
| 4 | Aprovado | `Level.of(ledger.lifetime(userId))` em cada checagem; o cliente não envia nível. |
| 5 | Aprovado | `GET /api/me/points` devolve `level`, `nextLevel.missing` e `levels[]`; UI em `components/points/fai-xp-progress.tsx` e `profile-level-progress.tsx`. |
| 6 | Parcial | No picker de acabamento Hype cada nível mostra "requer {nível}". Metamorfose e Impersonation mostram a mensagem `auraGate.locked.*`, mas não há um catálogo único "recurso → nível" visível. |
| 7 | Parcial | `levels[].reached` e `aura-permissions.auras[].allowed` existem; não há uma tela consolidada de "desbloqueados / bloqueados". |
| 8 | Reprovado *(contra a regra proposta)* | Recém-cadastrado ativa AURA Hype **Comum** (`HYPE_FINISH_TIERS.COMMON = ESTREIA`). Pela regra do código isso é intencional. |
| 9 | Reprovado *(contra a regra proposta)* | Studio ativa Comum, Rara e AURA dinâmica. |
| 10 | Parcial | No Loft tudo abre automaticamente (Lendária e Collab/Drop), mas o Hype básico já abria antes. |
| 11 | Aprovado | O nível é recalculado por requisição; o picker refaz `/api/me/aura-permissions` a cada 30 s (`refreshInterval:30000`). |
| 12 | Aprovado | `BackgroundStudioService.requireAuraAccess` é chamado em `SchemeService` (criar/editar/publicar) e `WardrobeService`; devolve 403 `AURA_LEVEL_REQUIRED`. **Exceção:** a preferência `auraHype` (`PreferencesService.update`, linha ~284) não tem gate; ver 5.4. |
| 13 | Aprovado | Chave de idempotência `user:action:ref` (ou data) e limites diário/semanal em `award`. |
| 14 | Parcial | Notificação `ROOM_LEVEL_UP` ("Seu quarto evoluiu… nível liberado") é genérica, focada no quarto; não cita AURA Hype/Metamorfose. |
| 15 | Parcial | Mensagens `auraGate.requires` / `auraGate.locked.*` explicam o bloqueio; não há link direto para "como ganhar XP". |

## 2. AURA Metamorfose — criação por marcas e celebridades

| # | Status | Evidência / correção |
|---|---|---|
| 1 | Aprovado | `ProfileType.MARCA`, `CELEBRIDADE` e pessoal; `Guard.requireApprovedInstitutional`. |
| 2 | Reprovado | Ninguém além do admin cria preset publicável (`AuraCommerceService.save` → `requireAdmin`). |
| 3 | Reprovado | Não existe editor para gatear. A compra de licença exige perfil aprovado, não XP. |
| 4 | Reprovado | Não definido. |
| 5 | Reprovado | Não há checagem combinada tipo + XP. Para **usar** Metamorfose: nível Loft (`AURA_METAMORPHOSE`) + posse da arte (`MetamorphoseInventoryService.require`). |
| 6 | Aprovado | Conta pessoal não cria (403 admin) e não aplica arte que não possui (`AURA_ART_REQUIRED`, comparação campo a campo com a config da oferta). |
| 7–11 | Reprovado | Não há editor. O admin envia um JSON `config` validado por `validateArtwork`; sem preview, sem descrição (só `name`). |
| 12 | Parcial | `code` persistente (PK). **Sem proprietário/criador** em `AuraArtOffer`. |
| 13 | Reprovado | `@Version` é lock otimista, não histórico. |
| 14 | Parcial | Validação técnica (`validateArtwork`); sem moderação. |
| 15 | Reprovado | Sem vínculo com coleção. |
| 16 | Reprovado | Só `active` true/false. Rewards (`AtelierRewardGrant.expiresAt`) dão validade temporária, mas apenas para recompensas FLAIR. |
| 17 | Sem evidência | Não há distinção oficial × comum, porque usuário comum não cria. |
| 18 | Parcial | Posse validada no backend (licença/reward), mas "exclusividade de um emissor" não existe como conceito. |

Observações:
- `AuraCommerceService.requireLicense` **não é chamado em lugar nenhum**; a promessa "licença antes de configurar a
  promoção" não é aplicada.
- `AtelierGrants.synergy` gera códigos `SYNERGY_*`, mas `MetamorphoseInventoryService.add` só aceita códigos com
  oferta `METAMORPHOSE` cadastrada. Sem oferta `SYNERGY_*`, a recompensa não vira arte equipável.
- `lib/aura-metamorphose.ts` tem presets de marca (Nike, Adidas, ASICS) **fixos no frontend**, sem registro no
  backend nem autoria.

## 3. Publicação e distribuição

| # | Status | Evidência / correção |
|---|---|---|
| 1 | Parcial | `GET /api/aura-store` lista ofertas `active=true`. Todas as sementes de `V65` estão `active=FALSE`; o catálogo nasce vazio. |
| 2 | Reprovado | Sem busca por nome/criador/coleção. |
| 3 | Parcial | Usuário vê o catálogo, mas só **issuers** compram (`purchase`). Usuário comum só recebe por reward. |
| 4 | Reprovado | Sem categoria de oficiais. |
| 5 | Reprovado | Sem criador. |
| 6 | Parcial | `pricePoints` é exibido; não há "exclusivo de evento". |
| 7 | Sem evidência | Não foi encontrado preview da oferta antes da compra. |
| 8–9 | Parcial | A arte equipada é renderizada por `AuraMetamorphose` + `borderStyle` (paleta do preset/modo). |
| 10–11 | Sem evidência | Sem teste visual de preservação de conteúdo; peça e look aceitam `background.auraMetamorphose`. |
| 12 | Reprovado | Não há coleção. |
| 13 | Reprovado | O admin sobrescreve `config_json` da oferta; os cards gravam uma cópia da config e passam a **falhar em `require`** na próxima edição, porque a comparação é por igualdade com a config atual. |
| 14–15 | Parcial | Desativar a oferta não apaga cards existentes (a config está no card), mas `mine()` ainda lista a licença. Não há regra documentada novo uso × uso existente. |
| 16 | Reprovado | Sem rastreio de versão por card. |
| 17 | Sem evidência | — |
| 18 | Parcial | Aplicar exige posse (backend). Ver o catálogo é público para usuário autenticado. |

## 4. Qualidade visual e animações

| # | Status | Evidência / correção |
|---|---|---|
| 1–5 | Parcial | Metamorfose tem 4 modos (PRISMA, CONSTELACAO, FIO_VIVO, HOLOGRAFIA) com paletas próprias. Hype passou de 40 variações quase idênticas para 8 layouts (comentário em `aura-hype-presets.ts`). As combinações AURA + material (ex.: `P12_M01…M12`) são vídeos; sem inspeção visual nesta auditoria. |
| 6–7 | Sem evidência | Requer inspeção dos vídeos. |
| 8 | Parcial | `borderStyle` prioriza a paleta do preset/marca. |
| 9 | Sem evidência | — |
| 10 | Aprovado | Config determinística; `combination()` resolve preset + material de forma pura. |
| 11 | Sem evidência | — |
| 12 | Parcial | Existem `AURA_FORMATS` (imagem única/mosaico) e versões animada/estática por combinação. |
| 13 | Aprovado | `prefers-reduced-motion` global (`globals.css:65`) e regras específicas para `.aura-hype`, `.aura-metamorphose-field` e `.card-border`; o picker pausa a demo. Preferência `reduceMotion` salva no backend. |
| 14 | Parcial | `validateArtwork` e `resolveCombination` validam IDs; não há versionamento de material. |
| 15 | Parcial | O picker separa bandas "static" e "dynamic". |

## 5. AURA Hype — desbloqueio e ativação

| # | Status | Evidência / correção |
|---|---|---|
| 1 | Aprovado | Picker e família `HYPE` próprios. |
| 2 | Parcial | Texto `auraHype.global` e demo com score; a relação acabamento × classificação do servidor não é explícita na UI. |
| 3 | Reprovado *(contra a regra proposta)* | Comum: Básico; Rara: Studio; Lendária/Collab: Loft. |
| 4 | Parcial | Acabamentos gateados no backend (`requireHypeFinish`). **A preferência `auraHype` (`PUT /api/me/preferences`) não tem gate**: qualquer nível liga a borda SHIMMER e o pulso de Hype nos cards que vê (`piece-card.tsx:71`, `scheme-card.tsx:208`, `expanded-card.tsx:177`). Isso afeta só a visualização local, não o card publicado, mas usa o nome "AURA Hype" e contradiz a regra. |
| 5 | Aprovado | `auraGate.requires` por nível no picker. |
| 6 | Aprovado | `ModelDemo` mostra cada acabamento com dados DEMO, inclusive os bloqueados. |
| 7 | Aprovado | Reconsulta a cada 30 s. |
| 8 | Aprovado | `auraHype: "OFF"` no background; não exclui o card. |
| 9 | Parcial | A UI mistura borda (`CardBorder`), moldura (`.aura-hype[data-fashion-level]`) e painel de métricas sem nomear cada parte. |
| 10 | Reprovado | Escolher o preset aplica direto (`onChange(p.id)`), sem confirmação. |
| 11 | Aprovado | Persistido no `background_config_json` e em `user_preferences.aura_hype` (V62). |
| 12 | Aprovado | O nível usa `lifetime`; gastos têm `countsLifetime=false`. |
| 13 | Aprovado | Picker diferencia `auraGate.checkFailed` (com "tentar de novo") de bloqueio por nível. |
| 14 | Parcial | Marcas/celebridades seguem as mesmas regras de XP; Collab/Drop exige drop verificado pelo admin (`AuraHypeDropService`). Não há documentação dedicada. |
| 15 | Parcial | 403 `AURA_LEVEL_REQUIRED` com `requiredTier` e mensagem i18n. A mensagem `AURA_HYPE_INVALID` está fixa em português. |

## 6. Bordas dinâmicas

| # | Status | Evidência / correção |
|---|---|---|
| 1 | Aprovado | `CardBorder entityId="PIECE:id"/"SCHEME:id"` com o `HypeViewState` da própria entidade. |
| 2 | Parcial | Moldura por `fashionCard.tier` (`FashionCardLevels.of`: RARE+CLASSIC → Lendária; RARE ou TRENDING → Rara; senão Comum). As 6 faixas de score (20/40/60/75/90) **não** alteram a borda; a cor da borda vem do preset escolhido, não da faixa. |
| 3 | Parcial | Muda quando muda a classificação da carta (selos), não quando o score cruza uma faixa. |
| 4 | Parcial | CSS por tier (`globals.css:3999-4013`). |
| 5 | Aprovado | Pulso de 2,4 s verde/vermelho (`HYPE_BORDER_PULSE_MS`) em mudança; tier aplicado direto. |
| 6–8 | Aprovado | Pulso `up`/`down`; tier recalculado do snapshot atual, então cai junto com os sinais. `fashionCardLevel` devolve `null` se o status não for `AVAILABLE`. |
| 9 | Parcial | O snapshot só muda a cada recálculo (≤120 s, `HypeLiveRecalc`) e o cliente consulta a cada 30 s, o que limita a oscilação. Não há histerese explícita nas fronteiras. |
| 10 | Parcial | Score antigo continua visível marcado como `stale` (↻), sem dado inventado. |
| 11 | Parcial | Mesmo componente em `piece-card`, `scheme-card` e `expanded-card`; perfil/feed usam esses cards. |
| 12 | Aprovado | Verso (`hype-card-back.tsx`) e frente leem o mesmo `useHypeSummary`. |
| 13 | Sem evidência | — |
| 14 | Sem evidência | — |
| 15 | Parcial | `sr-only` com "HYPE {score}" e reduced-motion; borda é `aria-hidden`. O pulso usa só cor (verde/vermelho), sem seta. |
| 16 | Parcial | Acabamentos acima do nível são bloqueados; a preferência `auraHype` sem gate liga a borda (ver 5.4). |

## 7. Atualização numérica do Hype

| # | Status | Evidência / correção |
|---|---|---|
| 1 | Aprovado | `/api/hype/summaries`, snapshot `HypeScoreCurrent`, mesma fonte do Analytics. |
| 2 | Aprovado | `LedNumber` com o valor da API; não há vídeo com número. |
| 3–4 | Aprovado | `HypeLiveRecalc` marca como sujo em eventos e recalcula em ≤120 s; o cliente revalida a cada 30 s com `liveUpdates` quando AURA está ativa. |
| 5 | Aprovado | Chave `PIECE:id` / `SCHEME:id`. |
| 6 | Sem evidência | `hype-group-badge.tsx` usa `useHypeGroup`, mas a AURA Hype não consome o valor do HypeGroup. |
| 7 | Aprovado | Título `auraHype.global`; o dado pessoal fica em outra rota (`HypePersonalDataTest`). |
| 8 | Aprovado | Mesmo cache. |
| 9–11 | Aprovado | Leitura dinâmica; o evento `fai:hype-source-updated` invalida o cache. |
| 12 | Aprovado | `stale` + ↻ com `aria-label`. |
| 13 | Parcial | TTL do cliente 5 min, servidor `HypeCache` 10 min; documentado em comentários, não em um doc de política. |
| 14 | Aprovado | O número não faz parte da arte. |
| 15 | Parcial | `displayScore` arredonda para inteiro; sem formatação por locale (é 0–100, então tem pouco impacto). |
| 16 | Aprovado | Sem score → "não calculado"/"dados insuficientes", nunca 0; `fashionMetric` rejeita valores fora de 0–100 e NaN. |
| 17 | Sem evidência | — |
| 18 | Aprovado | Em erro mantém o `summary` antigo (`flush` catch). |

## 8. Frente e verso

| # | Status | Evidência |
|---|---|---|
| 1 | Parcial | No `piece-card` a AURA usa `showScore={false}` (frente sem número); o look mostra o número. |
| 2 | Aprovado | `CardFlipButton` em `fashion-card.tsx`, `scheme-card.tsx` e `hype-card-back.tsx`. |
| 3–4 | Aprovado | Mesmo `useHypeSummary`. |
| 5, 6, 10 | Sem evidência | Requer teste visual. |
| 7 | Parcial | Mesmos componentes nas superfícies. |
| 8 | Parcial | `FashionCardLevels` documenta "nível da carta ≠ faixa de Hype ≠ autenticidade", mas a UI não explica isso. |
| 9 | Aprovado | O tier é derivado do snapshot; a config do card não é reescrita. |

## 9. Selos

Inspeção superficial: `SealService`, `SealPolicies`, `HypeSeals`, `IssuerReviewService` e o documento
`docs/selos-hype-emissores-2026-10-09.md`.

| # | Status | Evidência |
|---|---|---|
| 1–3 | Parcial | `HypeSeals` (sinais de Hype) separado de selos de emissor; `FashionCardLevels` declara a separação de autenticidade física. |
| 4 | Parcial | Selos de marca/celebridade passam por `IssuerReviewService`; presets AURA não têm autoria (seção 2). |
| 7–8 | Parcial | Bonds têm `revoke`; validade de rewards em `expiresAt`. |
| 12 | Aprovado | Selos e tiers calculados no servidor (`HypeSeals.of`, `FashionCardLevels.of`). |
| 5, 6, 9, 10, 11 | Sem evidência | Requer revisão de UI. |

## 10. Background Studio

| # | Status | Evidência |
|---|---|---|
| 1–2 | Aprovado | `catalog()` expõe `auraPresets` separado de materiais, direções e skins. |
| 3, 10 | Parcial | `combination(aura, material, animated, mosaic)` resolve; validação de IDs desconhecidos (`PRESET_INVALIDO`). |
| 5–7 | Parcial | `animated` na combinação; `BackgroundStudioAnimationTest`. |
| 8 | Aprovado | `requireAuraAccess` + validação no salvar. |
| 11 | Parcial | Peça, look e `PIECE_ANATOMIES`; DNA de estilo não verificado. |
| 12–13 | Reprovado | Sem origem/autoria de presets oficiais nem proteção de identidade de coleção. |
| 4, 9, 14 | Sem evidência | — |

## 11. Persistência e sincronização

| # | Status | Evidência |
|---|---|---|
| 1, 4 | Aprovado | `background_config_json` no servidor. |
| 2 | Aprovado | IDs (`variantId`, `code`) separados de `name`/label i18n. |
| 3 | Reprovado | Sem versionamento de preset (ver 3.13). |
| 5–7 | Aprovado | Score não é salvo no card; leitura viva. |
| 8 | Aprovado | `clientUpdatedAt`: a alteração mais recente vence (RF23.CA02). |
| 10 | Parcial | Idempotência em pontos, licenças e jobs de motion (`requestKey`); publicação de card não verificada. |
| 11 | Parcial | Ver 3.14. |
| 12 | Parcial | Testes unitários de gate, inventário, commerce e live recalc; sem E2E de subir de nível → desbloquear. |
| 9 | Sem evidência | — |

## 12. Compreensão do usuário

Sem teste com usuários. Pela leitura do código:
- 2 (Metamorfose × Hype): **Parcial**, telas e gates distintos.
- 3 (Hype × XP): **Parcial**, o nome "AURA Hype" é usado para a preferência sem gate e para os acabamentos gateados.
- 5: **Aprovado** (demo dos acabamentos).
- 7 e 12: **Reprovado** (sem identificação nem filtros de presets oficiais).
- 13 (perguntas 1, 4, 6, 8–11): **Sem evidência**.

---

## 13. Matriz E2E (resultado previsto pelo código)

| ID | Resultado previsto | Status |
|---|---|---|
| AURA-001 | Estreia **ativa** AURA Hype Comum; Rara/Lendária negadas com `requiredTier` | Reprovado contra a regra proposta / Aprovado contra a regra do código |
| AURA-002 | Studio via API: Comum, Rara e dinâmica aceitas; Lendária e Collab → 403 | Idem |
| AURA-003 | Loft: tudo liberado sem relogin | Aprovado |
| AURA-004 | Marca não cria Metamorfose em nenhum nível (só admin) | Reprovado (fluxo inexistente) |
| AURA-005 | Celebridade não cria preset | Reprovado |
| AURA-006 | Admin publica (`active=true`) e aparece no `/api/aura-store` | Parcial |
| AURA-007 | Aplicação exige Loft + posse da arte | Parcial (usuário comum só por reward) |
| AURA-008/009 | Número e pulso acompanham subida e queda; tier acompanha os sinais | Aprovado (número) / Parcial (borda não segue faixas) |
| AURA-010 | Recálculo ≤120 s e polling de 30 s amortecem; sem histerese | Parcial |
| AURA-011 | Verso = frente (mesmo cache) | Aprovado |
| AURA-012 | `OFF` → sem AURA | Aprovado |
| AURA-013 | Nova config da oferta **quebra** a reedição de cards antigos (`AURA_ART_REQUIRED`) | Reprovado |
| AURA-014 | Mantém o valor anterior em caso de erro | Aprovado |
| AURA-015 | Gates no backend por ledger; exceção: preferência `auraHype` sem gate (efeito só local) | Parcial |

## 14. Nota ponderada (estimativa)

| Bloco | Peso | Nota (0–1) | Pontos |
|---|---:|---:|---:|
| Desbloqueios, XP e permissões | 20% | 0,70 | 14 |
| Criação e publicação de Metamorfose | 20% | 0,15 | 3 |
| Atualização dinâmica do Hype | 25% | 0,85 | 21 |
| Bordas, animações e selos | 15% | 0,55 | 8 |
| Usabilidade e clareza | 10% | 0,50 | 5 |
| Persistência e sincronização | 10% | 0,70 | 7 |
| **Total** | | | **≈ 58/100** |

Não atende aos critérios de aprovação integral: falta a criação e publicação de Metamorfose por marcas e celebridades,
e a regra de desbloqueio no Loft não é a implementada.

## 15. As cinco perguntas decisivas

1. **Regra única tipo de conta + XP para Metamorfose oficial?** Não. A criação é exclusiva do admin; o uso exige Loft
   + posse da arte. Marcas e celebridades só compram licença.
2. **Fluxo completo publicação → descoberta → aplicação por terceiros?** Não. Ofertas não têm criador nem coleção;
   usuário comum não compra e só recebe por reward FLAIR; `requireLicense` não é usado.
3. **AURA Hype bloqueado até Loft, inclusive na API?** Não, por decisão de produto: Comum é livre, Rara/dinâmica no
   Studio e Lendária/Collab no Loft, com gate real na API. A preferência `auraHype` não tem gate.
4. **Bordas recalculadas inclusive na queda?** Sim, para o tier da carta (selos) e para o pulso de direção. As faixas
   de score não mudam a borda.
5. **Número alimentado pelo Hype atualizado?** Sim. `LedNumber` lê o snapshot vivo; não há número gravado em vídeo.

## 16. Correções recomendadas (por prioridade)

1. **Decidir a regra do AURA Hype** (Loft para tudo, ou a regra atual por acabamento) e alinhar
   `AuraPermissionsService`, `aura-gating.ts` e os docs. Atualizar `FAI_XP_NIVEIS_FLAIR.md` para 3 níveis.
2. **Gatear ou renomear a preferência `auraHype`** em `PreferencesService.update`, como já é feito com
   `auraImpersonation`.
3. **Metamorfose autoral:** adicionar `ownerId`, `collectionId`, `visibility`, `versions[]` em `AuraArtOffer` e um
   endpoint de criação com `requireApprovedInstitutional` + nível mínimo, com moderação. Os cards devem referenciar
   `code@version` em vez de comparar a config inteira (corrige AURA-013).
4. Ligar `requireLicense` ao fluxo de promoção, ou removê-lo.
5. Tornar a borda sensível à faixa de score (ou documentar que só o tier da carta muda) e adicionar seta ao pulso
   (não depender só de cor).
6. Confirmação explícita antes de aplicar AURA Hype num card publicado.
7. Frontend lê `requiredTier` de `/api/me/aura-permissions` em vez de duplicar a tabela.

## 17. Correções aplicadas (mesmo branch)

| Achado | Correção | Teste |
|---|---|---|
| Preferência `auraHype` sem gate (5.4, 6.16, AURA-015) | `PreferencesService.update` exige Studio (`AURA_DYNAMIC`); `get` devolve `auraHype=false` e `auraHypeAllowed=false` para quem não tem o nível. Configurações: interruptor bloqueado com "Requer nível Studio", e uma recusa do servidor desfaz a escolha local (antes ficava ligada como "preferência local") | `PreferencesServiceTest.auraHypeExigeStudioMesmoEmChamadaDireta` |
| Arte licenciada alterada quebrava cards existentes (3.13, AURA-013) | `AuraCommerceService.save` recusa mudar `config` de oferta já licenciada (409 `AURA_OFFER_LOCKED`; nova versão = novo código). Nome, preço e ativo continuam editáveis | `AuraCommerceServiceTest.licensedArtConfigIsFrozen` |
| `requireLicense` nunca chamado | Removido; a mensagem da compra não promete mais "promoções" | — |
| Tabela de níveis duplicada no frontend (1.3) | `/api/me/aura-permissions` devolve `hypeFinishes` (`configVersion` 2); o picker usa essa resposta e só cai na tabela local com resposta antiga | vitest `components/hype` |
| Pulso de Hype só por cor (6.15) | Seta ▲/▼ junto do pulso (`.card-border-arrow`) | `card-border.test.tsx` |
| Mensagem `AURA_HYPE_INVALID` fixa em português (5.15) | `Msg.t("auraHype.invalid")` em pt-BR/en/es | — |
| Documentação com 7 níveis (achado 0.1) | `FAI_XP_NIVEIS_FLAIR.md` reescrito com os 3 níveis e a regra por acabamento; "nível Estreia" → "nível Básico" nas mensagens | — |
| Build quebrado (achado 0.5) | Import de `CatalogImageType` | build |

Itens desta auditoria que **não** foram alterados, e por quê:
- **Regra do AURA Hype no Loft (1.8–1.10, 5.3):** é decisão de produto. O código segue a regra documentada (por
  acabamento) até haver uma decisão.
- **Editor de Metamorfose para marcas e celebridades, com coleção, versões e moderação (seções 2–3):** é uma
  funcionalidade nova, não uma correção. Precisa de modelo de dados, fluxo de revisão e tela.
- **Confirmação antes de aplicar o AURA Hype (5.10):** a escolha só vale ao salvar o card, e o salvar já é o passo
  explícito.
- **Recompensas `SYNERGY_*` sem arte correspondente:** depende de definir qual arte cada sinergia concede.
