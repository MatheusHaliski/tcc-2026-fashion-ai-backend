# FLAIR 3D MAKE UP: plano "Meu Rosto, Meu Estúdio"

Plano de 07/11/2026 para o segmento **FLAIR 3D MAKE UP** (antes FLAIR 3D): styling no estilo do DREST em que a pessoa
veste e maquia uma modelo da casa ou **o próprio avatar** com itens do catálogo, num lugar 3D que reage. Além deste
plano, nenhum arquivo muda nesta etapa. Base, nesta pasta: `ESTUDO_DREST.md` (ESTUDO), `REUSO_PROVADOR_E_AVATAR.md`
(REUSO), `IMPLEMENTACAO.md` (IMPL), `JOGOS.md`, `PROTAGONISTA_E_RECURSOS.md` (PROTAGONISTA); fora dela,
`docs/flair/cbc/FLAIR_CBC.md`, `docs/plataforma/APP_NATIVO_UNREAL.md` e `docs/negocio/POLITICA_DE_XP_FAI.md` (POLITICA).

**Legenda.** **[DREST-D/P/C]**: fato do DREST com o nível de evidência do ESTUDO (documentado, imprensa, comunidade),
a seção do ESTUDO e a fonte (S#). **[não confirmado]**: o ESTUDO não achou. **[código]**: afirmação sobre o repositório,
com caminho. **[I]**: proposta nossa (todo número de curva, pontos e prazo é [I]). **[decidir]**: escolha da dona.

## 0. Resumo para a dona

1. O FLAIR 3D MAKE UP vira uma **carreira de beleza**: brief → protagonista → roupa e maquiagem → lugar 3D → nota → nível.
2. O diferencial é **maquiar o próprio avatar em 3D**, com as câmeras de zoom do provador indo até lábios, olhos e mãos.
3. Não há confirmação de que o DREST ofereça avatar próprio, e ele parece mostrar uma foto fixa por pose (ESTUDO §8, [I]).
4. A nota vem de um **juiz por regras** que não recebe tom de pele, rosto nem protagonista; a base nem sai do aparelho.
5. **30 níveis em 6 cargos**; cada nível destrava algo jogável e permanente; nível 3 na 1ª sessão, nível 10 em ~9 dias.
6. A unidade da carreira é o **Prestígio**, não XP, para não criar a carteira de XP separada que a POLITICA §1 proíbe.
7. Lugares que reagem: camarim, provador com amigo virtual, **Desfile de Gala FashionAI** (fictício), tapete e ensaio.
8. Privado por padrão: o rosto fica no aparelho; voto, liga e ranking mostram só a receita em **dublês da casa**.
9. Nada se compra para jogar: sem caixa aleatória, itens de 5 usos ou energia; o erro nunca tira saldo da carteira.
10. No TCC: fases F0 a F3 e níveis 1 a 10 (≈ 17 semanas-pessoa com contingência). Há 12 decisões suas na §11.

## 1. O jogo em uma página

**Ciclo do DREST, como o ESTUDO §2 descreve [DREST-D/P]:** brief → casting da modelo → look (roupa, sapato, bolsa,
joias) → cabelo e maquiagem → locação ou fundo e props → envio → **nota da comunidade** → recompensa → próximo brief.
A cauda "nota → XP → nível → desbloqueios" é **reconstrução** do mapa do ESTUDO §4.1 e inferência (§4.2 [I]). O mesmo
mapa põe uma etapa de **gasto** na montagem (moedas, usos, tickets), que é o que trava o meio do jogo (§4.3, §4.5 [I]).
As supermodelos foram capturadas em estúdio de fotografia 3D [DREST-P] (§8, S23, S51), mas, pelos pedidos de giro, zoom,
poses e expressões [DREST-C] (S2, S6, S8), a exibição parece ser uma imagem fixa por pose [I] (§8): aí entra o FLAIR.

**Ciclo do FLAIR [I]:** a mesma forma, com três mudanças: (a) **sem a etapa de gasto**; (b) a nota imediata vem de um
**juiz por regras**, e a comunidade só pesa no ranking; (c) o lugar é **3D e reage**, e o rosto pode ser o seu.

```
Hub ─► Brief do dia (3) ─► Protagonista: modelo da casa | meu avatar | manequim ─► Penteadeira (paradas de rosto e mãos)
 ▲                                                                                       │
 └─ Carreira (Prestígio, nível, cargo) ◄─ Ranking (dublês) ◄─ Lugar 3D reage ◄─ Entregar ◄─ Guarda-roupa e lugar
```

O hub mostra os 3 próximos desbloqueios, como o perfil com "Level Up rewards" [DREST-D] (§4.3, S3). O brief traz ocasião,
paleta, foco, técnica, luz e o **peso de cada parte** ("maquiagem: 2 de 5 vagas"), com peça obrigatória e bônus
opcionais, como no DREST de 2019 [DREST-P] (§2, S20). A entrega dá estrelas na hora, o lugar reage e vêm Prestígio,
FAI Points (RF41), desbloqueio e a Masterclass do item novo.

## 2. Progressão estilo DREST: a Carreira de Beleza

### 2.1 O que o DREST faz e o que pegamos

- **Não há carreira de maquiagem no DREST:** o ESTUDO não achou XP nem nível próprios de maquiagem (§4.8 [não
  confirmado]); os desafios de beleza seguem o ciclo comum de stylist (S26). Carreira de Beleza e técnicas por nível são
  **propostas nossas [I]**; do DREST vêm o ciclo, os ranks com nome de carreira, desafios por nível e recompensas de nível.
- **Ranks:** "Wardrobe Intern" → "Style Icon" são do **app original (2019–2020)** [DREST-C] (§4.3, S21, S47); "Styling
  Assistant" é citado em 2025 (S41), **em posição desconhecida** [DREST-P]; os intermediários não aparecem.
- **Início rápido:** nível 3 na primeira sessão e desafios novos por nível vêm de **um relato de jornalista sobre o app
  original, 2019** [DREST-P] (§4.2, §4.4, S20); o formato da curva é [C → I] (§4.3). Level Up rewards (2026) [DREST-D]
  (§4.3, S3); 4 ligas e "gift boxes" (2026) [DREST-D] (§4.6, S3).
- **Evitar [I] (ESTUDO §10):** itens de 5 usos com renovação paga [DREST-C] (§5.4, S2, S8), na prática um aluguel [I];
  boosters por tempo [DREST-D] (§5.4, S1); Pro Challenges dão multiplicador a quem usa "finest items" [DREST-D] (§2,
  §4.2, S3), que lemos como risco de pay-to-win [I]; recurso pago que "muda a nota" [DREST-C] (§2, S7).
- **Não é público** (ESTUDO §4.3, §8, §11): XP por estrela e por voto, níveis e XP de cada um, tabela de desbloqueio,
  peso da maquiagem, estrutura do Luxe Pass, aleatoriedade das gift boxes e avatar próprio. A Glossy (2023, S34) cita um
  premium com avatar próprio (§4.5), mas o §8 não confirma que ele tenha existido: o ESTUDO se contradiz [não confirmado].

### 2.2 Prestígio por desafio (o "XP" da carreira) [I]

Fórmula pública, sem termo de gasto, calculada no servidor e explicada com `basis` no resultado:

| Parcela | Valor | Referência idempotente no ledger |
|---|---|---|
| Estrelas do juiz | cada estrela **nova** vale 0,2 × base; base: Fácil 50 · Médio 80 · Difícil 110 · Lendário 150 | `brief:<id>:star:1..5` |
| Condições opcionais | +10 cada, no máximo 2 | `brief:<id>:cond:1..2` |
| Técnica nova | +15 na primeira vez que a técnica cumpre ≥ 50% da regra dela | `tecnica:<código>` |

- Estrelas: nota < 35 = 1★; 35–54 = 2★; 55–69 = 3★; 70–84 = 4★; ≥ 85 = 5★. A comunidade **não** paga Prestígio (§6.3).
- **Repetir é livre, sem energia, e só paga estrelas novas:** de 4★ para 5★ rende a diferença; repetir rende zero.
  Ensaio Livre é ilimitado e rende 0. **Nunca** há Prestígio por gasto, por usar o próprio rosto, por peça real (só o
  selo cosmético "Reuso") ou por voto recebido. Mudança na tabela só vale para frente (POLITICA §5.6).
- Exemplo: brief médio, 4★ e uma condição = 64 + 10 = **74**; os 3 briefs do dia bem feitos ≈ **210**.

### 2.3 Curva e cargos [I]

Prestígio para sair do nível n: **60, 90, 120, 150 e 180** nos níveis 1 a 5 (tutorial, uma técnica por nível, como o
rascunho do ESTUDO §10); do 6 em diante, **round(k · n^1,5) com k = 15** [decidir] (o ESTUDO usa k = 100 numa escala
maior; com k = 60 o topo levaria ~10 meses). Do 16 ao 30 fica 80% do total, por isso **todo nível de 17 a 30 tem
desbloqueio** (§2.4); `scripts/flair-games/career-sim.mjs` confere a curva antes de valer. Dias a ~210 e briefs a ~70:

| Chegar ao nível | 3 | 5 | 10 | 11 | 16 | 21 | 26 | 30 |
|---|---|---|---|---|---|---|---|---|
| Prestígio acumulado | 150 | 420 | 1.842 | 2.316 | 5.847 | 11.588 | 19.874 | 28.532 |
| Dias · briefs | 1ª sessão · 2 | 2 · 6 | 9 · 26 | 11 · 33 | 28 · 84 | 55 · 166 | 95 · 284 | 136 · 408 |

| Cargo | 1 · níveis 1–5 | 2 · 6–10 | 3 · 11–15 | 4 · 16–20 | 5 · 21–25 | 6 · 26–30 |
|---|---|---|---|---|---|---|
| Nome (en e es no i18n) | Estágio de Beleza | Assistência de Make | Artista de Make | Artista de Passarela | Maquiagem-Chefe | Direção de Beleza; **Ícone** no 30 |
| Plateia do Desfile | 24 | 60 | 120 | 200 | 280 | 350 (teto da REUSO §4.2) |

### 2.4 O que cada nível destrava [I]

Tudo é **permanente**. Ficam abertos desde o nível 1 **todos os tons de base e corretivo** (no aparelho) e **todas as
paradas de zoom** de corpo, rosto e mãos (acessibilidade); o nível destrava técnicas, acabamentos, lugares, câmeras
**de cena** e tipos de desafio. Cada desbloqueio abre uma **Masterclass** (brief Fácil que ensina o item) e o botão
"Experimentar agora", que leva à Penteadeira. Entre parênteses, a fase que constrói o item (§9).

| Nív. | Destrava | Nív. | Destrava |
|---|---|---|---|
| 1 | Penteadeira e Ensaio Livre; modelo da casa ou meu avatar; batom, gloss; Matte, Satin, Gloss; Camarim; Beauty Shoot (F1–F2) | 16 | duocromo; salvar "meu look de rosto" como look pronto (F5) |
| 2 | blush (F1) | 17 | Ensaio Editorial; câmera do fotógrafo (F6) |
| 3 | sombra de 1 cor; Provador com amigo; Impressionar o Amigo (F2) | 18 | brinco, colar e óculos pontuam (âncoras `Head`/`Neck` existentes) (F5) |
| 4 | delineado `PADRAO`, `ALTO`, `GATINHO` (F1) | 19 | anel, pulseira, relógio (âncoras novas de pulso e dedo, REUSO §2.5) (F5) |
| 5 | sobrancelha; **Desfile de Gala** e câmera de plateia; look pronto "clean" (F3) | 20 | 3 poses na ponta da passarela; Narrativa de temporada (F5) |
| 6 | iluminador; Dewy e Shimmer (aproximados no MVP) (F2) | 21 | Backstage com a equipe (F6) |
| 7 | sombra de 2 cores `ESFUMADO`, `CUT_CREASE` (F2) | 22 | duas modelos da casa e dois amigos virtuais extras (F5) |
| 8 | Metálico; segunda variação de luz por lugar (F3) | 23 | paleta de edição com 6 tons exclusivos (F5) |
| 9 | lápis de boca `LABIO_DEGRADE` (F2) | 24 | "travelling" no roteiro de câmera (F6) |
| 10 | Velvet; **liga semanal**; look pronto "glam" (F4) | 25 | **brief para amigos**, com seletores fechados (F6) |
| 11 | Tapete de Estreia; contra-plongée (F5) | 26 | plateia máxima e bis com confete (sem confete com movimento reduzido) (F5) |
| 12 | máscara e cílios (F5) | 27 | looks prontos assinados "creative" (F5) |
| 13 | esmalte (F5) | 28 | **Brief de Direção** para a comunidade, com revisão (F6) |
| 14 | contorno e bronzer, relativos à pele (F5) | 29 | moldura "Direção" e fundo exclusivo do Álbum (F5) |
| 15 | glitter e arte facial; brief **Beleza de Estrela** com Lina Vale (F5) | 30 | título Ícone; Masterclass final; obra "Carreira" no perfil (F5) |

### 2.5 Ritmo sem vício [I]

- **Diário:** 3 briefs novos; cada um fica jogável por **7 dias**, para quem falta não perder nada; sem energia nem
  streak punitivo. O DREST tem meta de 10 looks por dia [DREST-C] (§4.6, S2). O ECA Digital pede limites a recursos de
  uso excessivo segundo **notícias** [P] (ESTUDO §10, S48, S49; o texto da lei, S50, não foi lido).
- **Semanal (nível 10):** liga pela **soma das 5 melhores notas do juiz**: determinística, cega ao tom, imune a voto
  combinado e sem exigir jogo diário. Divisões Ateliê, Backstage, Front Row e Capa; sobem os 30% de cima; **sem
  rebaixamento** em Ateliê e Backstage e **nunca para 13–17**; cada divisão só abre com ≥ 10 pessoas (antes, Liga
  Aberta). O DREST trouxe gift boxes junto com as 4 ligas em 2026 (S3); não se sabe se estão ligadas ao fim da liga
  nem se são aleatórias (§4.1 reconstruído; §11). A nossa recompensa é cosmética e mostrada antes (§6.4).
- **Temporada de 4 semanas** pelo calendário (Momentos do FashionAI, Fashion Week, Carnaval): **trilha única e
  gratuita** de 10 marcos. O **Arquivo de Temporadas** devolve os itens um ano depois (menos FOMO). O DREST vende passes
  **por evento**, Luxe Pass a US$ 3,99 e Luxe Plus a US$ 6,99 [DREST-D] (S4, S5), de estrutura não pública (§4.7, §11).
- **Menores:** lembrete de pausa após 45 min; sem notificação entre 22 h e 8 h; o responsável pode limitar o tempo (P9).

### 2.6 FAI XP, FAI Points e travas [I]

- **FAI XP não muda** (POLITICA §1). O Prestígio é um **rank de segmento**, como o `rankPoints` dos duelos
  (`FlairService.java`, `V18__flair.sql`) **[código]**: não se gasta, não se converte e não aparece como XP. Como a
  POLITICA §1 proíbe carteira de XP separada e a §6 manda mudar política e matrizes juntas, **antes da F4** entra uma
  emenda à POLITICA §1 e §6 e ao RF41 [decidir].
- **FAI Points:** ação nova `FLAIR_MAKEUP_BRIEF` no RF41: **10 pontos** por brief do dia com ≥ 2★, `once_per_ref` pelo
  brief, teto **3/dia e 15/semana**, não sacável. Só com briefs, Studio (300) chega em ~2 semanas e Loft (900) em ~6;
  com o "desafio concluído" de 30–200 (POLITICA §3) seriam 2 a 10 dias. Subir de nível não paga FAI Points (seria pagar
  duas vezes a mesma ação, POLITICA §3). O voto usa a regra atual de voto (2, até 5/dia) se o RF41 aceitar o look como
  referência [decidir]. Os capítulos seguem com `FLAIR_3D` e `FLAIR_3D_PERFECT` (`V98__flair_3d_jogos.sql`) **[código]**.
- **Três portões:** (1) `Flair3dAccess.require` segue travando os 5 capítulos por nível FAI e guarda-roupa (403
  `FAI_LEVEL_REQUIRED`, `WARDROBE_LEVEL_REQUIRED`, valores da V98) **[código]**; (2) o nível de carreira trava só briefs,
  lugares e técnicas novos (403 `CAREER_LEVEL_REQUIRED`, com nível exigido e atual); (3) item não destravado dá 403
  `MAKEUP_LOCKED`. Nos capítulos a carreira é só "recomendada": **nada aberto hoje fica travado**. Códigos com i18n nas
  3 línguas; `Flair3dAccess` ganha caracterização antes de mudar.

### 2.7 De onde vêm os briefs [I]

Nada de migração diária: `flair_makeup_briefs` guarda a agenda, e `MakeupBriefScheduler` gera os 3 do dia por **semente
da data**, sem IA, a partir de **60 modelos parametrizados** (ocasião × paleta × foco × técnica × lugar × luz) em
`scripts/flair-games/data/make-up/briefs.json`: mais de 1.000 combinações. O mesmo modelo não volta em 21 dias; a mesma
paleta no mesmo modelo, em 90; em semana de Momento ou temporada, 1 dos 3 é do tema. O brief é gravado na primeira
leitura (semente, parâmetros, `minLevel`) e só pede o que o `minLevel` já destravou.

## 3. Catálogo: roupas, acessórios e maquiagem

### 3.1 Árvore de categorias e origem [I]

Hoje **57 das 80 subcategorias** têm molde em `kindOf` e vestem o corpo 3D (19 de cima, 14 de baixo, 5 inteiras, 19
calçados); **as 23 de acessório não** (`garments.ts`, `taxonomy.json`) **[código]**. Contar os **produtos** por
subcategoria é a primeira tarefa da F0. Peças `PREVIEW_2D` (`TryOnSessionService.java`) são só prévia e não contam.

| Nó | Itens (proposta) | Origem |
|---|---|---|
| Roupas SUP · INF · VES · CAL | as 57 subcategorias vestíveis | **abertas**, como o acervo do DREST, limitado por preço e usos, não por nível [I] (§4.4); kit "Básicos" de 60 peças sem logo (12 SUP, 10 INF, 6 VES, 8 CAL e o resto neutro) e as peças de `default-outfit.ts` |
| Acessórios: brinco, colar, óculos | âncoras usadas hoje (`Head`, `Neck`, `glasses-3d.ts`) | abertos; pontuam a partir do nível 18 |
| Acessórios: anel, pulseira, relógio · bolsa | âncoras novas · `kindOf` = `null` | nível 19 · fora do TCC (spike na F5 com `placeInHand`, `holds.ts`) |
| Pele: base, corretivo · contorno, bronzer | 60 tons FashionAI Beauty (L* 15–90 × 3 subtons) · tom relativo à pele | **todos grátis no nível 1**, só no aparelho, nunca pontuam · nível 14 |
| Bochechas: blush, iluminador | 12 + 6 tons | níveis 2 e 6 |
| Olhos: sombra 1 e 2 cores, delineado, máscara | 30 tons; 6 cores × 3 estilos; 4 máscaras | níveis 3, 7, 4 e 12 |
| Sobrancelhas · Lábios (batom, gloss, lápis) · Unhas | 8 · 24 + 8 + 10 · 24 esmaltes | nível 5 · níveis 1 e 9 · nível 13 |
| Arte facial e glitter · looks prontos (glam, edgy, clean, creative) | 6 · 12 (3 por estética) | nível 15 · níveis 5, 10, 27 e conquista |
| Lugar: fundos, props, poses | 3 por lugar | nível, liga e temporada |
| Cabelo | cor e acessórios sobre `hair-strands.ts` | **fora do MVP** [decidir]; se entrar, a textura natural nunca pontua, só o produto ou penteado |

### 3.2 Posse e o que é pago [I]

| Origem | Exemplos | Quem paga | Posse |
|---|---|---|---|
| Grátis | roupas vestíveis, "Básicos", base e corretivo, batom e gloss iniciais | ninguém | permanente |
| Nível · conquista | técnicas, paletas, lugares · marcos de temporada, liga, desafio de marca | ninguém (no desafio de marca, a marca, B2B, pós-TCC) | permanente, mesmo depois do evento |
| Empréstimo | a peça ou o produto obrigatório do brief | ninguém | só naquele brief, sem renovação paga |
| FAI Points (loja) | só cosméticos que não pontuam (molduras, fundos do Álbum) | pontos ganhos jogando | permanente |
| Dinheiro real | **nada no TCC**; depois, só cosmético [decidir] | — | — |

**Nunca à venda:** item que pontua, nota, usos, energia, pacote aleatório; FLAIR Coins não entram no MAKE UP; no TCC só
há moeda fictícia ganha jogando (ESTUDO §10). **Roupa real não dá vantagem:** todo brief tem solução perfeita com o kit,
as destravas do `minLevel` e o empréstimo, e um teste de CI procura essa solução (§8.4); a peça real só dá o selo
"Reuso". **Link de compra** rotulado como publicidade (CDC art. 36, CONAR; validar com o jurídico), escondido para
13–17 por padrão [decidir], afiliado só depois do TCC.

### 3.3 Navegação e tons de marcas

- Busca, ordenação, filtros (categoria, cor, marca, região do rosto, acabamento, subtom), favoritos, usadas e não usadas,
  "ordenar pelo requisito" e o meu closet no meio do desafio. Jogadores do DREST pedem busca avançada, ordenação, filtro
  por atributo, os favoritos de volta e separar usadas e não usadas [DREST-C], embora o DREST tenha busca (2019) e
  filtros (2.0) (§5.1, §5.2, S3, S20, S45).
- **Tom = variante** em `catalog_shades` (IMPL §3); a taxonomia hoje **não tem beleza** **[código]**. No TCC só existe a
  marca fictícia **FashionAI Beauty**; marcas reais depois, por feed licenciado, sem raspagem nem logotipo sem licença.
- **Desafio de marca:** no DREST fica aberto por tempo limitado, e em 2021 quem jogava ganhava um produto digital para
  usar depois [DREST-P] (§6.4, S53). A posse permanente é regra nossa [I]: cláusula de uso perpétuo no contrato, ou troca
  pelo tom FashionAI Beauty equivalente ao fim da licença, com aviso [decidir]. Para 13–17, sem contagem regressiva.

## 4. Maquiagem no próprio avatar

### 4.1 Protagonista e fluxo

| | Modelo da casa | Meu avatar | Manequim |
|---|---|---|---|
| Origem | 6 modelos fictícias, Monk 1 a 10, corpos e gêneros variados, rosto de `paintFace` (`lib/heist/looks-face.ts:19`) **[código]**; Lina Vale | identidade versionada, `GET /api/me/avatar3d/canonical` **[código]** | `components/three/mannequin.tsx` **[código]** |
| Requisito · nota | nenhum · igual | avatar aprovado e consentimento (P1) · igual (E5) | nenhum · igual nas vagas que existem |
| Onde aparece | perfil e voto | **só no aparelho**; no voto, a receita nas dublês | perfil e voto |

- **Sem avatar:** "Criar meu avatar" abre o fluxo atual (`components/avatar3d/my-avatar.tsx`) e volta ao brief com o
  rascunho salvo. **Hoje o avatar real só entra com a Impersonation, no Loft** (900 FAI Points,
  `FaiPointsService.Level.LOFT`; `JOGOS.md`; REUSO §5.4) **[código]**. Proposta: meu avatar na **Penteadeira e nos
  briefs** desde o nível 1 (ESTREIA), Impersonation dos capítulos no Loft [decidir]; depois, atualizar os dois documentos.
- **O +2 da Impersonation** (`Flair3dEffects.DEFAULT_BONUS`) **[código]** não vale em nada do MAKE UP (vaga de
  maquiagem, brief, Prestígio, liga, ranking); nos capítulos fica só nas vagas de roupa, como hoje [decidir se sai].

### 4.2 Câmeras de zoom do rosto e das mãos

As paradas vão hoje da gola ao calçado (`STOP_KEYS`, `lib/scene3d/detail-camera.ts`), e o teste exige essa lista exata
**[código]**: rosto e mãos entram como **família nova**, presa a marcos e ossos, para valer no Unreal (REUSO §1.6–1.7).
Paradas e âncoras **[código]**, a 0,16–0,22 m [I]: testa e zona T (oval via `landmarksOn`, `human/compose.ts`);
sobrancelhas (`BROW_LINES`, `identity/brows.ts`); olhos (`EYES`, `lib/avatar3d/iris.ts:27`, com botão "fechar os
olhos"); bochechas (marcos 50 e 280); lábios (marcos 13, 14, 61, 291, `components/heist/people/mouth.ts`); orelha e
pescoço (ossos `Head` e `Neck`, `heist/people/jewelry.ts`, `accessories.ts`); mãos (`group === 5` e `FINGERS`,
`human/locomotion-model.ts`). Modos `rosto` e `maos` em `fitting-detail-controls.tsx`, de 0,12 a 1,2 m (REUSO §1.3).
**Tocar em "Lábios" leva a câmera aos lábios**; roda e pinça por `wheel-intent.ts`; teclado por chips e controles
deslizantes; com "reduzir movimento", corte. `FittingCameraApi` (`lib/scene3d/orbit-steps.ts`) **[código]** não muda.

### 4.3 Camadas e o que vai ao servidor

Pilha de camadas no UV canônico do MediaPipe, igual para qualquer rosto (IMPL §1.2–1.3). Não há pincel livre [I]; no
DREST tudo indica que também não há, mas o ESTUDO não confirma (§6.3, §11) [não confirmado].

- **Camadas de produto** `{variantId, region, opacity, placement}` (`placement` em lista fechada): iluminador, blush,
  sombra, delineado, máscara, sobrancelha, lápis, batom, gloss, glitter, esmalte. **Vão ao servidor e pontuam.**
- **Relativas à pele** (contorno, bronzer): o tom é resolvido no aparelho; vão só `{tecnica, placement, intensidade}`,
  **sem `variantId`**, e pontuam só pela técnica (R6).
- **Só do aparelho** (base, corretivo, camada 0 do batom da foto): **nunca** entram no payload, em `layers_json` nem no
  voto; o servidor recusa essas regiões (400 `MAKEUP_SKIN_LAYER`). O `variantId` de uma base liga a Lab e a profundidade
  Monk em `catalog_shades` e deixaria inferir o tom de pele, que pode revelar origem racial (LGPD art. 5º, II).
- **Dois caminhos**, com precedente em épocas diferentes do DREST: em 2020, produto a produto ou look pronto de edição
  limitada [DREST-P] (§6.1, S54, S55); no 2.0, looks por estética (glam, edgy, clean, creative), com presets pagos
  [DREST-D/C] (§6.1, §6.4, S5, S10). Aqui o look pronto usa só itens que a pessoa tem e vira camadas editáveis.
- **MVP (F1–F2):** **Canvas 2D** sobre uma cópia do atlas, entregue pela prop `atlas` que o `HumanAvatar` já tem;
  `bakeSkin` faz o warp, como no Heist (`template-builder.tsx`) **[código]**. Prévia instantânea no busto, re-bake no
  corpo ao soltar o controle, **zero linhas** nos congelados `human-avatar.tsx` (295) e `three-human.ts` (333); gloss e
  shimmer aproximados por brilho pintado. **F5, na GPU** (IMPL §1.2, §1.5): `face-warp.ts` sai de `bakeSkin`
  (`skin-bake.ts:184–205`, não congelado) com caracterização; `face-material.ts` pede extrair antes
  `installEarScattering` de `three-human.ts`; ligar a camada em `human-avatar.tsx` pede extrair antes.

### 4.4 Ferramentas do próprio rosto [I]

- **Antes e depois** com divisor; **três luzes** (`LightMode` de `lib/tryon/fitting-room.ts` **[código]**) com o aviso
  "o tom virtual não é igual ao real" (ESTUDO §10).
- **"Meu tom" de base:** menor ΔE00 até a pele medida, subtom por `undertoneOf` (`lib/avatar3d/skin-tone.ts`)
  **[código]**; calculado no aparelho, só informativo, nunca enviado nem usado para recomendar compra.
- **Rosto fotografado:** camada 0 neutraliza o lábio que `lipProtection` preserva (`skin-bake.ts`) **[código]**; chave
  opcional "neutralizar olhos"; chave "tirar óculos" (`glasses-3d.ts`); máscaras que respeitam a barba; "fechar os
  olhos" por morphs dos marcos (`face-expressions.ts`, IMPL §5.2). Revisão visual nos 10 tons Monk.
- **Meu look de rosto:** a receita (sem camadas de pele) reaplicável no provador, nos capítulos e em outros briefs.

### 4.5 Privacidade [I]

O rosto é dado biométrico, sensível (LGPD arts. 5º, II, 11 e 14), e o público começa aos 13.

- **P1** "Usar meu avatar no FLAIR 3D MAKE UP" é uma chave separada e revogável que diz o que roda no aparelho e o que
  vai ao servidor. **P2** O rosto **já está no servidor**: `model_json` guarda forma e pele, e o atlas fica em
  `restricted/` (`V25__avatar_3d.sql`) **[código]**; o cliente os baixa. O MAKE UP **não cria dado biométrico novo no
  servidor**: composição, "meu tom" e imagens com o rosto ficam no aparelho. **P3** O servidor vê só a receita de
  produto (§4.3); campo desconhecido = 400. **P4** Logs só por `identityLogPayload` (`identity/privacy.ts`) **[código]**,
  com teste espelho em Java.
- **P5 Público só pela dublê.** **Hoje o avatar não é privado por padrão:** `public_on_runway` nasce `TRUE`
  (`V25__avatar_3d.sql:13`, `UserAvatar3d.java:56`, `my-avatar.tsx:215`) e `Avatar3dService` não confere idade
  **[código]**. O MAKE UP não herda esse campo: a visibilidade sai só de `flair_makeup_looks.visibility`. Pré-requisito
  [decidir]: padrão `FALSE` para 13–17 e idade desconhecida, por migração **nova** (sem editar a V25) e por regra em
  `Avatar3dService` (congelado em 600: extrair antes).
- **P6 Idade no servidor** por `birth_date_ciphertext` (`User.java`) **[código]**; a data é opcional (V2 aceita nulo,
  `RegistrationFormChain` aceita vazio), então **data ausente ou inválida conta como 13–17** para visibilidade, cupom,
  prêmio e link. A idade é autodeclarada: o RIPD registra isso e como subir a garantia (ECA Digital, [P] S48, S49).
- **P7 Álbum do Estúdio só no aparelho** (IndexedDB), sem backend no TCC; adulto exporta com marca d'água e sem EXIF;
  13–17 não exportam nem compartilham o próprio rosto; não há `PUBLIC_OWN` no TCC. **P8** Revogar apaga os looks
  `AVATAR` no servidor e o Álbum no aparelho (nos outros aparelhos, ao abrir o app).
- **P9 Responsável:** não achamos mecanismo no backend (busca por `guardian` e `parental`). Proposta: conta do
  responsável vinculada, que aprova o uso do avatar no MAKE UP por 13–17, revoga e limita o tempo [decidir se é
  obrigatório]. **RIPD** (LGPD art. 38) é entregável da F1. **P10** Sem câmera ao vivo, foto alheia, try-on na nuvem
  (IMPL §2) ou mistura de identidades (PROTAGONISTA §1.1).

### 4.6 Justiça: a nota nunca depende da pele nem do rosto [I]

- **E1** `MakeupLook` e `MakeupBrief` não têm pele, rosto ou protagonista; `MakeupJudgeInvarianceTest` confere por
  reflexão que nenhum método público do juiz os recebe. **E2** Tom e acabamento de base e corretivo nunca chegam ao
  servidor; contorno e bronzer pontuam só pela técnica. Isso substitui R4 e R6 da IMPL §4.2, que liam a pele.
- **E3** O mesmo `submit` com `AVATAR`, `HOUSE:<id>` ou `MANNEQUIN` dá a mesma nota, tier e falas; com camada de pele é
  recusado; a mesma receita renderizada nos 10 tons Monk dá a mesma nota. **E3b** Votos simulados, com viés por
  distância de tom, não se correlacionam com o tom do jogador quando o voto usa 3 dublês (§6.3); em produção, métrica da
  média por tipo de protagonista e por dublê.
- **E4** Juiz, amigo e plateia falam da escolha ("o batom conversa com a bolsa"), nunca do rosto. **E5** O próprio
  rosto não rende nota, Prestígio nem FAI Points. **E6** Tons de L* 15 a 90; "meu tom" acha base a ΔE00 ≤ 3 em cada tom
  Monk. **E7** Sem "nota de beleza"; maquiagem opcional e para qualquer gênero; brief sem maquiagem segue valendo.
- **E8 Cor acessível:** cada tom com nome e família em texto; antes de entregar, um indicador "eco", "análoga",
  "complementar" ou "choque", com ícone e texto, por acento; testes com simulação de daltonismo.

## 5. Tipos de desafio e cenários 3D com reações

### 5.1 Tipos [I]

| Tipo | Lugar | O que se monta | Peso da maquiagem | Base no DREST |
|---|---|---|---|---|
| Beauty Shoot · Masterclass | Camarim · o do item | rosto (e unhas na F5) · o item novo | 100% | Beauty Mode [DREST-P] (§4.8, S26) |
| Impressionar o Amigo | Provador | look leve e maquiagem pelo DNA do amigo | 2 de 4 vagas | — (pedido da dona) |
| Desfile de Gala · Tapete de Estreia | Passarela · Tapete | roupa, acessórios e maquiagem | 2 de 6 · 2 de 7 vagas | photoshoot e red carpet [DREST-D/P] (§2, S1, S18) |
| Beleza de Estrela | Camarim | maquiar Lina para 3 eventos, com o DNA dela | 3 de 8 vagas | supermodelos [DREST-P] (§1, S22) |
| Desafio de Marca · Narrativa | varia | seleção curada · série de 3 a 5 briefs | conforme o brief | Quests [DREST-P] (§4.7, §5.1, S38) |
| Ensaio Livre | Camarim | o que quiser, sem nota | — | — |

"Beleza de Estrela" é tipo de brief novo e **não** se confunde com o capítulo 31 "Prova com a Estrela", aberto como hoje.

### 5.2 Lugares e quem reage [I]

Faixas: CONTIDA (< 0,35) → CALOROSA (0,35–0,7) → OVAÇÃO (> 0,7) → BIS (montagem perfeita).

| Lugar | Reuso **[código]** | Reação nas 4 faixas | Fase |
|---|---|---|---|
| Camarim | cabine de `components/three/fitting-cabin.tsx` (congelado em 320: extrair o espelho antes) | lâmpadas acendem 1/3 → 2/3 → todas → todas pulsando suave; Lina no capítulo 31 | F2 |
| Provador com amigo | cabine e `HumanAvatar` com rosto de `paintFace` | aceno contido → sorriso e "combinou" → "uau" e palmas → pede uma foto | F2 |
| Desfile de Gala | `components/three/runway-scene.tsx` (plateia instanciada) | palmas esparsas → educadas → fortes, `cheer`, de pé, flashes → bis | F3 |
| Tapete de Estreia | passarela, fotógrafos e fãs (`lib/heist/level-people.ts`) | poucos cliques → `photo` → flashes ≤ 3/s → fãs chamam o nome | F5 |
| Ensaio Editorial · Backstage | estúdio de foto; clones de `components/heist/people/people.tsx` | fotógrafa: "ok" → "mais uma!" → "capa!"; equipe aplaude | F6 |

**Invariante:** a faixa baixa é **sempre contida e nunca humilhante** (sem vaia, riso ou gente saindo). Toda reação
também aparece em `aria-live`, legenda e medidor; o som começa desligado (`lib/sensory.ts`) e os flashes seguem
`reduceFlashes` (`components/heist/settings.ts`, ≤ 3/s, WCAG 2.3.1) **[código]**.

### 5.3 Contrato da reação, amigos e cenário dinâmico [I]

- `check` (sem escrita) e `submit` devolvem o record `reaction {venue, type, s, tier, perfect, parts{look, makeup},
  seed, table, cues[]}`. `seed` sai do id da entrega (replay e foto de herói repetem a reação); `cues` são **ids de
  regra**, nunca traço de rosto; `table` versiona `reaction-tables.json`, comum ao web e ao Unreal (REUSO §4.4), com
  teste de paridade Java × TS. `lib/venue3d/reactions.ts` é puro (nota, semente, agentes → `{gesto, intensidade,
  atraso, duração}`), com histerese (REUSO §4.2), e **não recebe quem é a protagonista**.
- **Plateia em 3 camadas** (REUSO §4.2): silhuetas instanciadas, 4 a 8 clones com o gesto `clap` novo (o braço de
  palmas só existe na dança, `locomotion-dance-moves.ts` **[código]**) e o amigo como único humano completo.
- **Amigos virtuais:** 4 amigos fictícios de gêneros variados, cada um com DNA como o de Lina (estilos, cores,
  acabamentos preferidos e evitados), mostrado no brief e convertido no `makeupBrief`; a pessoa escolhe quem a
  acompanha (2 no nível 3, mais 2 no 22). Máquina de estados `observa → micro → veredito → sugere` (IMPL §5.2), falas
  pelos `cues`.
- **Lugar dinâmico:** 2–3 variações de luz e fundo, props e pose na ponta. A luz **escreve parte do brief**, à vista,
  e só mexe em R3 e R5: `FLASH` evita Shimmer na zona T, `DOURADA` prefere Shimmer no malar, `PASSARELA_FRIA` sobe a
  intensidade mínima; props e fundo não pontuam. Na montagem, murmúrios e micro-reações pela nota parcial do `check`
  (debounce de 600 ms, cota de 30/min e 300 por brief, senão 429 `MAKEUP_CHECK_QUOTA`); a prévia nunca decide.
- **Câmera roteirizada** (`lib/venue3d/camera-profiles.ts`): geral → travelling → a modelo para na ponta → **close no
  rosto** → corte para a plateia no pico (IMPL §5.1). Qualquer gesto pausa, "voltar ao roteiro" retoma; com movimento
  reduzido, as tomadas viram cortes.

### 5.4 Política de conteúdo [I]

- O desfile do exemplo da dona vira **Desfile de Gala FashionAI**, sem a marca real (Victoria's Secret) nem o visual
  "Angel" (LPI e direito de imagem, ESTUDO §10, validar com o jurídico).
- **Lingerie e roupa de banho** (bralette, corset, bodysuit, uso `SWIM_SURF` da taxonomia) ficam **fora dos briefs do
  MAKE UP** [decidir se entram para adultos; nunca no avatar de 13–17 nem no voto]. Revisão ClassInd por tipo de brief.
- **Brief para amigos e Brief de Direção** só com seletores fechados (ocasião, paleta, foco, técnica, lugar), sem texto
  livre, com denúncia e revisão antes de publicar.

## 6. Julgamento e recompensas

### 6.1 O juiz sem pele (`MakeupJudge`, 100 pontos) [I]

| Regra | Pts | Como medir, só com dados do produto |
|---|---|---|
| R1 Tema | 20 | tags dos produtos ∩ `tags.want`, menos `tags.avoid` |
| R2 Paleta | 25 | cada acento (lábios, olhos, blush, unhas) contra a roupa e a paleta: eco (ΔE00 ≤ 12), análoga, complementar (se aceita) ou neutra; choque desconta. Família de cor por `CbcRules.colorHarmony` (público, `CbcRules.java:299`), depois de levar o tom ao nome da taxonomia com `ColorMath.nearestTaxonomyColor` (`ColorMath.java:68`) **[código]**; `harmonious` não serve (mistura marca e estilo e é de pacote) |
| R3 Intensidade | 15 | Σ peso da região × opacidade × (C*/60 + fator do acabamento), só camadas de produto, na faixa do brief |
| R4 Ponto focal | 10 | a região de maior peso visual do produto é o `focus` pedido |
| R5 Acabamento | 10 | preferidos somam, evitados descontam; só camadas de produto |
| R6 Técnica | 10 | `placement` igual ao pedido (`GATINHO`, `ESFUMADO`, `LABIO_DEGRADE`, contorno `MALAR_ALTO`…) |
| R7 Unhas e detalhes | 10 | esmalte em eco com acessório ou batom; metálico com metal |

ΔE00: extrair `LensSimilarity.deltaE00` (congelado em 259) **[código]** para `ColorDifference`, validado com os 34 pares
de Sharma; `ColorMath.deltaE` (CIE76) e `CbcRules.java` (congelado em 517) não mudam. Resposta: `{score, stars,
parts[{rule, points, basis}], tier, perfect, cues[], reaction}`; o servidor recalcula e ignora nota do cliente.

### 6.2 Perfeito, erros e travas [I]

- **Brief perfeito:** 5★ **e** cada regra pedida com ≥ 50% do seu peso (por regra, não por soma).
- **Capítulos:** a sintonia da vaga de maquiagem (≥ 80 = 3, ≥ 60 = 2, ≥ 35 = 1) entra em `Flair3dPenalties.score`, mas
  **fora** da soma de `Flair3dHype.perfect`, que compara a soma (`sintonia ≥ 2 × vagas obrigatórias`,
  `Flair3dHype.java:115`) **[código]**: uma maquiagem forte não esconde carta fraca. Com caracterização antes.
- **Variante desconhecida:** `REFUSED` −2, que também **bloqueia a entrega** (Javadoc de `Flair3dPenalties`) **[código]**.
  Item não destravado: 403 `MAKEUP_LOCKED` antes da nota. O erro custa vaga, placar e perfeito, **nunca saldo**.

### 6.3 A comunidade, sempre nas dublês [I]

- **Três dublês lado a lado** (Monk claro, médio e profundo), com a mesma receita e a pele e a base padrão de cada
  uma; quem vota dá **uma** nota de 1★ a 5★ e, se quiser, uma reação da lista fixa `REACTIONS`
  (`ChallengeService.java:100`), que **não** vira estrela. Quem escolheu tons para a própria pele não perde para quem
  coincide com uma dublê. Alternativa: anunciar a dublê no brief antes de montar [decidir].
- **O voto só pesa no ranking** ("Looks do Dia"): 0,6 juiz + 0,4 comunidade, bayesiano, peso por conta limitado, voto de
  amigo com peso 0,5. **Abaixo de 20 votos, a parte da comunidade usa a nota do juiz**, sem votos fictícios, com o aviso
  "poucos votos". Prestígio e liga vêm só do juiz. Às cegas por 6 h [decidir]; reenviar não reabre o voto (no DREST,
  reenviar mudou a nota [DREST-C], §2, S7).
- O voto às cegas de hoje é o de `VOTED = {RUNWAY_BATTLE, GRWM}` (`ChallengeService.java:107`; `vote()` em `:1381`
  recusa os outros com 409 `VOTACAO_FECHADA`), um voto por batalha, sem estrelas **[código]**: o MAKE UP ganha tabela e
  repositório próprios (§8.2) e reusa só `REACTIONS` e a regra de não votar no próprio look.

### 6.4 Recompensas [I]

| Quando | O que | Valor |
|---|---|---|
| Brief do dia (≥ 2★) · brief | FAI Points `FLAIR_MAKEUP_BRIEF` · Prestígio (§2.2) | 10 pts, 3/dia, 15/semana, não sacável · de 10 a 185 |
| Brief perfeito | carta cosmética "Rosto Perfeito", entregue idempotente como em `Flair3dRewards` **[código]** | 1 por brief |
| Cada nível · mudança de cargo | desbloqueio (§2.4) e Masterclass · moldura do cargo e plateia maior (§2.3) | sem FAI Points |
| Liga semanal | Ateliê: adesivo · Backstage: fundo do Álbum · Front Row: moldura da semana · Capa: look na dublê no hub (13–17: só apelido) | determinística, lista visível antes |
| Temporada (Prestígio dela) | 100 fundo · 250 paleta de 3 tons · 450 pose · 700 moldura · 1.000 look assinado · 1.350 prop · 1.750 tom de edição · 2.200 fundo animado sem flash · 2.700 selo · 3.200 **Obra da Temporada** | grátis; ~210/dia chega ao fim em 16 dias, ~70/dia ao marco 7 |
| Obra da Temporada | arte numerada pela ordem de conclusão, **sem teto de edição** (como a obra "N de M" do CBC, `FLAIR_CBC.md` §4); pública na dublê; com meu rosto, só no Álbum | sem escassez |
| Desafio de marca (pós-TCC) | cupom por `FlairCombination` (`FLAIR_CBC.md` §4) **só 18+ ou com responsável, escondido para 13–17** [decidir]; produto real por mérito, sem sorteio | — |

- **Prêmio real:** o DREST limita concursos e alguns prêmios a maiores de 18, e os termos se contradizem (ESTUDO §4.7,
  §9, S15, S41); permitir prêmio físico a menores com consentimento do responsável [I] [decidir] vai além desse
  precedente. Concurso só cultural dispensa autorização (Lei 5.768/1971, **validar com o jurídico**); desafio patrocinado
  com prêmio da marca pode ser promoção comercial e pedir autorização [validar com o jurídico].
- **Nunca:** pacote aleatório, gift box surpresa, moeda paga ou nota comprada (loot box para menores é proibida pelo ECA
  Digital, segundo notícias [P] S48, S49).

## 7. Como os 5 jogos atuais entram [I]

Os capítulos viram o **modo História**: mantêm slug, pontos, vagas, recompensas e travas da V98, rendem Prestígio desde a
F4 e **nunca** são exigidos para subir de cargo (a carreira não depende de guarda-roupa ORGANIZADO, CLOSET_INTELIGENTE
nem do Loft). A vaga de maquiagem é **opcional** (vencer não fica mais difícil) e é julgada pelo módulo irmão
`flair/makeup`, sem forçar itens de catálogo no motor de cartas de `FlairGameService`. Prestígio do capítulo: vitória =
3 estrelas (0,6 × base da dificuldade), perfeito = 5 (refs `capitulo:<slug>:star:k`).

| Jogo (trava V98 **[código]**) | Vaga de maquiagem | Mecânica | Prestígio vitória · perfeito | Dados |
|---|---|---|---|---|
| 1 Espelho Partido (STUDIO · ORGANIZADO) | 1: "caco do rosto", lábios ou olhos em eco com a paleta do caco | cartas + vaga julgada | 48 · 80 | `makeupBrief` por delta |
| 31 Prova com a Estrela (STUDIO · VERSATIL) | 3: sóbria na coletiva, olhos na estreia, livre no after | cartas + vagas | 66 · 110 | idem |
| 43 Rooftop (ESTREIA · ORGANIZADO) | 1: Shimmer rende na luz dourada, Gloss à noite | cartas + vaga | 48 · 80 | idem |
| 70 Cinco Clientes (LOFT · CLOSET_INTELIGENTE) | nenhuma no TCC (11 cartas já ocupam a tela) [decidir] | cartas | 90 · 150 | nenhuma |
| 96 Chefe: Vellard (LOFT · CLOSET_INTELIGENTE) | 1: Matte anula o flash cegante de Vellard | cartas + vaga | 90 · 150 | idem |
| Roubo ao Afterparty (Loft) · Met Gala Heist (fora da lista) | nenhuma | aventura 3D | não paga no TCC [decidir] · — | nenhuma |
| Arquivo de 95 jogos (`arquivo-100-jogos/`) | — | não migrados | — | fonte dos 60 modelos de brief |

Na F5 o CBC ganha o elenco "Formação Rosto" (lábios, olhos, blush, unhas e acessório), com linhas por cor e marca pelos
pesos de `CbcLinks` **[código]**.

## 8. Dados e backend [I]

### 8.1 Migração fora do caminho automático

`fai-bootstrap/src/main/resources/application.yml` tem `spring.flyway.enabled: true` e `baseline-on-migrate: true`
**[código]**: tudo em `db/migration` é aplicado na subida, inclusive em produção. As tabelas do MAKE UP vão para
`db/migration-make-up`, incluída em `spring.flyway.locations` só num perfil novo de dev e teste (hoje só há
`application.yml` e `application-vton.yml`), ou ficam num branch sem merge até a ordem da dona; a versão é conferida na
hora. A V98 é gerada por `scripts/flair-games/build.mjs` ("não editar à mão") e não está no lock
`applied-checksums.properties` (vai até V72) **[código]**: só se regenera enquanto não for publicada; depois, `build.mjs`
e `lib/sql.mjs` geram um **delta** (UPDATE por slug) numa migração nova.

### 8.2 Tabelas

- Taxonomia de beleza (REUSO §3.3), `catalog_shades` (IMPL §3), `flair_challenges.makeup_brief_json` (capítulos) e
  `flair_makeup_briefs` (agenda, §2.7); `build_taxonomy.py` e `attributes.py` estão congelados.
- `flair_makeup_looks`: `user_id`, `brief_id`, `protagonist` (`HOUSE`, `AVATAR`, `MANNEQUIN`), `house_model_code`,
  `layers_json` (só produto e relativas), `nails_json`, `outfit_json` (ids), `judge_score`, `stars`, `visibility`
  (`PRIVATE`, `FRIENDS`, `PUBLIC_STANDIN`). Sem imagem, marco, cor ou camada de pele.
- `flair_makeup_votes` (`look_id`, `voter_user_id`, `stars` 1–5, `reaction`, `weight`, `UNIQUE(look_id, voter_user_id)`);
  `flair_makeup_prestige_ledger` (`UNIQUE(user_id, source, ref_id)`, versão da regra); `flair_makeup_career`
  (`prestige`, `level`); `flair_makeup_unlocks` (`UNIQUE(user_id, code)`); `flair_makeup_consent` (concessão, revogação,
  responsável, aprovação); `fai_points_rules` com `FLAIR_MAKEUP_BRIEF` (e `FLAIR_MAKEUP_VOTE`, se decidido).
- **Fonte única** `scripts/flair-games/data/make-up/carreira.json` (curva, cargos, Prestígio, desbloqueios, marcos):
  `build.mjs` gera o SQL delta, `career.gen.ts` e `carreira.gen.md`; o Java lê o mesmo JSON como recurso.

### 8.3 Java (`fai-application/.../flair/makeup/`), endpoints e front-end

- **Records sem pele** (DTO ≤ 120): `MakeupLook`, `MakeupBrief`, `Reaction`. **Regras puras com `basis`** (≤ 250 cada):
  `ColorDifference`, `MakeupPalette`, `MakeupJudge`, `ReactionTiers`, `MakeupCareer`, `MakeupBriefScheduler`.
  **Serviços novos** (≤ 250; `FaiPointsService` está congelado em 411): `MakeupCareerService`, `MakeupCareerGate`,
  `MakeupVisibilityPolicy`, `MakeupCatalogService`, `FlairLookVoting` com `FlairMakeupVoteRepository` (≤ 120).
  `FlairMakeupController` (≤ 200). `FlairGameService` (212) só delega ao juiz nos capítulos (+≈10).
- **Endpoints:** `GET /api/beauty/shades?type=&region=&undertone=&depth=` (público); `GET /api/flair/makeup/briefs/today`;
  `POST .../briefs/{id}/check` (sem escrita, cota) e `/submit` (transacional); `GET .../career` (nível, cargo,
  Prestígio, 3 próximos desbloqueios); `POST .../looks`, `PATCH .../looks/{id}/visibility` (conferida por idade);
  `POST .../looks/{id}/votes`, `GET .../looks/{id}` (às cegas até o fim); `DELETE .../consent` (revoga e apaga).
  `GET /api/flair/games/{slug}` traz `makeupBrief` (`FlairGameController.java`, 66 linhas) **[código]**, e `check` e
  `submit` dos capítulos aceitam `makeup[]` opcional (opacidade 0–1, `placement` fechado, campo de pele recusado).
- **Front-end:** `lib/scene3d/{face-stops,hand-stops}.ts` e `components/three/camera-rig/*` (Strategy `StopSource`),
  depois de caracterizar `CameraSteps` (REUSO §1.7); `lib/avatar3d/makeup/{regions,model,paint}.ts` e
  `lib/hooks/use-makeup-texture.ts` (≤ 150), com no máximo uma prop nova em `avatar-bust.tsx` (237 de 250);
  `components/flair/makeup/*`, `lib/flair/makeup/{standin,visibility,album}.ts`, `components/flair/venue3d/*`,
  `lib/venue3d/*`; os 10 tons Monk em `components/lab/monk-tones.tsx` (`components/lab/scenes-lab.tsx` tem 221 de 250).
- **i18n** em pt-BR, en e es: técnicas, acabamentos, regiões, cargos, falas, amigos, privacidade, publicidade e os
  códigos `CAREER_LEVEL_REQUIRED`, `MAKEUP_LOCKED`, `MAKEUP_SKIN_LAYER`, `MAKEUP_CHECK_QUOTA`.

### 8.4 Testes e regras do repositório

- **Java:** `ColorDifferenceTest` (34 pares de Sharma); cada regra; `MakeupJudgeInvarianceTest` (E1); E3 no endpoint;
  **solubilidade** (cada brief e modelo chega a 100 só com kit, destravas do `minLevel` e empréstimo); carteira intacta;
  payload com pele recusado; log sem Lab nem hex; data nula = 13–17; ledger idempotente e "só estrelas novas".
- **Vitest:** máscaras com `mirrorIndex` (`identity/metrics.ts`); curva de `career.gen.ts`; `visibility.ts` por idade;
  controlador monótono, com histerese, sem protagonista e faixa baixa contida; flashes ≤ 3/s; paridade da tabela de
  reação com o Java; daltonismo. **Caracterização antes de mudar:** `CameraSteps`, `bakeSkin`, espelho de
  `fitting-cabin.tsx`, `Flair3dAccess`, `Flair3dHype`; o snapshot de `paintFace` não muda.
- **Congelados que o plano toca** (`line_baseline.json`) **[código]**: `human-avatar.tsx` (295), `three-human.ts` (333),
  `fitting-cabin.tsx` (320), `room-avatar-controller.tsx` (292), `mirror-session.ts` (297), `garments.ts` (1205),
  `ChallengeService.java` (1852), `FaiPointsService.java` (411), `CbcRules.java` (517), `TryOnSessionService.java` (289),
  `LensSimilarity.java` (259), `Avatar3dService.java` (600), `build_taxonomy.py` (368), `attributes.py` (374). Extrair
  antes de acrescentar; ao reduzir um, `python -m scripts.refactoring.line_ratchet --update` e versionar o baseline;
  antes de commitar, `line_ratchet` sem violações. **GoF** em `docs/refactoring/gof/PATTERN_DECISIONS.md`: Strategy
  (paradas), State (amigo, faixas), Observer (som, efeitos).

## 9. Fases com esforço [I]

Cada fase é jogável. Semanas-pessoa (sp), com **+30% de contingência no que é 3D** (F2, F3, F5, F6).

| Fase | Entrega | sp |
|---|---|---|
| **F0 Spikes, regras e "Reação já"** | spikes de 1 a 3 dias com plano B: re-bake com maquiagem; pálpebra e cílios em `faceWeight ≥ 40` (plano B: sombra só na parte visível, máscara na F5); avatar + amigo na cena; assinatura do juiz com teste de invariância antes das regras. **Reação já:** `ReactionTiers` e `reaction` no `submit` dos 5 capítulos só com o look (`w.makeup = 0`), medidor e legendas na cena atual. Taxonomia de beleza, `catalog_shades`, 60 tons, contagem de produtos vestíveis, juiz, `ColorDifference`, `carreira.json` | 5 |
| **F1 Meu rosto no busto** | Penteadeira 2.5D sobre `avatar-bust.tsx` (UV canônico, REUSO §5.2); protagonista, consentimento, P9 e **RIPD**; batom, gloss, blush, delineado, sombra; antes e depois, três luzes, "meu tom", camada 0; Álbum local; Ensaio Livre | 3 |
| F2 Rosto no corpo | rig extraído; paradas de rosto e mãos; Canvas 2D pela prop `atlas`; Camarim; Provador com 2 amigos; iluminador, sombra de 2 cores, lápis | 3,5 + 1 |
| F3 Desfile que reage | passarela, plateia em 3 camadas, roteiro de câmera, close na ponta, palmas sintetizadas, segunda luz | 2,5 + 0,8 |
| F4 Carreira e comunidade | ledger de Prestígio, níveis e Masterclass, `MakeupBriefScheduler`, liga, temporada, voto em 3 dublês, emenda à POLITICA e ao RF41, contas DEMO com nível semeado (1, 5, 10, 15), só no perfil de dev e sem dado real | 3,5 |
| F5 Completar | GPU e `uv1`; unhas, cílios, âncoras de pulso e dedo, contorno relativo, glitter, duocromo; Tapete de Estreia; desafios de marca; vagas nos capítulos; "Formação Rosto"; spike de bolsa na mão | 5 + 1,5 |
| F6 Lugares extras | Ensaio Editorial, Backstage, travelling, brief para amigos e Brief de Direção com moderação | 2,5 + 0,8 |
| F7 Unreal | depois da Fase 0 de `APP_NATIVO_UNREAL.md` §4.3, **sem Pixel Streaming nem GPU paga**; elenco fictício em MetaHuman; **nunca Mesh to MetaHuman para o avatar de jogador** (APP_NATIVO §1.4, caminho (a); §4.4, item 5); avatar com Material Layers no UV canônico (IMPL §1.7); faixas e paradas por marco e osso seguem a REUSO §1.6–1.7 e §4.4 | — |

F0–F6 ≈ 29 sp. **No TCC:** F0–F3 e a fatia da F4 com níveis 1–10, ≈ 17 sp. Com 2 pessoas a partir de 09/11/2026: F0
nas semanas 1–2, F1 na 3, F2 nas 4–5, F3 na 6, F4 na 7, contingência e demonstração nas 8–9 (até ~08/01/2027)
[decidir prazo e equipe]. Se a banca vier antes, o mínimo é a **Primeira Prova** (F0 + F1): hub → brief "Primeira
Prova" (Camarim, foco nos lábios) → modelo da casa ou meu avatar → a câmera voa até os lábios → batom e blush → antes
e depois → entregar → lâmpadas reagem, com legenda → Prestígio, nível 2, Masterclass do blush. **Pronto quando:** mesma
nota na modelo e no avatar; 3 idiomas; reação em legenda e som com movimento reduzido; ≥ 30 fps num notebook médio;
`line_ratchet`, Vitest e Maven passando.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Rosto de menor exposto; avatar hoje público por padrão (`public_on_runway`) | P2–P9: nada herdado da V25, idade no servidor, data nula = menor, público só nas dublês, sem exportação para 13–17, padrão `FALSE` como pré-requisito |
| Nota que depende da pele, direta ou pelo voto | E1–E3b: sem campo de pele, camadas de pele só no aparelho, 3 dublês no voto, Prestígio só do juiz, métrica em produção |
| Migração chegar à produção sozinha (Flyway na subida) | pasta própria só em perfil de dev e teste, ou branch sem merge (§8.1) |
| Segunda carteira de XP contra a POLITICA | unidade "Prestígio", rank de segmento, emenda formal antes da F4 |
| Pressão estética e uso excessivo entre adolescentes | sem nota de beleza; reação baixa contida; sem energia, streak ou rebaixamento para menores; briefs abertos 7 dias; pausa e silêncio noturno |
| Partida a frio com poucos usuários | comunidade cai na nota do juiz abaixo de 20 votos; Liga Aberta até 10 por divisão; contas DEMO |
| Arquivos congelados; pálpebra e cílios; celular | Canvas 2D pela prop `atlas` (zero linhas nos congelados); spikes com plano B; no máximo avatar, amigo e 6 clones (REUSO §5.4); +30% no 3D |
| Licença de marca acabar; afiliado para 13–17; marca real no desfile | cláusula perpétua ou troca por FashionAI Beauty; link escondido para menores; Desfile de Gala fictício |
| Conteúdo de jogador; diferença entre web e Unreal | só seletores fechados, denúncia e revisão; os mesmos JSON de receita, brief, carreira e reação |

## 11. Decisões para a dona [decidir]

1. **Meu avatar nos briefs desde o nível 1**, com a Impersonation no Loft? O +2 dela sai também das vagas de roupa?
2. **Prestígio** como rank de segmento, com emenda à POLITICA §1 e §6 e ao RF41 antes da F4?
3. **Juiz sem pele:** base e corretivo só no aparelho, contorno e bronzer só pela técnica (diverge da IMPL §4.2)?
4. **Curva:** k = 15 (topo em ~4,5 meses com 3 briefs por dia), 20 ou outro? 30 níveis ou 20?
5. **FAI Points:** `FLAIR_MAKEUP_BRIEF` com 10 pontos, 3/dia e 15/semana? Voto pela regra atual ou por uma nova?
6. **Voto:** 3 dublês lado a lado ou dublê anunciada no brief? Janela de 6 h? Ranking 0,6 juiz + 0,4 comunidade?
7. **Menores:** aprovação do responsável obrigatória para usar o próprio avatar? `public_on_runway = FALSE` para 13–17?
8. **Link de compra e cupom para 13–17** escondidos (proposto) ou só rotulados? Prêmio físico com o responsável?
9. **Primeiro lugar 3D:** Camarim com o amigo (proposto) ou Desfile de Gala?
10. **Elenco:** 6 modelos da casa, 4 amigos e Lina Vale; quem desenha os rostos? Cabelo entra na F5 ou fica fora?
11. **Conteúdo:** lingerie e roupa de banho fora de todos os briefs do MAKE UP, ou só para adultos?
12. **Prazo e equipe do TCC**, e qual marca real convidar para mandar feed depois da FashionAI Beauty.
