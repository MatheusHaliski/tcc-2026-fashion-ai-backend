# Meu Guarda-Roupa: Grade · Meu Quarto · Destaques · Desafios + Copilot Contextual

**Projeto:** FashionAI (SAI-TCC-2026)
**Status:** proposta de especificação (v0.3), para revisão do time
**Requisitos novos:** RF32 (Meu Quarto) · RF33 (Smart Mirror e Vista-me) · RF34 (Destaques do Meu Inventário) · RF35 (FAI Points e progressão do quarto) · RF36 (Desafios & Games, em [`03-desafios-e-games.md`](03-desafios-e-games.md))
**Requisito estendido:** RF10 (Copilot), que ganha os CAs RF10.CA08 em diante
**Depende de:** RF4, RF5, RF6, RF13, RF16, RF19, RF24, RF31
**Documentos irmãos:** [`02-inventory-score-calculo.md`](02-inventory-score-calculo.md) · [`03-desafios-e-games.md`](03-desafios-e-games.md) · [`04-detalhes-de-engajamento.md`](04-detalhes-de-engajamento.md) · [`RF33_Vista-me_Atividades.puml`](RF33_Vista-me_Atividades.puml)

> **Numeração.** Segue a política de [`02-rf-reestruturados-e-criterios-aceite.md`](../novo-projeto/02-rf-reestruturados-e-criterios-aceite.md) §1: nenhum número é reciclado. Os RFs novos começam no RF32, o próximo número livre. O Copilot não ganha número novo: é o RF10, que recebe CAs adicionais.

---

## 0. Conceito

> **Meu Quarto é o espaço digital onde o guarda-roupa do usuário ganha forma.** Ele organiza as peças, mostra o estado do inventário, ajuda a encontrar roupas e permite montar looks direto no ambiente. O **Copilot** conhece esse inventário e usa as peças reais do usuário para sugerir, localizar, recuperar peças esquecidas e criar novas formas de vestir. A aba **Destaques** transforma o inventário em inteligência: mede a qualidade dele pelo **FAI Inventory Score**, mostra a evolução, aponta os melhores itens e permite comparar o guarda-roupa em rankings da comunidade.

### 0.1 Teste principal da funcionalidade

> **Se removermos completamente os FAI Points e as recompensas, estas funcionalidades ainda resolvem algum problema do usuário?**

Todo CA de RF32, RF33 e RF34 precisa passar nesse teste. A gamificação (RF35) só **recompensa** o uso de algo que já tem valor sozinho. Consequências normativas:

1. **Cadastrar peças nunca é bloqueado**, em nenhum nível e por nenhum saldo.
2. O Smart Mirror, o Vista-me, o Copilot e a localização de peças ficam disponíveis **desde o nível inicial**.
3. A progressão muda **organização, estética, personalização e possibilidades**. Nunca retira uma função básica.
4. Os rankings e o Inventory Score não podem premiar quem **compra mais roupas** (ver [`02-inventory-score-calculo.md`](02-inventory-score-calculo.md) §2).

### 0.2 Arquitetura de navegação

```
MEU GUARDA-ROUPA
├── Grade        → ENCONTRAR   (pesquisar, filtrar, administrar muitas peças)
├── Meu Quarto   → INTERAGIR   (espacial, visual, montar looks no espelho)
├── Destaques    → ENTENDER E EVOLUIR (score, evolução, conquistas, rankings)
└── Desafios     → AGIR        (metas solo, em equipe, em duelo e da comunidade, RF36)
          ▲
          └── FashionAI Copilot: transversal às quatro visões
                 ↓ consulta
   Inventory Score · DNA de Estilo · Histórico · Look do Dia · Criar Look
   Aura · Hype Score · FAI Points · Maison · Rede Social
```

A **Grade** continua sendo a visão padrão para busca e administração, porque ninguém deve precisar navegar num ambiente 3D para achar uma camiseta. As visões compartilham **o mesmo estado** (filtros, seleção, disponibilidade), então uma peça encontrada na Grade pode ser **"Mostrada no quarto"** (RF32.CA09).

### 0.3 Dois indicadores que não se misturam

| Indicador | Pergunta que responde | Método de normalização |
|---|---|---|
| **Hype Score** (RF6, [`RF6_HYPE_SCORE_CALCULO.md`](../../markdowns/RF6_HYPE_SCORE_CALCULO.md)) | "Qual é a minha relevância social?" | percentil contra a comunidade |
| **FAI Inventory Score** (RF34) | "Quão desenvolvido, versátil e bem utilizado é o meu guarda-roupa?" | **rubrica absoluta**: depende só do próprio guarda-roupa. O percentil entra apenas no ranking |

Por que a rubrica é absoluta: se o Inventory Score fosse um percentil, a nota de um usuário cairia quando outros melhorassem, mesmo sem ele mudar nada. Isso contradiz a promessa de "melhorar usando melhor o que você já tem". O ranking (RF34.CA08) é o único lugar em que há comparação entre usuários.

---

## 1. RF32 — Meu Quarto (visualização espacial do guarda-roupa)

### 1.1 O móvel inicial: FAI Origem

```
┌───────────┬───────────┬───────────┬───────────┐
│   MALEIRO: caixas de look (esquemas salvos)   │
├───────────┼───────────┼───────────┼───────────┤
│           │           │           │           │
│    FAI    │    FAI    │    FAI    │    FAI    │  Portas 1–4
│           │           │           │           │  (cabideiro atrás)
│          ◦│◦          │          ◦│◦          │
├─────┬─────┼─────┬─────┼─────┬─────┼─────┬─────┤
│ fai │ fai │ fai │ fai │ fai │ fai │ fai │ fai │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤  3 linhas × 2 gavetas
│ fai │ fai │ fai │ fai │ fai │ fai │ fai │ fai │  por compartimento
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤  (24 gavetas)
│ fai │ fai │ fai │ fai │ fai │ fai │ fai │ fai │
├─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┤
│  BASE: calçados enfileirados (até a Sapateira) │
└───────────────────────────────────────────────┘
  Branco fosco · puxador cava · logo FAI gravado
```

O FAI Origem é bonito, mas propositalmente simples: a evolução (RF35) tem que ser perceptível.

**Endereçamento.** Toda posição tem um endereço estável e legível, usado pelo Copilot e pelo Vista-me:

| Zona | Endereço | Rótulo exibido | Conteúdo padrão |
|---|---|---|---|
| Cabideiro | `door:{1..4}/hanger:{n}` | "Porta 2" | peças superiores, vestidos, casacos |
| Gaveta | `drawer:{1..24}` | "Gaveta 4 · Jeans" | peças inferiores dobradas, acessórios, íntimas |
| Maleiro | `top:{n}` | "Maleiro" | esquemas salvos (Caixas de Look) |
| Base / Sapateira | `base:{n}` / `shoe:{n}` | "Sapateira · posição 4" | calçados |

**Categorias de gaveta** (renomeáveis pelo usuário ou sugeridas pela IA): Jeans · Academia · Praia · Acessórios · Íntimas · Favoritas.

### 1.2 O ambiente comunica dados

| Estado (fonte) | Representação no quarto |
|---|---|
| Esquecida: sem uso há 60+ dias (`FORGOTTEN_DAYS`, `app/views/MyWardrobeView.tsx:61`) | poeira e teia discretas. Somem quando a peça volta a um look |
| Indisponível (RF31) | no **cesto de roupa** ao lado do móvel |
| Favorita (RF31) | cabide especial |
| Peça Ícone (RF13) | vitrine própria |
| Esquema salvo (RF5/RF6) | Caixa de Look no maleiro, com o outfit card na frente |
| Para vender | pequena arara com etiqueta de preço |
| Look do Dia (RF6) | montado no Smart Mirror |
| Marco do Inventory Score (RF34) | luzes do closet acendem e aparece uma animação de conquista no espelho |
| Capacidade excedida | peças extras na **Cadeira** do quarto (só visual, nunca bloqueia) |

### 1.3 Critérios de aceitação

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF32.CA01 | usuário autenticado em Meu Guarda-Roupa | alterna para "Meu Quarto" | sistema renderiza o quarto com o móvel do nível atual e todas as peças do acervo em posições endereçadas (§1.1) |
| RF32.CA02 | peça recém-cadastrada (RF4) | o cadastro é concluído | a peça recebe uma posição automática coerente com o tipo (superior → porta, inferior → gaveta da categoria, calçado → base/sapateira), sem ação do usuário |
| RF32.CA03 | usuário no quarto | toca numa porta ou gaveta | o elemento abre com animação e exibe as peças daquela posição. Tocar numa peça abre o modal de peça já existente |
| RF32.CA04 | usuário no modo Organizar | move uma peça para outra posição ou renomeia uma gaveta | a nova posição/categoria é persistida e refletida na Grade, no Copilot e no Vista-me |
| RF32.CA05 | usuário aciona "Organizar com IA" | confirma a prévia | sistema propõe categorias de gaveta e redistribuição, mostra a prévia antes de aplicar e permite desfazer |
| RF32.CA06 | peça com estado esquecida, indisponível, favorita, ícone ou à venda | o quarto é renderizado | a peça aparece com a representação da tabela §1.2 |
| RF32.CA07 | mais peças do que posições no nível atual | o usuário cadastra outra peça | o cadastro é concluído normalmente e a peça excedente aparece na Cadeira. **Nenhum cadastro é bloqueado** |
| RF32.CA08 | dispositivo sem WebGL ou com desempenho abaixo do mínimo | abre Meu Quarto | sistema usa o modo 2.5D estático com as mesmas interações, sem erro (**RNF7**) |
| RF32.CA09 | usuário encontra uma peça na Grade | aciona "Mostrar no quarto" | sistema alterna para Meu Quarto, enquadra a câmera na posição e a destaca com iluminação |
| RF32.CA10 | leitor de tela ativo ou preferência por lista | navega pelo quarto | toda posição tem rótulo acessível ("Gaveta 4, Jeans, 6 peças") e existe uma alternativa em lista com as mesmas ações |
| RF32.CA11 | a câmera do quarto | é manipulada | rotação e zoom ficam limitados a um enquadramento 3/4 editorial. Não existe câmera livre |

---

## 2. RF33 — Smart Mirror e "Vista-me"

O espelho é o **centro da experiência**. Ele não duplica o Criar Look (RF5): é mais uma interface para iniciá-lo.

### 2.1 Montagem manual no espelho

Fluxo de referência: abrir uma gaveta → pegar uma calça → arrastar para o espelho → abrir uma porta → pegar uma camisa → arrastar. O look começa sozinho.

**Slots do espelho:** `upper` · `lower` · `dress` (ocupa `upper` + `lower`) · `shoes` · `accessory` (vários) · `outer_layer` (opcional).

**Regra de completude (determinística, sem IA):** um look é *completo* quando tem (`upper` + `lower`) ou `dress`, **e** `shoes`. O aviso de categoria faltando é uma regra local. Só a ação **[Sugerir calçado]** chama a IA.

### 2.2 Vista-me

Botão **✨ Vista-me** no espelho. O pedido é em linguagem natural, por texto ou voz: *"Vou para a faculdade"*, *"Tenho uma apresentação hoje"*, *"Quero algo confortável"*, *"Quero usar esta jaqueta"*, *"Está frio hoje"*.

1. **Interpretação** (RF24): o pedido vira `{ occasion, mood, anchor_item_ids[], constraints[] }`. *"Quero usar esta jaqueta"* com a jaqueta em foco vira uma âncora obrigatória.
2. **Elegibilidade:** só peças **disponíveis** (RF31.CA02) e da estação ativa (RF35, Penthouse). Cesto, à venda e fora de estação ficam de fora.
3. **Geração:** reaproveita `ClaudeAutopilotService.generateCombinations` (`app/backend/services/ClaudeAutopilotService.ts`), que já combina ocasião, humor e clima sobre o guarda-roupa. A mudança é aceitar a âncora e as restrições.
4. **Validação anti-alucinação:** todo `wardrobe_item_id` devolvido tem que estar no conjunto elegível. Uma sugestão com ID fora dele é descartada inteira.
5. **Localização:** cada peça é resolvida para o endereço do §1.1. As posições **acendem em sequência** e aparece a legenda:
   `Camisa branca — Porta 2` · `Calça preta — Gaveta 4` · `Tênis branco — Sapateira`
6. O look aparece montado no espelho, com as ações **[Usar este look] [Trocar uma peça] [Remixar] [Salvar]**.

Diagrama: [`RF33_Vista-me_Atividades.puml`](RF33_Vista-me_Atividades.puml).

### 2.3 Integridade do Look do Dia

O Look do Dia é **sempre um Esquema** (`markdowns/RF6_HYPE_SCORE_CALCULO.md` §1). Por isso, "Usar este look" com um look que ainda não existe como esquema faz duas coisas: (a) cria o esquema com `origin = "smart_mirror"` ou `"vista_me"`, com a visibilidade padrão do perfil (RF3.CA12); (b) registra `saiDailyLooks` com `source = "vista_me"`. Nunca se registra um Look do Dia apontando para uma composição sem esquema.

### 2.4 Entrega para o Criar Look (RF5)

Hoje o canal `sessionStorage 'sai_scheme_inspiration'` (`app/views/CreateMySchemeView.tsx:183`) só preenche **título e estilo**. Para "Criar Look com estas peças", propõe-se um payload próprio:

```ts
// sessionStorage key: 'sai_room_look_draft'
type RoomLookDraft = {
  origin: 'smart_mirror' | 'vista_me' | 'copilot';
  slots: Partial<Record<'upper' | 'lower' | 'dress' | 'shoes' | 'outer_layer', string>>; // wardrobe_item_id
  accessories: string[];
  occasion?: string;
  prompt?: string; // texto original do Vista-me, se houver
  created_at: string;
};
```

O `CreateMySchemeView` passa a ler essa chave, preencher os slots e removê-la depois do consumo, com a mesma semântica da chave atual.

### 2.5 Critérios de aceitação

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF33.CA01 | usuário no quarto | arrasta uma peça para o espelho **ou** toca na peça e escolhe "Levar ao espelho" | a peça ocupa o slot do seu tipo e o look é iniciado. As duas interações são equivalentes (touch e acessibilidade) |
| RF33.CA02 | slot já ocupado | outra peça do mesmo tipo é levada ao espelho | a nova peça substitui a anterior, que volta à posição de origem com animação |
| RF33.CA03 | look sem categoria obrigatória | o espelho é atualizado | aparece o aviso determinístico ("Esse look ainda não possui calçado.") com a ação [Sugerir calçado] |
| RF33.CA04 | usuário aciona [Sugerir {categoria}] | a IA responde | as sugestões usam **somente** peças disponíveis do próprio usuário, levando em conta as peças já no espelho (**RF24.CA02**) |
| RF33.CA05 | usuário leva ao espelho uma peça indisponível (cesto) | a peça entra no slot | sistema aceita e avisa "está no cesto". A peça não pode virar Look do Dia enquanto estiver indisponível |
| RF33.CA06 | look completo no espelho | é exibido | aparecem as ações Salvar Look · Remixar · Look do Dia · Compartilhar · **Criar Look com estas peças** |
| RF33.CA07 | usuário aciona "Criar Look com estas peças" | confirma | abre o RF5 com os slots preenchidos a partir de `sai_room_look_draft` (§2.4) |
| RF33.CA08 | usuário aciona Vista-me com um pedido em linguagem natural | a IA responde | o look sugerido usa só peças elegíveis (§2.2 passo 2), respeita a peça âncora quando houver e aparece montado no espelho |
| RF33.CA09 | uma sugestão do Vista-me contém um ID fora do conjunto elegível | a resposta é validada no servidor | a sugestão é descartada, nunca exibida, e o evento é registrado (**RF24**, **RNF5**) |
| RF33.CA10 | sugestão do Vista-me exibida | o espelho é montado | as posições de cada peça acendem no ambiente e a legenda mostra "{peça} — {endereço}" |
| RF33.CA11 | usuário aciona "Usar este look" | confirma | sistema cria o esquema se necessário e registra o Look do Dia com `source = "vista_me"` (§2.3) |
| RF33.CA12 | usuário aciona "Trocar uma peça" num slot | a IA responde | aparecem até 3 alternativas para aquele slot, mantendo as demais peças |
| RF33.CA13 | usuário pede outra sugestão | a IA responde | a nova composição não repete nenhuma composição já mostrada na sessão (**RF10.CA03**) |
| RF33.CA14 | guarda-roupa sem peça superior nem vestido disponível | aciona Vista-me | sistema explica a limitação e oferece o cadastro (RF4) (**RF10.CA04**) |
| RF33.CA15 | serviço de IA indisponível ou acima do limite | aciona Vista-me | sistema monta a sugestão por regras locais (ocasião × tags) e sinaliza isso, sem travar a interface (**RNF8**) |

---

## 3. RF10 (estendido) — Copilot contextual

O Copilot deixa de ser uma ferramenta isolada e vira **a IA contextual do FashionAI**, com presença forte na Grade e em Meu Quarto.

### 3.1 Um motor, três portas de entrada

Autopiloto, Vista-me e Copilot **não** devem ser três serviços de recomendação diferentes. São **três formas de invocar o mesmo motor** (RF24):

| Entrada | Quem inicia | Contexto extra |
|---|---|---|
| Copilot (chat) | usuário, em qualquer visão | visão atual, seleção atual |
| Vista-me | usuário, no espelho | peças já no espelho, peça em foco |
| Autopiloto | agendamento diário/semanal | clima, agenda da semana |

### 3.2 Contexto por ferramentas, não por prompt gigante

Colocar o guarda-roupa inteiro no prompt não escala e vaza dado desnecessário. O Copilot recebe um **resumo compacto** (contagens, DNA, Inventory Score) e consulta o resto por **ferramentas** (tool use) executadas no servidor, com a sessão do usuário:

| Ferramenta | Retorno | Observação |
|---|---|---|
| `buscar_pecas(filtros)` | peças do usuário (id, nome, tipo, cor, tags, estado, uso) | só o próprio acervo. Indisponíveis marcadas |
| `localizar_peca(id)` | endereço no quarto (§1.1) | aciona o destaque visual |
| `historico_uso(id?)` | usos, último uso, looks em que participa | alimenta "esquecidas" e "mais usadas" |
| `listar_looks(filtros)` | esquemas próprios e Look do Dia | |
| `ler_dna_estilo()` | Camada 1. Camada 2 só se houver consentimento (**RNF6**) | campos privados nunca entram |
| `ler_inventory_score()` | nota, dimensões, deltas | para "Como melhorar meu inventário?" |
| `montar_no_espelho(ids)` | — (ação de UI) | devolve action chip |
| `abrir_criar_look(slots)` | — (ação de UI) | usa `sai_room_look_draft` |

**Resposta estruturada.** Toda menção a peça na resposta leva o `wardrobe_item_id`. O servidor valida (como no RF33.CA09) e a interface transforma essas menções em chips clicáveis. Exemplo:

> "Use sua **camisa branca Oversized**. Ela está na **Porta 2** e combina com sua **calça preta Wide Leg** da **Gaveta 3**."
> **[Ver peças] [Montar no espelho] [Criar Look]**

### 3.3 Diagnóstico do guarda-roupa e a salvaguarda contra publicidade disfarçada

Exemplos de diagnóstico: *"14 partes de cima para 3 partes de baixo"*, *"72% dos seus looks dependem de 3 peças"*, *"uma peça social azul-marinho aumentaria bastante suas combinações"*.

A terceira frase é útil, mas pode virar anúncio disfarçado. Regras:

1. **Reutilizar antes de comprar.** Uma sugestão de compra só aparece depois das sugestões de reuso (peças esquecidas, combinações inéditas) daquele diagnóstico.
2. **Critério objetivo e explicável.** Uma sugestão de compra só existe se a peça hipotética liberar um ganho mensurável de combinações válidas (`Δcombinações`, mesmo motor da dimensão Versatilidade). O ganho é mostrado ao usuário: *"+23 combinações possíveis"*.
3. **Genérica por padrão.** A sugestão descreve categoria, cor e ocasião, **nunca marca ou produto**, a menos que o usuário peça.
4. **Patrocínio separado e rotulado.** Qualquer conteúdo de Maison/marca aparece num bloco separado com o rótulo "Patrocinado", nunca dentro da resposta do Copilot.
5. **Opt-out.** O usuário pode desligar as sugestões de compra nas preferências (RF23).

### 3.4 Critérios de aceitação (novos)

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF10.CA08 | usuário em Grade, Meu Quarto ou Destaques | abre o Copilot | o Copilot sabe em qual visão o usuário está e o que está selecionado, e as sugestões de pergunta se adaptam a essa visão |
| RF10.CA09 | usuário pergunta "Onde está meu tênis branco?" | o Copilot responde | a resposta traz o endereço ("Sapateira · posição 4") e, se o usuário estiver em Meu Quarto, a posição acende no ambiente |
| RF10.CA10 | o Copilot cita peças na resposta | a resposta é exibida | toda peça citada é do acervo do usuário (ID validado no servidor) e vira chip com ações (Ver peça · Montar no espelho · Criar Look) |
| RF10.CA11 | usuário pergunta "Tenho roupa que não uso há muito tempo?" | o Copilot responde | lista as peças esquecidas ordenadas por tempo sem uso e oferece [Criar look com elas] |
| RF10.CA12 | usuário pede "algo diferente do que normalmente uso" | o Copilot responde | a sugestão maximiza a distância das combinações mais frequentes do histórico, usando só peças disponíveis |
| RF10.CA13 | usuário aciona "✨ Como melhorar meu inventário?" em Destaques | o Copilot responde | a explicação cita as 2 dimensões mais fracas do Inventory Score com números e traz ações diretas ([Ver peças esquecidas] [Criar look com elas] [Abrir Meu Quarto]) |
| RF10.CA14 | o Copilot faz uma sugestão de compra | é exibida | segue as regras §3.3 (reuso antes, Δcombinações visível, sem marca, patrocínio separado) |
| RF10.CA15 | dados de outro usuário | poderiam ser consultados | o Copilot só acessa o acervo do próprio usuário. De terceiros, só conteúdo público (**RNF1**) |
| RF10.CA16 | usuário desativa o uso da Identidade de Vida (RF13) | o Copilot responde | nenhum dado da Camada 2 do DNA entra no contexto enviado à IA (**RNF6**) |

---

## 4. RF34 — Destaques do Meu Inventário

Aba **🏆 Destaques** em Meu Guarda-Roupa. É a camada analítica, competitiva e social do inventário.

### 4.1 Composição da tela

```
┌──────────────────────────────────────────────┐
│  FAI Inventory Score        872   ▲ +34 mês  │
│  Catalogação 94  Diversidade 81  Utilização 76│
│  Versatilidade 91  Organização 88             │
│  Descoberta 70  Identidade 93                 │
│  [ ✨ Como melhorar meu inventário? ]          │
├──────────────────────────────────────────────┤
│  Seus Destaques                               │
│  🏆 Peça mais versátil · Jaqueta Jeans (21)    │
│  ❤️ Mais usada · Tênis Samba (17×)             │
│  💎 Peça Ícone · Casaco preto (98% DNA)        │
│  🔄 Melhor retorno · Calça (94 dias → 5 looks) │
│  🎨 Cor assinatura · Preto (32%)               │
│  👕 Categoria dominante · Camisetas (24)       │
├──────────────────────────────────────────────┤
│  Seu guarda-roupa evoluiu este mês            │
│  Score 838 → 872 · Reutilizadas 12 → 19       │
│  Looks únicos 18 → 31 · Esquecidas 14 → 7     │
├──────────────────────────────────────────────┤
│  Rankings  Global #2.841/185.420 · Brasil ·   │
│  Estilo · Sustentável · Versáteis · Rising    │
├──────────────────────────────────────────────┤
│  Conquistas  Curador · Segunda Chance · ...   │
└──────────────────────────────────────────────┘
```

A fórmula completa do score, a elegibilidade e o antifraude estão em [`02-inventory-score-calculo.md`](02-inventory-score-calculo.md).

### 4.2 Rankings

| Ranking | Ordena por | Observação |
|---|---|---|
| Global | Inventory Score | todos os elegíveis |
| País | Inventory Score | país do perfil |
| Cidade | Inventory Score | **só com consentimento explícito**. Só exibido se o grupo tiver ≥ 50 usuários (k-anonimato) |
| Faixa | Inventory Score | usuários na mesma faixa (comparação justa) |
| Estilo | Inventory Score | arquétipo do DNA (Streetwear, Minimalista, Formal, Vintage…) |
| Inventário Sustentável | Utilização + Descoberta | quem mais reaproveita as próprias peças |
| Mais Versáteis | Versatilidade | |
| Rising Wardrobe | Δ score em 30 dias | quem mais evoluiu |
| Colecionadores | **completude de coleções temáticas**, não número de peças | ver ressalva abaixo |

> **Ressalva, Colecionadores.** Esse ranking é o único que tende naturalmente a premiar volume, o que contradiz o §0.1 item 4. Por isso ele mede **completude** de uma coleção definida (por exemplo, 5 de 6 peças de uma coleção Maison, ou uma era completa), nunca a contagem bruta. Se o time não achar uma definição de coleção que não premie compra, este ranking deve sair do MVP.

### 4.3 Conquistas

| Conquista | Condição | Alimenta |
|---|---|---|
| 🏆 Curador | Catalogação ≥ 95 | FAI Points, Aura |
| ♻️ Segunda Chance | 10 peças esquecidas reutilizadas | FAI Points |
| 🎨 Camaleão | looks em 10 estilos diferentes | FAI Points |
| 👑 Signature Closet | Inventory Score ≥ 900 | FAI Points, animação no quarto (RF32 §1.2) |
| 🧠 Stylist | 50 combinações únicas do próprio inventário | FAI Points |
| 💎 Hidden Gem | uma peça esquecida entra no top 10 das mais usadas | FAI Points |

### 4.4 Critérios de aceitação

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF34.CA01 | usuário com ≥ 10 peças | abre Destaques | vê o Inventory Score (0–1000), as 7 dimensões (0–100) e o delta do mês |
| RF34.CA02 | usuário com menos de 10 peças | abre Destaques | vê o progresso ("faltam N peças para o seu Inventory Score") no padrão do RF13.CA02, sem nota parcial |
| RF34.CA03 | dois usuários, um com 30 peças completas e bem usadas e outro com 500 peças sem dados nem uso | o score é calculado | o primeiro tem score maior (teste de regressão obrigatório da fórmula) |
| RF34.CA04 | usuário sem DNA de Estilo gerado | o score é calculado | a dimensão Identidade é omitida e os pesos são renormalizados, **sem penalizar** |
| RF34.CA05 | score exibido | usuário toca numa dimensão | sistema mostra a regra dela em linguagem simples e os itens que mais puxam o valor para baixo |
| RF34.CA06 | usuário na aba | a página carrega | "Seus Destaques" traz até 6 cards gerados dos dados reais, cada um com ação para ver a peça ou abrir no quarto |
| RF34.CA07 | virada de mês | o usuário abre a aba | o bloco de evolução compara o snapshot atual com o do mês anterior (score, reutilizadas, looks únicos, esquecidas, versatilidade) |
| RF34.CA08 | usuário **optou** por participar de rankings | abre Rankings | vê a posição em cada ranking elegível. Sem opt-in, vê só o próprio score, sem aparecer para os outros (**RNF6**) |
| RF34.CA09 | ranking por cidade | o grupo da cidade tem menos de 50 participantes | o ranking por cidade não é exibido |
| RF34.CA10 | condição de conquista atingida | o score é recalculado | a conquista é concedida uma única vez (idempotente) e dispara os efeitos da tabela §4.3 |
| RF34.CA11 | comportamento suspeito (cadastros em massa com dados genéricos, looks repetidos para inflar uso) | o score é recalculado | as regras antifraude de [`02-inventory-score-calculo.md`](02-inventory-score-calculo.md) §5 neutralizam a contribuição |

---

## 5. RF35 — FAI Points e progressão do quarto

### 5.1 Princípios

- **FAI Points são conquistados pelo uso** e **não são vendidos por dinheiro real**. Se um dia houver monetização, Premium e Colabs Maison formam uma trilha comercial **separada**, que não compra progressão nem posição em ranking.
- Duas medidas separadas: **saldo** (gastável na loja do quarto) e **pontos vitalícios** (definem o nível e nunca diminuem).
- Os comportamentos que **melhoram o próprio FashionAI** pesam mais que as ações sociais.

### 5.2 Regras de ganho (rascunho para calibrar)

| Ação | Pontos | Limite |
|---|---|---|
| Cadastrar peça que passa no `catalog_readiness_score` | +25 | 10/dia |
| Completar os dados de uma peça (subir a completude para ≥ 90%) | +10 | 1× por peça |
| Gerar o modelo 3D da peça (RF16) | +15 | 1× por peça |
| Criar esquema | +40 | 5/dia |
| Resgatar peça esquecida (usar num look) | +30 | 3/dia |
| Usar um look do Vista-me como Look do Dia | +15 | 1/dia |
| Organizar o quarto (aplicar organização, nomear gavetas) | +20 | 1/semana |
| Conquistas (RF34 §4.3) | +100 a +500 | 1× cada |
| Curtida / comentário / remix **recebidos** | +1 / +2 / +10 | 50/dia no total |

Interação consigo mesmo não pontua. Todo ganho é registrado num **ledger append-only** com chave de idempotência `(user_id, action_code, ref_id)`.

### 5.3 Progressão: cada nível libera uma função

| Nível | Função liberada | Estética |
|---|---|---|
| **Estreia** | FAI Origem, Smart Mirror, Vista-me, Copilot, gavetas com categoria | branco de fábrica |
| **Studio** | iluminação guiada personalizável | primeiros acabamentos e materiais |
| **Loft** | +2 módulos e mais categorias próprias | quarto maior |
| **Closet** | sapateira, vitrine de bolsas, porta-joias (lugar próprio para cada categoria) | módulos especializados |
| **Atelier** | **ilha central = bancada de looks** (comparar 2–3 looks lado a lado) e regras automáticas de organização | ilha central |
| **Penthouse** | **troca de estação** (guardar peças fora de estação no maleiro, e o Vista-me passa a ignorá-las) | ambiente premium |
| **Maison** | closet de assinatura, itens exclusivos, Colabs Maison | closet de assinatura |

### 5.4 Loja do quarto: o "Molde de Fábrica"

Cada elemento é **Molde** (forma fixa, com medidas e pontos de encaixe) + **Acabamento** (cor · textura · tamanho · logo) = **SKU**, por exemplo `FAI-PRT-AB60-NVY-LAC`. Os tamanhos seguem regra de encaixe (porta de 90 cm só cabe em módulo de 90 cm). Toda compra tem "Provar no meu quarto" antes. Raridades: Básico · Premium · Signature · Edição Limitada (numerada) · Colab Maison.

### 5.5 Critérios de aceitação

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF35.CA01 | ação elegível concluída | o evento é processado | o ledger ganha um lançamento idempotente. O mesmo evento processado duas vezes não duplica pontos |
| RF35.CA02 | limite diário da ação atingido | nova ação do mesmo tipo | a ação acontece normalmente, sem gerar pontos, e o usuário vê que o limite foi atingido |
| RF35.CA03 | usuário compra um item | confirma | o saldo diminui, os pontos vitalícios e o nível não mudam |
| RF35.CA04 | pontos vitalícios atingem o limiar do próximo nível | o evento é processado | o nível sobe, a função da tabela §5.3 é liberada e o quarto mostra a evolução com animação |
| RF35.CA05 | qualquer nível e qualquer saldo | usuário cadastra peça, usa o espelho, o Vista-me ou o Copilot | a função está disponível (§0.1) |
| RF35.CA06 | item da loja | usuário aciona "Provar no meu quarto" | o item aparece aplicado na cena sem compra e com o saldo intacto. A prévia é descartada ao sair |
| RF35.CA07 | item incompatível com os módulos (regra de encaixe) | usuário tenta aplicar | sistema bloqueia e indica em quais módulos o item cabe |
| RF35.CA08 | a plataforma | oferece FAI Points | não há compra de FAI Points com dinheiro real |

---

## 6. Arquitetura técnica

| Camada | Escolha | Motivo |
|---|---|---|
| Cena | **React Three Fiber** (three.js) + drei | O `<model-viewer>` atual mostra um GLB por vez e não compõe uma cena |
| Móveis | **Geometria paramétrica**: molde = função(params) → geometria, acabamento = dado (PBR) | 200 itens na loja = 200 linhas no banco, sem 200 arquivos 3D |
| Peças | plano com `approved_catalog_2d_url` (PNG sem fundo). GLB quando existir `model_3d_url` | leve no celular. Aproveita o pipeline do RF16 |
| Estilo visual | editorial + jogo 3D premium + interior design, câmera 3/4 limitada, sombras suaves, environment map | "este é o meu closet digital", não um configurador de móveis |
| Materiais | catálogo único compartilhado com `app/lib/materialPresets.ts` | a mesma loja pode vender skins de card |
| IA | motor único (RF24) com tool use (§3.2) e validação de IDs no servidor | três entradas, um motor |
| Fallback | modo 2.5D + regras locais | RNF7, RNF8 |

### 6.1 Modelo de dados (coleções/tabelas novas)

| Entidade | Campos principais |
|---|---|
| `saiRoomLayouts` | `user_id`, `version`, `level`, `modules[]` (molde, SKU aplicado, posição), `drawer_labels{}` |
| `saiRoomStorageMap` | `user_id`, `wardrobe_item_id`, `address` (§1.1), `assigned_by` (`auto`/`user`/`ai`), `updated_at` |
| `saiRoomCatalog` | `sku`, `mold_id`, `slot_type`, `dimensions`, `finish{color, texture, roughness}`, `rarity`, `price_points`, `required_level`, `stock_limit`, `maison_brand_id?` |
| `saiRoomInventory` | `user_id`, `sku`, `serial?`, `source` (`purchase`/`reward`), `acquired_at` |
| `saiFaiPointsRules` | `action_code`, `points`, `daily_cap`, `active` |
| `saiFaiPointsLedger` | `user_id`, `delta`, `action_code`, `ref_type`, `ref_id`, `idempotency_key` (único), `created_at` |
| `saiInventoryScoreSnapshots` | `user_id`, `period` (dia/mês), `score`, `dimensions{}`, `eligible`, `computed_at` |
| `saiWardrobeAvailabilityLog` | `wardrobe_item_id`, `user_id`, `available`, `changed_at` (histórico de transições do RF31, base da população de exposição da Utilização em [`02`](02-inventory-score-calculo.md) §3.3) |
| `saiUserAchievements` | `user_id`, `achievement_code`, `granted_at` (único por par) |
| `saiRankingOptIns` | `user_id`, `opted_in`, `share_city`, `updated_at` |

O `saiDailyLooks.source` ganha os valores `"vista_me"` e `"smart_mirror"`, e o esquema ganha `origin` com os mesmos valores.

---

## 7. Plano de entrega

| Fase | Escopo | Passa no teste §0.1? |
|---|---|---|
| **1 — Núcleo útil** | Grade \| Meu Quarto, FAI Origem com peças reais, endereçamento, abrir porta/gaveta, Smart Mirror manual, "Criar Look com estas peças", "Mostrar no quarto", modo 2.5D | ✅ sem gamificação nenhuma |
| **2 — Inteligência** | Vista-me com localização, Copilot contextual (ferramentas §3.2), Destaques com Inventory Score, Seus Destaques e evolução mensal | ✅ |
| **3 — Gamificação** | FAI Points (ledger), níveis com funções, loja com moldes/acabamentos e "Provar no meu quarto", conquistas, estados visuais completos | recompensa por cima |
| **4 — Comunidade** | rankings com opt-in, Room Tour, drops, Colabs Maison, diagnóstico com sugestão de compra (§3.3) | recompensa por cima |

A sub-aba **Desafios** (RF36) entra nas fases 3 e 4, com o detalhamento em [`03-desafios-e-games.md`](03-desafios-e-games.md) §10. Os detalhes de engajamento têm fase própria, item a item, em [`04-detalhes-de-engajamento.md`](04-detalhes-de-engajamento.md).

---

## 8. Decisões em aberto

1. **Copilot com voz** no Vista-me: entra no MVP ou fica para depois (custo de STT)?
2. **Rankings:** opt-in (recomendado, LGPD) ou opt-out para perfis públicos?
3. **Colecionadores:** existe uma definição de coleção que não premie compra? Senão, sai do MVP (§4.2).
4. **Peças à venda:** confirmar se "Para vender" continua existindo no produto novo, já que não aparece no RF31.
5. **Limiares de nível** (pontos vitalícios por nível): calibrar para ~1 semana até o Studio e ~2 meses até o Closet com uso ativo.
