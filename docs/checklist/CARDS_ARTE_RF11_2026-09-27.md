# Card da peça em camadas, detalhe e arte do card (RF11) — entrega de 27/09/2026

Continuação de [CARDS_DETALHE_2026-09-27.md](CARDS_DETALHE_2026-09-27.md). Anatomia atualizada:
[docs/anatomias/anatomias_card_v19.html](../anatomias/anatomias_card_v19.html) (a v18 fica como histórico).

## O que faltou para verificar

- **As duas capturas anexadas ao pedido não estavam disponíveis nesta sessão.** Nada foi comparado com elas.
- Nenhuma tela do Instagram foi aberta. O mapeamento para padrões de rede social (anatomia v19, seção 9) usa padrões
  públicos e conhecidos, não análise de telas.
- Uploads de vestidos, saias, jaquetas, calçados, bolsas e acessórios fotografados de verdade não existiam. Os
  templates dessas categorias foram verificados com as imagens de referência do catálogo (`public/assets_pecas`), não
  com fotos de pessoas.
- As capturas usam a API simulada (Playwright) com imagens geradas pelo pipeline de imagem real (flat lay → estúdio →
  feed por template). Não há teste contra o banco de dados real.

## Inventário: para onde foi cada controle

| Controle (antes) | Agora | Quem vê |
|---|---|---|
| Linha de ações com ícones FAI em disco (curtir, comentar, compartilhar, remixar, reações, 3D) | Linha única: curtir, comentar, compartilhar com contagem ao lado + salvar à direita (ícones de traço 24 px) | todos |
| “1 like” / “1 Trend · 1 Elegant · 1 Creative” em texto | Contagens junto de cada ícone; reações viram pílulas com ícone FAI grande (30 px, variante `glyph-lg`), nome e contagem | todos (reações só no detalhe) |
| Remixar e 3D do look na linha | Menu ⋯ do post (sem mudança nesta entrega) | todos |
| Botão “Gerar modelo 3D” | **Removido** (pedido). Só aparecem os estados de um modelo existente ou de um job iniciado | — |
| Porcentagem do 3D sempre visível | Só quando o provedor informa progresso real; senão barra indeterminada | dono |
| “Ver no manequim 3D” no menu Mais opções | Alternativa da ação principal (texto-link) | dono e visitante |
| “Adicionar ao guarda-roupa” como ação principal do visitante | Alternativa (“ou guarde uma cópia…”); principal = **Experimentar** | visitante |
| Background Studio de peça (4 etapas, anatomias de peça como chips) | Editor da arte do card (6 etapas) no cadastro e em Mais opções › **Editar arte do card**; o Studio é reaproveitado na etapa Fundo artístico; skin e cor do container em Superfície interna; anatomia do selo derivada da família | dono |
| Fundo do estúdio (foto de produto) no painel de layout | Etapa Superfície interna › “Fundo da área da peça” no cadastro; no detalhe, em Editar imagem | dono |
| Reprocessar estúdio trocava a foto aprovada na hora | Vira versão pendente; Editar imagem mostra aprovada × nova com **Aprovar nova foto** / **Descartar**; aviso no detalhe | dono |

## Decisões

1. **Faixas laterais iguais em todas as famílias** (`--pc-x`), topo + base com soma constante (2,9 × `--pc-x`):
   a foto tem a mesma escala em qualquer arte e cards da mesma linha têm a mesma altura. A família só troca a ênfase.
2. **Feed estático**: nenhuma animação no card compacto (o vídeo da arte com IA vira o pôster). Movimento só no
   ampliado, com opção ligada, pausa fora da tela e some com “reduzir movimento”.
3. **Limite de 3 efeitos** (aura e movimento fora da conta), aura ≤ 0,8, efeitos por família; nada ligado por padrão.
4. **Vidro fosco** sem desfoque no compacto (custo de GPU no feed), com desfoque no ampliado.
5. **Blocos genéricos** (tijolos com pinos desenhados em CSS) em vez de textura com marca.
6. **Sem sobrescrita silenciosa**: arte do card com revisão (`baseRev` → 409); foto de estúdio com versão pendente.
   Configs v1 são lidos como v2 e só regravados quando a pessoa aplica.
7. **Visitante não vê a versão pendente**: `Views.pieceMeta` remove `studio.pending` e `studio.previous` para quem não
   pode editar.
8. **Reações**: a variante `glyph-lg` recorta cada ícone FAI no raio do próprio desenho (~84% do disco), então o
   coração e a gravata ficam maiores e todos ficam com o mesmo tamanho visual; os PNGs 32/64 px são gerados por
   `scripts/assets/fai-glyphs.py`.

## Reparo do `main`

Os merges dos PRs #28 e #29 no GitHub perderam código em `app/(app)/pieces/new/page.tsx`,
`components/expanded-card.tsx`, `components/piece-form.tsx`, `lib/pieces/person-filter.ts` e `Taxonomy.java`: o `main`
tinha 27 erros de TypeScript e o backend não compilava (`Taxonomy.keepAllowed`/`normalizeTags` usados e não
definidos). O branch foi refeito a partir do `main` atual com a reconciliação dos dois lados: fluxo de captura do
`main` (tipo antes da foto, critérios de aceite, subtipo por semelhança, busca da marca) + salvar do PR #29 (trava
síncrona, erros por campo, aviso único depois da análise). No formulário ficou a escolha múltipla do PR #29, que mostra
valores fora da lista com “Remover” (a limpeza automática que o merge tinha mantido escondia esses valores).

## Testes

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | sem erros |
| `npx vitest run` | 95 testes, 0 falhas (inclui `lib/piece-art.test.ts`: migração v1→v2, limites, gravação) |
| `node scripts/i18n/check.js --fail` e `scan.js --fail` | ok (pt-BR, en, es) |
| `mvn test` (fai-application, fai-web, platform, ai-providers) | 169 + 17 + 8 + 4, 0 falhas — inclui `StudioVersionsTest` (7), `PieceArtRevisionTest` (4) e `FeedFramingTest` (11, com vestido, saia, jaqueta, blazer, bolsa e relógio) |
| `fai-bootstrap` repackage | não roda offline (plugin do Spring Boot não está no cache local) — limitação do ambiente |

### Verificação no navegador (`scripts/e2e/verify-card-art.mjs`)

| Cenário | Medido |
|---|---|
| 5 camisetas + 5 calças, mesmo template e famílias misturadas, desktop e celular | variação da foto 0 px (largura e altura); faixa lateral 13,06 px (desktop) / 12 px (celular); topo + base 38 / 35 px |
| Mesma peça em 12 famílias/variações | foto 0 px de variação, mesmo arquivo e enquadramento; altura do card 0 px |
| Nomes longos, contagens de 12 mi / 988 mil, sem marca, preço de R$ 1.234.567,89, fotos sem estúdio | 0 estouros; página sem rolagem horizontal |
| Arte decorativa | `aria-hidden`, `pointer-events:none`, 0 focáveis; clique na faixa cai no frame |
| Teclado no detalhe (dono/visitante × desktop/celular) | foco inicial no diálogo; 0 saídas em 40 Tab + 10 Shift+Tab; Esc no menu fecha só o menu; foco volta ao nome |
| Abrir o detalhe | 0 curtidas/salvamentos disparados |
| Curtir com servidor falhando (500) | durante: ativo + `aria-busy`; depois: volta a “não curtido” e 1, com aviso |
| Três toques seguidos em curtir | 1 pedido; contagem +1 |
| Salvar | aviso “Salvo” só depois da resposta |
| axe-core (WCAG 2.0/2.1/2.2 A e AA) na grade | 0 violações (dono e visitante, desktop) |
| Editor: aplicar Bento B, base, vidro fosco, aura + contorno + colagem | 1 PUT com `v:2`, `baseRev:0`, `anatomy:BENTO` |
| Prévia × card salvo depois de recarregar | mesma largura, altura e faixas; 12 elementos internos na mesma posição. Pixel a pixel: ~5,8% dos pixels diferem só em bordas (antisserrilhado do diálogo composto e da reamostragem da foto; diferença média ~4/255) — não é igualdade de pixels |
| Reabrir / cancelar / restaurar / conflito | reabre com Bento B; cancelar = 0 pedidos; restaurar → Clássica no rascunho; conflito → alerta e editor aberto |
| Movimento | feed: 0 animações; detalhe: 20 animações, pausadas fora da tela; 0 com “reduzir movimento”; CLS 0 |
| Foto de estúdio pendente | aviso no detalhe; painel aprovada × nova; aprovar = 1 pedido e o painel some; visitante: sem aviso e sem Mais opções |

Estados (`scripts/e2e/verify-cards.mjs`): 3D processando, 3D com falha, sem 3D, à venda, sem logo/indisponível, sem looks
e foto vestida encoberta — capturas em `docs/anatomias/img/v19/estado-*.jpg`.

## Capturas

Em `docs/anatomias/img/v19/` (todas reais, do app rodando): grades, mesma peça nas famílias, efeitos combinados,
responsivo no celular, feed e detalhe dono/visitante desktop/celular, editor (6 etapas + conflito), aprovação do
estúdio e estados.

## Limitações

- Igualdade de pixels entre prévia e card salvo não foi alcançada (ver acima); a igualdade medida é de layout.
- Templates de vestido, saia, jaqueta, calçado, bolsa e acessório verificados com imagens de catálogo, não com fotos
  reais.
- O fundo do estúdio no detalhe gera versão pendente; não há ainda “voltar para a versão anterior” depois de aprovar
  (o histórico guarda só a referência da versão anterior).
- O selo (RF20/21) segue a zona da anatomia da família; posições novas de selo por família não foram desenhadas.
- O selo “1 Issue” no canto das capturas é o aviso do servidor de desenvolvimento do Next sobre o `nonce` do script de
  tema no layout raiz (diferença entre servidor e cliente). Já existia antes desta entrega e não aparece em produção.
