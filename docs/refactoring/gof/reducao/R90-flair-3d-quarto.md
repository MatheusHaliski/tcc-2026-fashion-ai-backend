# Lote R90-flair-3d-quarto — o Meu Quarto deixa de ser tela; o Espelho ganha casa própria

Parte do FLAIR 3D (100 jogos FLAIR): o quarto continua existindo como dados (`/api/me/room`, `RoomController`/
`RoomService` intactos) e como cenário dos jogos da Suíte de Vidro (`components/room3d/*` e `lib/room3d/*` não foram
tocados). O que sai é a **tela** `/room`; o espelho 2D que vivia dentro dela (vista "flat mirror", aparelho sem WebGL)
passa a ser a tela `/mirror`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `app/(site)/(app)/room/page.tsx` (`page`, 250; congelado em 665) | 665 | 24 | `components/mirror/mirror-page.tsx` (46), `components/mirror/use-mirror-page.ts` (46), `components/mirror/mirror-page.test.tsx` (78) | nenhum |
| `app/(site)/(app)/mirror/page.tsx` (`page`) | 17 (só redirecionava) | 7 (`RequireAuth` + `Suspense` + `<MirrorPage/>`) | — | nenhum |
| `components/app-shell.tsx` (congelado 352) | 352 | 350 | — (saiu o caso especial `/room` ↔ `/mirror` de `useIsActive`) | nenhum |
| `components/expanded-card/expanded-piece.tsx` (congelado 256) | 256 | 255 | — (saiu o item de menu "Mostrar no quarto") | nenhum |
| `components/mirror/mirror-part-sheet.tsx` | 136 | 136 | — (o item "Mostrar no quarto" só aparece quando um anfitrião com cena o oferece; sem anfitrião não há link `/room?piece=`) | nenhum |
| `lib/nav/mirror-href.ts` | 18 | 19 | — (`MIRROR_ROOM_PATH = "/mirror"`; `mirrorHref` → `/mirror[?vestir=…][&vista=2d]`) | nenhum |
| `lib/nav/nav-items.ts` | 1 linha trocada | — | — (`/room` sai; `{ href: "/mirror", key: "nav.mirror", icon: "ACT-32", auth: true }` no grupo Guarda-roupa) | nenhum |

Saiu do baseline da catraca: `app/(site)/(app)/room/page.tsx` (24 ≤ 250). Apertados: `app-shell.tsx` 352 → 350,
`expanded-piece.tsx` 256 → 255 (`python -m scripts.refactoring.line_ratchet --update`).

## Como foi dividido

- **`room/page.tsx` (665 → 24)**: deixou de hospedar a cena 3D, a caminhada do personagem, a prova do espelho, as portas
  e o "Mostrar no quarto". Virou só um redirecionamento dos links antigos, com o esqueleto à vista e "Carregando…" para o
  leitor de tela enquanto redireciona:
  `/room` → `/flair/jogos?district=SUITE`; `/room?espelho=1[&vestir=X][&vista=2d]` → `/mirror[?vestir=X][&vista=2d]`
  (via `mirrorHref`); `/room?piece=X` → `/closet`.
- **`components/mirror/mirror-page.tsx` (46)**: o branch "flat mirror" do original (palco `MirrorStage mode="2d"` com a
  dica de espelho vazio e o recado post-it + `MirrorControls` com partes do look, Vista-me/Outra sugestão, leitura do look,
  usar hoje, salvar, provar, tira uma coisa, GRWM), com `PageHeader` (título `nav.mirror`, `lead` = restrição do desafio
  ativo ou `mirror.page.lead`) e as ações de volta ao Guarda-roupa (`/closet`) e ao Provador (`/try-on`). Sem `host`:
  os pedidos vão direto a `/api/me/mirror` (não há mais reação do personagem, luz nas portas nem "Mostrar no quarto").
- **`components/mirror/use-mirror-page.ts` (46, hook ≤ 150)**: o estado mínimo copiado do original — `useApi('/api/me/mirror')`,
  `useMirrorPins`, detecção de WebGL (`webglOk`, antes `webglOk` de room/page.tsx), e o link de entrada
  `?vestir=<id>[&vista=2d]` que veste a peça ao abrir (`POST /api/me/mirror/pieces`, aviso do servidor no toast), uma vez por
  link (`linkSeen`), e tira os parâmetros da URL com `router.replace("/mirror", { scroll: false })`, como a página antiga
  fazia com `vestir`.
- **Navegação**: `/mirror` é item próprio (grupo Guarda-roupa) e `/room` sai do menu; `app-shell.tsx` perde o caso
  especial que acendia o Meu Quarto na rota `/mirror`. A navegação derivada (`lib/nav/active-override.ts`) continua
  disponível para qualquer pai.
- **Links**: `atelier-hub.tsx` e `atelier/room-panel.tsx` → `/flair/jogos?district=SUITE` (chave existente
  `atelier.visitRoom` passa a "Jogar na Suíte de Vidro" / "Play in the Glass Suite" / "Jugar en la Suite de Cristal");
  Java (troca de string, mesma contagem de linhas): `InventoryScoreService.java:978` `"/room"` → `"/flair/jogos?district=SUITE"`,
  `LookbookService.java:365` `"/room?espelho=1"` → `"/mirror"`, `PersonalInsights.java` (5×) `"/room?espelho=1&vestir="` → `"/mirror?vestir="`.
- Chave i18n nova: `mirror.page.lead` (pt-BR/en/es).

## Por que nenhum padrão GoF

Não há problema estrutural: uma tela foi removida e uma vista que já era um branch do original passou a ser componente +
hook, na divisão usual do repositório (componente de apresentação ≤ 250, hook de estado ≤ 150). `MirrorControls` já
tinha o `host` opcional (ações que o quarto fazia do jeito dele); sem anfitrião ele usa o padrão, então não houve
necessidade de Strategy/Adapter — o ponto de variação já existia e só deixou de ser usado por esta tela.

## Testes e equivalência

- Caracterização do espelho 2D **antes** da extração: `app/mirror-tipo-look.test.tsx` e `app/mirror-settings-hype.test.tsx`
  já exercitavam o espelho (tipo de look, leitura do look com os seis números, Vista-me) contra `/api/me/mirror`, abrindo-o
  dentro do quarto (`/room?espelho=1`, cena 3D mockada). Depois da extração, só a abertura mudou (importam `MirrorRoute`
  e não precisam mais mockar a cena nem o WebGL); as asserções sobre o painel do espelho não mudaram.
- Novo `components/mirror/mirror-page.test.tsx`: palco 2D sem WebGL + painel, sem redirecionar, sem link para `/room`;
  espelho vazio; `?vestir=<id>&vista=2d` veste uma vez e limpa a URL; falha ao vestir vira aviso e o look fica; erro ao
  carregar oferece tentar de novo.
- `app/mirror-redirect.test.tsx` reescrito (os 4 redirecionamentos de `/room`, `/mirror` não redireciona, `mirrorHref`);
  `app/room-page.test.tsx` (342) apagado com a tela; `nav-active-override`, `app-shell-nav-order`, `expanded-card`,
  `mirror-controls`, `atelier-hub-tendencias` ajustados à nova navegação; `lib/routes.test.ts` continua verde;
  `app/pages.smoke.test.tsx` passa a incluir `/mirror` (tela de verdade) e mantém `/room` (mostra o esqueleto).

```
npx vitest run app components/mirror components/atelier components/nav-active-override.test.tsx \
    components/app-shell-nav-order.test.tsx components/expanded-card.test.tsx lib/routes.test.ts lib/nav
npx tsc --noEmit
node scripts/i18n/scan.js | grep -E "mirror|room"
/opt/maven/bin/mvn -B -ntp -o -q -pl fai-application test -Dtest='InventoryScore*Test,Lookbook*Test,PersonalInsights*Test' -Dsurefire.failIfNoSpecifiedTests=false
python -m scripts.refactoring.line_ratchet
```

| Etapa | Resultado |
|---|---|
| vitest (lista acima) | 52 arquivos: 502 testes verdes; as 10 falhas são alheias ao lote (8 × `lab/heist*/page.tsx` no smoke — falham igual num worktree limpo de HEAD, import dinâmico do jogo 3D passa dos 3 s; `gate/verify/route.test.ts` e `admin/moments/page.test.tsx` passam isolados) |
| `tsc --noEmit` | sem erros |
| `scan.js` (mirror/room) | nenhum texto embutido |
| Java (`InventoryScore*Test,Lookbook*Test,PersonalInsights*Test`) | BUILD SUCCESS |
| Catraca | 0 violações; `room/page.tsx` saiu do baseline, `app-shell.tsx` e `expanded-piece.tsx` apertados |

Sem banco, servidor, migration ou mudança de DTO/URL de API: só URLs de navegação do app mudaram, e as antigas
redirecionam.
