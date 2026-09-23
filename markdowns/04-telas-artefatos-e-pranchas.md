# Etapas 6 e 7 — Vinte pranchas (RF23) e artefatos de interface otimizada

---

## Parte A — Etapa 6: as vinte pranchas

### A.1 O artefato chegou

O artefato **"Vinte pranchas para as novas telas do Fashion AI"** está arquivado em `insumos/pranchas/` e legível em [claude.ai/code/artifact/bb3132be](https://claude.ai/code/artifact/bb3132be-c756-4e95-bef1-022e3b5faf66). Ele não é uma lista de telas — é **direção de arte generativa**: 20 pranchas com prompt de Adobe Firefly, prompt negativo, barra de cor fechada, o bloco de parâmetros do `ArtworkStudioInput` e o caminho do arquivo no código.

Isso muda o que a Etapa 6 é. A suposição inicial deste documento — "20 pranchas = 20 telas" — **estava errada**. As 20 pranchas cobrem **quatro superfícies visuais novas**, não vinte telas; a lista provisória de telas foi removida e substituída pelo catálogo real abaixo.

### A.2 Contrato técnico das pranchas

O Background Studio não recebe imagem solta: recebe um `ArtworkStudioInput` tipado. Cada prancha já traz o bloco correspondente.

| Campo | Valores | Uso |
|---|---|---|
| `compositionType` | `background` · `shape_pack` · `overlay` · `frame` | fundo de card · selos e badges · scrims · molduras de mosaico |
| `stylePreset` | `editorial_fashion` · `luxury_minimal` · `futuristic_sport` · `streetwear` · `monochrome_premium` | mapeia quase 1:1 nas ocasiões: trabalho→`luxury_minimal`, festa→`editorial_fashion`, academia→`futuristic_sport`, casual→`streetwear` |
| `paletteMode` | `monochrome` · `cool_luxury` · `warm_neutral` · `custom` | `custom` quando a prancha traz barra de cor fechada |
| `shapeLanguage` | `diamond` · `orb` · `mesh` · `panels` · `mixed` | `diamond` nos selos (lê como brasão em tamanho pequeno) |
| `safeAreaMode` | booleano | **sempre `true`** em fundo de card |
| `contrastLevel` · `glowIntensity` · `density` | `low`/`medium`/`high` · 0–100 · 0–100 | card compacto fica em `low` e densidade baixa |

**Onde os arquivos entram:** soltos em `public/`, registrados no array de artworks de `OutfitBackgroundStudioModal.tsx`, agrupados por `group`. As 20 pranchas formam três coleções novas, seguindo a numeração existente (Coleção A = `a1`–`a32`, Coleção C = `c1`–`c6`):

| Coleção | Arquivos | Pranchas |
|---|---|---|
| **D** — Ocasiões & Looks Salvos | `public/d1.png` … `d5.png` | 01–05 |
| **E** — Selos, Marcas & Celebridades | `public/e1.png` … `e8.png` | 06–13 |
| **F** — DNA, Closet & Lookbook | `public/f1.png` … `f7.png` | 14–20 |

### A.3 As cinco famílias

| Família | Pranchas | RF | Problema visual que resolve |
|---|---|---|---|
| **I — Looks Salvos** | 01–05 | RF29 *(absorvido em RF6)* | No feed compacto, 5–15 cards com a mesma silhueta só se distinguem pela cor. O fundo diz de longe se é look de trabalho ou de festa. As 4 ocasiões vêm do código: `casual`, `trabalho`, `festa`, `academia`. A prancha 05 é o **scrim de indisponível** (`overlay` a `opacity:.55`) |
| **II — Marcas** | 06–09 | RF20 · RF27 | O selo em **dois tiers**: `tier PEÇA` é um botão de alfaiate metálico; `tier LOOK` é um brasão têxtil bordado. A escala vira material, não só tamanho. Centro sempre **vazio**, para receber o `logo_url` cadastrado pela marca |
| **III — Celebridades** | 10–13 | RF21 · RF28 | Mesmos dois tiers, materialmente opostos: marca é **têxtil e dourado**, celebridade é **vítreo e holográfico**. O usuário identifica o tipo sem ler |
| **IV — DNA de Estilo** | 14–17 | RF13 | Moldura de mosaico, selo circular **DNA** no cruzamento da costura, fundo por era atrás de fotos reais |
| **V — Closet & Lookbook** | 18–20 | RF6 · RF17 | Badge de uso legível sobre foto de produto, estado vazio da peça nunca usada, capa de assinatura derivada da paleta dominante |

### A.4 Quatro regras que valem para todas as vinte

Estas são **critérios de rejeição** — uma prancha que as viole não entra:

1. **Nenhuma prancha retrata pessoa real.** A tela de celebridades nomeia artistas reais com eras nomeadas. As pranchas trabalham a *atmosfera cromática e material* da era, nunca rosto, corpo ou silhueta identificável. Não é só política do Firefly: retrato gerado de pessoa real, dentro de um produto que a vincula comercialmente a um look, é problema de **direito de imagem** — e a banca vai perguntar.
2. **Nenhum logotipo de marca existente.** As pranchas geram **superfície e moldura** (monograma têxtil, textura de etiqueta, brasão vazio) e deixam o centro livre para o `logo_url` que a marca cadastrou no RF27.
3. **Área segura antes de beleza.** No card compacto (90 × 164 mm) sobram **56 mm de capa**; o resto é texto. Os prompts pedem *large uncluttered central area* e *detail confined to the outer third*. Arte linda no Firefly e ilegível no card é arte descartada.
4. **Texturas são *tiles*, fundos não.** As pranchas de textura (04, 09, 17, 20) pedem *seamless tile* em 1:1. As de fundo são composições únicas em 9:16 ou 16:9. Misturar produz emenda visível no meio do card.

### A.5 O que as pranchas revelaram sobre os requisitos

A leitura do artefato encontrou **três lacunas** nos requisitos — anotadas no documento `02`, §RF20/RF21:

1. **Dois tiers de selo** (`PEÇA` / `LOOK`) não existem no modelo de dados nem nos CAs de RF20/RF21.
2. **Aba "Meus Selos"** guarda os selos recusados para aplicação manual posterior; o CA04 atual só registra a recusa "para aprendizado".
3. **RF13 aparece como tipologia de publicação** (2–6 esquemas fundidos, `isDNAdeEstilo`, `mosaicLayout`, rótulo de era por célula) — o que **conflita** com a definição da HU20. Decisão pendente do time; ver `insumos/README.md`.

### A.6 Ficha padrão de prancha *(para preencher no Bloco 4)*

```markdown
### Prancha NN — <nome>
- **Família / Coleção:** <I–V> · <D|E|F> · arquivo `public/xN.png`
- **RF dono:** RFx · **CAs materializados:** RFx.CAnn
- **Proporção:** 9:16 (card) · 16:9 (faixa) · 1:1 (selo ou tile)
- **Barra de cor:** #… #… #… #… #…
- **Prompt / Excluir:** <do artefato>
- **ArtworkStudioInput:** compositionType · stylePreset · paletteMode · shapeLanguage · contrastLevel · density · glowIntensity · safeAreaMode
- **Onde aplica no código:** <condição> · registrar em `OutfitBackgroundStudioModal.tsx`
- **Gerada?** [ ] Firefly · [ ] vetorizada no Illustrator · [ ] registrada no array
```

### A.7 Assets a gerar no Adobe Firefly / Express

As 20 pranchas cobrem fundos de ocasião, selos, capas de perfil, moldura de mosaico e badges. Os itens abaixo são o que **sobra** depois delas — gerar só o que faltar, sempre em tema claro e escuro:

| Tipo | Onde | Observação |
|---|---|---|
| Fundos do Background Studio | RF11 | 8–12 texturas por categoria (liso, urbano, natureza, editorial, geométrico) |
| Ilustrações de estado vazio | RF6, RF8, RF12, RF13, RF14 | Uma por tela; sem elas o estado vazio vira tela em branco (RF8.CA04) |
| Manequins masculino e feminino | RF18 | Silhuetas neutras em SVG, com variação de tom de pele e porte (RF18.CA06) — **não coberto pelas 20 pranchas** |
| Moldura do Card do DNA de Estilo | RF13 | Template SVG parametrizado, convertido em PNG no servidor |
| Selo de vínculo verificado | RF20, RF21 | Três estados: neutro (pendente), verificado, recusado |
| Ícones do footer de card | RF31 | favoritar · disponível · indisponível · todos |

> **Cuidado de licença:** anotar em `docs/novo-projeto/insumos/assets/CREDITOS.md` qual asset foi gerado por IA, com qual ferramenta e em que data. A banca pode perguntar, e a licença do Firefly exige atribuição em alguns planos.

---

## Parte B — Etapa 7: os dez artefatos de interface

Cada artefato é uma página HTML autocontida, publicada como Artifact, mostrando a **interface otimizada** da tela: layout final, todos os estados, e a lista de CAs cobertos ao pé da página. Não é protótipo navegável nem código de produção — é o artefato de especificação visual que a banca lê e que o Claude Code usa como referência ao implementar.

### Especificação comum a todos

- **Estados obrigatórios:** vazio · carregando · sucesso · erro · sem permissão.
- **Temas:** claro e escuro, com os tokens definidos em `:root` e trocados por `prefers-color-scheme` e `[data-theme]`.
- **Responsivo:** desenhado *mobile-first* (o app é móvel); a versão desktop é a adaptação.
- **Rodapé de rastreabilidade:** tabela `CA → onde na tela ele é satisfeito`.
- **Acessibilidade:** foco visível, contraste AA, alvos de toque ≥ 44 px (RF23.CA05, CA06 / RNF7).

### Artefato #1 — Aba "Criar Look" + Background Studio
- **RF:** RF5, RF11 · **CAs:** RF5.CA01–CA06, RF11.CA01–CA05, RF24.CA02, RF24.CA07
- **Layout:** três faixas — (a) Closet Digital filtrável por categoria, (b) área de composição com camadas, (c) barra de ações (nome, ocasião, visibilidade, "gerar com IA", "Background Studio").
- **Estados críticos:** menos de 2 peças (RF5.CA02); tentativa de salvar sem peça (RF5.CA06); IA indisponível (RNF8); geração de fundo em andamento (RF11.CA03).
- **Detalhe que costuma faltar:** a composição precisa mostrar a **ordem de camadas**, senão o desenho não sustenta o Provador (RF18.CA02).

### Artefato #2 — Aba "Copilot"
- **RF:** RF10 · **CAs:** RF10.CA01–CA07, RF24.CA03, RF24.CA13, RF24.CA14
- **Layout:** cabeçalho de contexto (ocasião, humor, clima) + três cards de sugestão lado a lado, cada um com justificativa de até duas frases e ações aceitar/descartar.
- **Estados críticos:** guarda-roupa insuficiente (CA04); cota esgotada (RF24.CA14); provedor fora do ar com fallback local (CA05); rodada seguinte sem repetir sugestões (CA03).
- **Detalhe:** marcar visualmente a "sugestão externa" — peça que o usuário não possui (CA07).

### Artefato #3 — Aba "DNA de Estilo"
- **RF:** RF13 · **CAs:** RF13.CA01–CA09, RF24.CA04
- **Layout:** Card Visual em destaque (arquétipo, paleta de 5 cores, silhueta, índice de ousadia, peça ícone, Frase de Identidade) + formulário de Identidade de Vida em quatro grupos com os limites da HU20 (3/3/2/4).
- **Estados críticos:** progresso quando faltam peças ou avaliações (CA02); card só com Camada 1 (CA03); alternância de visibilidade por campo (CA06); aviso de evolução do DNA (CA07).
- **Detalhe LGPD:** deixar explícito na tela que campos privados **influenciam** a frase mas **não aparecem** na exportação (CA06 + RNF6).

### Artefato #4 — Aba "Minhas Fotos"
- **RF:** RF12 · **CAs:** RF12.CA01–CA06, RF24.CA11
- **Layout:** grade por origem (peça · esquema · provador · DNA), com seleção múltipla e barra de ações contextual.
- **Estados críticos:** exclusão de foto vinculada a peça ativa (CA03); exclusão em lote com confirmação única (CA04); grupo de duplicatas sugerido pela IA (RF24.CA11).

### Artefato #5 — Aba "Buscar / Explorar"
- **RF:** RF8 · **CAs:** RF8.CA01–CA06
- **Layout:** campo de busca + chips de filtro removíveis + abas de resultado (Looks · Peças · Pessoas · Marcas · Celebridades) + grade paginada por cursor.
- **Estados críticos:** busca sem resultado com sugestões (CA04); conteúdo privado nunca listado (CA05); fim de página sem duplicar itens (CA06).

### Artefato #6 — Dados pessoais (LGPD, RF3) e preferências (RF23)  ✅ *desbloqueado*
- **RF:** RF3, RF23 · **CAs:** RF3.CA01–CA06, CA12–CA14, **CA19–CA24**; RF23.CA01–CA06
- **Fonte:** `insumos/lgpd/padroes-interface-lgpd.html` (anexo do RNF6, recebido).

**Estrutura de cinco seções** — é o padrão das grandes plataformas e o que a fonte descreve; seguir esta divisão, nesta ordem:

| Seção | O que vive nela | Regra que a governa |
|---|---|---|
| **Conta** | Dados identificadores: nome de exibição, @, e-mail, telefone, data de nascimento, foto, bio | Direito de correção (art. 18, III). E-mail e telefone com **verificação de posse**, não só digitação. Alteração sensível dispara **reautenticação** (RF3.CA01) |
| **Privacidade** | "Quem pode ver seu perfil" (radio: Somente você · Conexões · Público) + consentimentos por finalidade | Padrão mais restritivo pré-selecionado (RF3.CA19); um toggle por finalidade (RF3.CA20) |
| **Aparência** | Tema, contraste, tamanho de fonte | **RF23, não RF3** — preferência de interface, não dado pessoal |
| **Idioma** | Idioma da interface | **RF23**. Ligação indireta com transparência (art. 6º, IV e VI): o titular precisa entender no idioma dele o que consente |
| **Seus dados** | "Baixar seus dados" (JSON) · "Excluir conta" | Portabilidade (art. 18, V) e eliminação (art. 18, VI); ações destrutivas com **confirmação dupla** e consequências explicadas |

**Cada controle exibe a etiqueta do artigo que cumpre** — é o detalhe que transforma a tela em artefato defensável na banca. Ex.: campo Nome → `Art. 18, III · Correção`; toggle de anúncios → `Art. 7º, I · Consentimento revogável`; reconhecimento facial → `Art. 11 · Dado sensível`.

**Estados críticos:** reautenticação exigida (CA01); e-mail em confirmação pendente (CA02); exclusão em carência de 30 dias (CA05); exportação em preparo com link expirável (CA04).

**Critérios de rejeição** — a tela volta se aparecer qualquer um: checkbox pré-marcado, consentimento agrupado, revogação mais cara que a concessão, ou padrão invasivo (ver a tabela de anti-padrões no documento `02`).

### Artefato #7 — Esquema de vestimenta e peças de roupa  ✅ *desbloqueado*
- **RF:** RF6, RF7, RF9, RF19, RF31 · **CAs:** RF6.CA11, RF7.CA01–CA03, RF19.CA01–CA10, RF31.CA01–CA06
- **Fonte:** Parte 3 do artefato **[Modelagem UML & mapa de estado](https://claude.ai/code/artifact/8c050ab5-8faf-4073-a077-dd8e492db661)** — "Especificação dimensional dos cards", arquivada em `insumos/uml/`. **As cotas em milímetros são a fonte da verdade**; as proporções do desenho são aproximadas.

**Escala e grade:** 1 mm = 2,5 px · grade base 2 mm · margem interna 4 mm · raio 3 mm.

São **quatro cards**, não dois. Todos com 90 mm de largura:

| Card | Altura | Composição |
|---|---|---|
| **Peça · compacto** | ≤ **18 mm** — linha única de lista | logo + marca + nome + tipo + tamanho. **Sem imagem, header ou footer.** É o formato usado dentro da lista de peças de um esquema |
| **Peça · ampliado** | **208 mm** | header autor 16 · imagem 80 · tipo/marca/**sexo** 22 · detalhes 40 · métricas 14 · footer 36 |
| **Vestimenta · compacto** | **164 mm** | header 14 · capa 56 · título/style/occasion/visibility 14 · 4 miniaturas L1–L4 com marca 30 · métricas 14 · footer 36 |
| **Vestimenta · ampliado** | **216 mm** | header 16 · capa 70 · título + `creation_mode`/descrição 20 · lista completa de peças em compacto 60 · métricas 14 · footer 36 |

**Estado "comentários abertos":** soma ~**116 mm** ao ampliado — input de comentário 20 mm · item 24 mm · recuo de resposta 12 mm.

#### ⚠️ Faixa ausente nos desenhos: os toggles de estado, no **topo** do card

Os quatro desenhos da Parte 3 **não incluem** a faixa de toggles que fica na **parte superior** do card. Ela precisa ser cotada e desenhada:

| Controle | Forma | Comportamento |
|---|---|---|
| ⭐ **Favoritar** | Estrelinha **pequena**, no padrão do Spotify | Alterna; independente dos demais (RF31.CA01) |
| **Disponível** | Rótulo curto | Estado exclusivo com "indisponível" (RF31.CA03) |
| **Indisponível** | **Pequeno, só a letra** | Estado exclusivo com "disponível" (RF31.CA02) |

Três correções que isso impõe ao que estava escrito:

1. **Topo, não rodapé.** A faixa de RF31 fica **acima** do header de autoria ou embutida nele — não no footer. O footer é território do RF19 (curtir · comentar · compartilhar · remixar · retornar · editar).
2. **"Todos" não é um toggle do card.** É o **filtro da lista** — vive no header da página de Looks Salvos / Closet, ao lado do filtro de ocasião, e não no card individual.
3. **Cota pendente.** A Parte 3 não dá altura para essa faixa. Proposta a validar, coerente com a grade de 2 mm: **8–10 mm**, o que levaria Vestimenta compacto de 164 para ~172–174 mm e o ampliado de 216 para ~224–226 mm. **Confirmar com quem desenhou antes de tratar como cota oficial.**

**Seis regras de anatomia, cada uma amarrada a um CA:**

| Regra | Origem | O que muda |
|---|---|---|
| **Header de autoria** | RF6-CA12 · RF7-CA9 | Faixa inicial com foto + nome do autor (+ visibilidade e tempo no look). **Faltava nos mockups**; adiciona 12–16 mm no topo |
| **Footer social** | RF19-CA12–15 | curtir · comentar · compartilhar · **remixar** · **retornar**; adiciona 34–36 mm nos dois modelos |
| **Campo `sexo` visível** | RF18 · RF4 | Exibido na identificação da peça; alimenta o filtro do Provador 2D |
| **Botão editar só para o dono** | RF7-CA8 · RF9-CA4 | Fica no footer, visível apenas ao proprietário |
| **Peças por versão** | RF6 · RF7-CA10 | Compacto: 4 miniaturas com marca. Ampliado: lista completa, cada peça na sua linha compacta |
| **Modal único** | RF6-CA8 · RF7-CA7 | **O card É a superfície do modal** — o modal fornece só o scrim, nunca uma segunda borda em volta |

**Três telas que reaproveitam essas cotas** (também na Parte 3):

- **Feed de busca (RF8):** barra de filtros 16 mm + lista rolável de cards compactos, gap 4 mm. **Sem header/footer de página** — quem tem header e footer é o card.
- **Perfil (RF8/RF17):** header ≈ 64 mm (avatar+nome 28 · seguir · bio 12 · contadores 12 · tabs 12) sobre body de feed. É *aqui* que existe header de página.
- **Modal:** ao clicar num look abre o ampliado 90×216; ao clicar num item da lista de peças abre o ampliado 90×208.

**Direções visuais do RF11 e os wearstyles.** As quatro direções — *Editorial Spread* (masthead serif, wearstyles sublinhados), *Luxury Glass* (glassmorphism escuro, wearstyles em pílula dourada), *Atelier* (papel kraft, wearstyles como etiquetas tracejadas) e *Show Notes* (minimalista, wearstyles numerados) — **re-renderizam os wearstyles no mesmo estilo**, sem alterar seus valores.

**Wearstyles restritos por parte do corpo** (proposta a validar — vira CA em RF4 e RF5):

| Parte do corpo | Wearstyles permitidos | Máx. |
|---|---|---|
| Cabeça & acessórios | Casual · Esporte · Praia · Festa | 4 |
| Superior (tronco) | Casual · Social · Esporte · Festa · Trabalho · Praia | 6 |
| Inferior (pernas) | Casual · Social · Esporte · Trabalho · Praia | 5 |
| Calçados (pés) | Casual · Social · Esporte · Festa · Praia | 5 |

**Estados críticos:** peça excluída pelo autor exibida como snapshot (RF7.CA03); visitante sem permissão de edição (RF7.CA02); toggles do topo coerentes entre si — favoritar independente, disponível/indisponível exclusivos (RF31.CA06).

### Artefato #8 — Provador 2D com manequim masculino/feminino
- **RF:** RF18 · **CAs:** RF18.CA01–CA07, RF24.CA08
- **Layout:** manequim central + seletor masc/fem + gaveta de peças por camada + controles de tom de pele e porte + ações limpar/salvar.
- **Estados críticos:** substituição de peça na mesma camada com aviso (CA03); peça sem fundo removido com aviso de aproximação (CA05); confirmação ao limpar (CA07).

### Artefato #9 — Editar os dados de um esquema
- **RF:** RF9 · **CAs:** RF9.CA01–CA07, RF24.CA10
- **Layout:** formulário com todos os campos pré-carregados + lista de peças com adicionar/remover + painel de *diff* da sugestão de IA, aceitável item a item.
- **Estados críticos:** 403 para não-autor (CA04); aviso de revalidação do vínculo com a marca (CA05); confirmação ao sair com alterações pendentes (CA06).

### Artefato #10 — Central de notificações
- **RF:** RF3 (ex-RF26) · **CAs:** RF3.CA15–CA18, RF19.CA11–CA12
- **Layout:** lista cronológica com não lidas destacadas + ação "marcar todas como lidas" + acesso às preferências por tipo.
- **Estados críticos:** lista vazia; tipo desativado (nada chega, mas a interação foi contabilizada — CA17/RF19.CA12); expurgo de itens com mais de 90 dias (CA18).

### Ordem sugerida de produção

| Onda | Artefatos | Por quê |
|---|---|---|
| 1 | #7, #1 | Card e composição são a base visual de todas as outras telas |
| 2 | #2, #3, #8 | Telas de IA — definem o padrão de "sugestão", "carregando" e "provedor fora do ar" |
| 3 | #5, #4, #9, #10 | Telas de listagem e edição, que reaproveitam os componentes das ondas 1 e 2 |
| 4 | #6 | A fonte já chegou; fica por último só porque é a tela com mais regras — vale ter os componentes das ondas 1–3 prontos antes |
