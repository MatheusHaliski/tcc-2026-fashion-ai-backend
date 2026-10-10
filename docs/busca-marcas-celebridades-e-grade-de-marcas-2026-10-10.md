# Buscar → Marcas/Celebridades em cards e grade de marcas no criador de peça (10/10/2026)

## Buscar → Marcas e Buscar → Celebridades no formato de Buscar → Pessoas

As abas **Marcas** e **Celebridades** da busca (RF8) listavam os resultados numa lista vertical simples (`ul.fai-list`:
logo/avatar, nome, chip de Hype e um botão por linha). Agora usam o **mesmo card e a mesma grade** de **Pessoas**
(`components/search-entity-card.tsx`, com as classes de `PublicProfileCard`/`institutional-profile-*`): faixa de capa,
avatar/logo grande, nome e `@`, selos (**Marca** ou **Celebridade**; **verificado** nas celebridades; **Marca do catálogo ·
sem perfil** quando a marca ainda não tem perfil no Fashion AI), contador de **peças públicas** (marcas), o chip de Hype
("Marca em alta"/"Criador em alta", o mesmo agregado público de antes) e a ação: **Abrir perfil** (`/brands/<slug>` ou
`/u/<username>`) ou, para a marca só do catálogo, **Ver peças** (vai à aba Peças com o filtro da marca).

A grade é a de Pessoas: 1 coluna até 1279 px, 2 colunas a partir de 1280 px (`.institutional-profile-feed`).

## Grade de marcas na busca catalogada do criador de peça (RF4/RF47)

Em **Adicionar peça → Busca catalogada**, a marca deixou de depender de digitar o nome: acima do campo "3. De qual
marca?" aparece a **grade completa de marcas do catálogo** — a mesma vitrine de *Lojas em destaque* do provador
(`GET /api/catalog/stores`, classes `.fitting-stores`/`.fitting-store`, logo, nome e nº de produtos). Um toque escolhe a
marca (preenche o campo e a referência da marca, `brandRef`); tocar de novo desfaz. Digitar no campo **filtra a grade** e
continua aceitando uma marca fora do catálogo; sem nenhuma marca com o texto, um aviso curto. Sem a rota de lojas
(servidor antigo), fica só o campo. No provador a grade da busca fica desligada (`brandGrid={false}`): ele já tem a
própria vitrine.

## Evidências (API simulada, Chromium headless)

`docs/evidencias/busca-marcas-2026-10-10/`: `busca-marcas-desktop`, `busca-celebridades-desktop`, `busca-marcas-mobile`,
`busca-celebridades-mobile`, `criador-marcas-grade-desktop` (Adidas escolhida na grade: tile ativo e campo preenchido),
`criador-marcas-grade-mobile`.

## Testes

- `app/search-entities.test.tsx`: cards de marca (logo, @, selo, contador, Abrir perfil; marca do catálogo → Ver peças →
  aba Peças com `brand=`), cards de celebridade (@, verificado, link `/u/`, foto).
- `components/catalog/catalog-brand-grid.test.tsx`: grade lista todas as marcas, toque escolhe e preenche o campo, toque
  de novo desfaz; digitar filtra e aceita marca fora da grade; sem a rota de lojas só o campo.
- `components/hype/hype-groups.test.tsx`, `components/catalog/fitting-room.test.tsx` e `shell-and-flows.test.tsx` seguem
  verdes (chips de Hype nos cards; provador sem grade duplicada).
