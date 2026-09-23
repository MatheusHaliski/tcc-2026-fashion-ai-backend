# RF11 — Proposta: Container Automático entre Skins Editoriais e Presets Aura

**Projeto:** FashionAI (SAI-TCC-2026)
**Requisito Funcional:** RF11 — Configurar o Visual do Card (Background Studio)
**Base:** `anatomias_card_v13.html` (container do esquema), `RF11_PROPOSTA_PRESETS_AURA_E_MATERIAIS.md`, `RF11_PROMPTS_SKINS_CARD.md`
**Complementa:** `RF11_Configurar_Visual_Card_Atividades.puml`

---

## 1. O conflito

Dois sistemas do RF11 competem pelo mesmo espaço visual sem nenhuma regra de coexistência hoje:

- **Skins de card** (`CardSkinId`: Atelier, Spread, Índice, Trading, FAI Max, Stub, Specimen) — definem tipografia, densidade de chrome e moldura própria.
- **Presets AURA / Material** (`RF11_PROPOSTA_PRESETS_AURA_E_MATERIAIS.md`) — geram arte de background, deliberadamente exuberante em vários casos (`aura_streetwear_neon` "Concrete Neon", `aura_avantgarde_cromo` "Chrome Iridescent", materiais como `laminado_metalico`).

Alguns skins já têm moldura própria absorvendo esse tipo de arte sem problema — **Trading** (moldura dupla cinza+branca), **FAI Max** (borda laranja grossa), **Stub** e **Specimen** (decoração própria: zigue-zague, papel milimetrado). Mas três skins são deliberadamente **finos** — tipografia delicada, pouca ou nenhuma moldura, conteúdo quase encostado na borda:

- **Atelier** — branco puro, Inter, hairlines
- **Spread** — editorial de magazine, título grande sobre hero full-bleed
- **Índice** — cartão de referência, linhas com líder pontilhado

Um preset Aura "exorbitante" atrás de um título Georgia fino em branco puro quebra o próprio motivo de existir do skin. É esse conflito específico que a proposta resolve.

---

## 2. A peça que faltava: o container do esquema (v13)

`anatomias_card_v13.html` formaliza um elemento de anatomia que antes só existia implícito: uma borda interna que separa, dentro do card, **o chrome social do post** (avatar, autor, data, curtidas — fora da borda) **do `ClothesScheme` em si** (fundo/composição, título, selos, preço, descrição, peças — dentro da borda). É estrutura base das três anatomias de Esquema (Lista vertical, Grade de peças, Foto hero + lista lateral) — não se aplica a Peça, que é outra entidade.

Isso já existia parcialmente no RF11 como "cor do container" (Etapa 4, opção 3) — mas era uma escolha manual, opcional, sem ligação com o skin ativo. A v13 eleva esse container a **estrutura sempre presente**; esta proposta usa essa estrutura já formalizada como o mecanismo de separação, em vez de inventar um elemento novo.

---

## 3. A regra proposta

**Container de conteúdo passa a ter uma cor e uma origem, não só uma cor.** A origem tem três valores possíveis:

| Origem | Quando | Cor do container |
|---|---|---|
| `indefinida` *(padrão)* | Nenhuma decisão foi tomada ainda — nem o usuário definiu manualmente, nem a "Direção recomendada" foi aplicada | Sem preenchimento próprio (padrão neutro, herdado do background) |
| `manual` | Usuário escolheu explicitamente, a qualquer momento (Etapa 4 ou reabrindo "3. Cor do container") | A cor escolhida, nunca sobrescrita automaticamente depois — **exceto** pela "Direção recomendada" (ver seção 3.6) |
| `auto` | A "Direção recomendada" foi aplicada — **único gatilho de ativação automática** desta proposta | Travada na cor nativa do skin ativo no momento; nunca recalculada depois (ver `obrigatorio`, seção 3.6) |

A origem é o que faz o estado ser **persistente e não recalculado a cada abertura do editor** — ver seção 3.5.

Além da origem, `ConfiguracaoContainer` ganha um segundo campo, sempre acoplado a `origem = 'auto'`: `obrigatorio: Boolean`. Toda vez que `origem` é `'auto'` nesta proposta, `obrigatorio` é `true` — não existe mais um estado "auto, mas ainda reversível" (ver seção 3.6 para o histórico dessa decisão).

### 3.1 Classificação de família de skin (referência, não gatilho)

| Família | Skins | Motivo |
|---|---|---|
| **Editorial fina** | Atelier, Spread, Índice | Tipografia delicada, hairlines, pouca/nenhuma moldura própria — conteúdo fica exposto direto sobre o que estiver atrás |
| **Framed / com moldura própria** | Trading, FAI Max, Stub, Specimen | Já têm chrome grosso, decoração ou moldura dupla que absorve arte exuberante por design |

Esta classificação **não aciona mais nada automaticamente** (ver seção 3.2) — fica documentada aqui porque explica a motivação original do problema (seção 1) e porque pode ser reaproveitada no futuro para um aviso não-bloqueante na UI ("esta combinação pode reduzir a legibilidade"), sem reintroduzir uma trava automática.

### 3.2 Gatilho por família de skin — retirado

Uma versão anterior desta proposta auto-ativava o container sempre que `tipoDeCard === ESQUEMA AND familia(skinAtivo) === 'editorial_fina' AND (arte exuberante OU material aplicado)`, com a origem `auto` sendo **recalculada a cada mudança de skin ou arte** enquanto o usuário não sobrepusesse manualmente.

**Essa reativação automática foi removida.** Decisão de produto: fora da "Direção recomendada" (seção 3.6), o container é sempre **opcional e sob controle total do usuário** — Preset Aura (sozinho), Material (sozinho), Aura + Material (combinados), Cor sólida e Gradiente nunca pré-selecionam ou travam a cor do container, **mesmo sobre um skin editorial fino**. O usuário decide se quer usar o container e qual cor, via Etapa 4 ou reabrindo "3. Cor do container" — sem nenhum valor sugerido automaticamente por trás.

Motivo: a auto-ativação reativa por skin+arte gerava uma trava "surpresa" para qualquer combinação exuberante, mesmo quando o usuário não pediu nenhuma recomendação — bastava escolher manualmente um Preset Aura vistoso num skin fino. Restringir a proteção automática a um único gatilho explícito (aplicar a recomendação da IA) torna o comportamento mais previsível: **o container só vira decisão do sistema quando o próprio sistema decidiu a arte.**

### 3.3 O que acontece quando o container é obrigatório (único caso automático)

- **Dentro do container:** cor nativa do skin ativo no momento em que a "Direção recomendada" foi aplicada (Atelier → branco puro; Spread → neutro claro; Índice → branco + borda; qualquer skin framed → sua própria cor nativa), travada — a arte com IA não pode pintar por trás do título/descrição/peças.
- **Fora do container, dentro da borda do card:** a arte com IA continua rodando livre — vira efeito de **passe-partout** (moldura/paspatur), como uma moldura de quadro: a arte exuberante emoldura o painel de conteúdo, em vez de competir com ele.
- **Não há escape hatch.** Diferente de uma versão anterior desta proposta, não existe mais "usar cor customizada mesmo assim" — ver seção 3.6, efeito 4. Trocar a direção visual da Arte com IA para algo que não seja a "Direção recomendada" impede o gatilho de disparar de novo, mas **não reverte** o que já foi travado para este esquema — não há, dentro deste fluxo, nenhuma ação que desfaça `obrigatorio` uma vez que ele vira `true` (seção 3.6, efeito 5).

Nos demais casos (Preset Aura, Material, Aura + Material, Cor sólida, Gradiente), nada disto se aplica: o container mantém a cor que o usuário deixou (manual) ou permanece neutro/indefinido.

### 3.4 Por que não desligar a Aura, em vez de conter o texto

Alternativa descartada: quando a "Direção recomendada" resulta numa combinação exuberante, simplesmente **bloquear** a arte em vez de proteger o texto com um container. Rejeitada porque:
- Tira controle do usuário sem necessidade — o efeito passe-partout resolve o conflito sem remover a opção.
- O usuário pode *querer* exatamente esse contraste (arte ousada emoldurando um painel editorial limpo) — é um resultado legítimo; só precisa da separação estrutural para funcionar.

### 3.5 Persistência da origem (por que a cor sozinha não basta)

Guardar só a cor final não sustenta as três origens da tabela da seção 3:

- Sem uma origem persistida, não há como distinguir uma cor `manual` (escolha deliberada do usuário) de uma cor `indefinida` que por acaso coincide com o padrão neutro.
- Depois que a "Direção recomendada" trava o container (`origem = 'auto'`, `obrigatorio = true`), essa informação precisa sobreviver a reaberturas do editor e a sobreposições futuras de arte — sem persistência, o sistema não teria como saber que aquela cor não deve mais ser tratada como editável.

Por isso `ConfiguracaoContainer` ganha os campos `origem` (`indefinida | manual | auto`) e `obrigatorio` (Boolean), persistidos junto com a cor. A leitura, ao reabrir "3. Cor do container", passa a ser: **`obrigatorio` é `true`? Informa que está travado, não oferece edição. Senão, `origem` já é `manual`? Usuário edita livremente. Senão, seletor abre neutro, sem nenhuma sugestão.**

### 3.6 Por que `auto` virou sempre obrigatório (histórico da decisão)

Uma versão anterior desta proposta tratava `auto` como reversível — recalculado a cada mudança de skin ou arte (seção 3.2, agora retirada), com um `obrigatorio: Boolean` adicional só para o caso específico da "Direção recomendada", que travava permanentemente. Com a retirada do gatilho reativo (seção 3.2), **`auto` só tem uma origem possível agora — a "Direção recomendada" — então `origem = 'auto'` e `obrigatorio = true` sempre andam juntos**, sem cenário remanescente em que um exista sem o outro.

```
aplicarDirecaoRecomendada() ⇒
  SE containerExisteParaEsteCard(tipoDeCard, anatomiaEscolhida):
    ConfiguracaoContainer.origem = 'auto'
    ConfiguracaoContainer.obrigatorio = true
    // cor travada na cor nativa do skin ativo no momento
```

Efeitos, em ordem de precedência sobre as demais regras desta proposta:

1. **Independe da família do skin.** Aplica-se sobre qualquer skin ativo — inclusive Trading, FAI Max, Stub ou Specimen, que nunca disparariam a antiga regra da seção 3.2.
2. **Sobrescreve uma origem `manual` anterior.** É a única exceção à regra da seção 3.5 ("uma escolha manual nunca é sobrescrita silenciosamente") — não é silenciosa porque é consequência direta de uma ação explícita do usuário (aplicar a direção recomendada), não de uma reavaliação de fundo.
3. **Não é recalculado por sobreposições futuras.** Trocar de Preset Aura manualmente (`+AURA`), aplicar ou trocar um Material (`+material`), ou mesmo trocar de skin, **não desativam** `obrigatorio` nem destravam a cor — não há mais nenhuma verificação reativa que pudesse fazer isso (seção 3.2).
4. **Não tem escape hatch.** Diferente do comportamento reativo já retirado, não existe "usar cor customizada mesmo assim" — reabrir o seletor de cor do container apenas informa que ele está travado.
5. **Não existe reset automático.** `obrigatorio` é um flag de uma via (`false → true`) dentro desta proposta — reavaliar se algum fluxo deveria zerá-lo (ex.: remover a arte gerada pela direção recomendada) fica fora de escopo aqui.

Mantemos os dois campos (`origem` e `obrigatorio`) em vez de colapsar em um único booleano porque `origem` já distinguia `manual` de "não escolhido", e um único campo perderia essa distinção — `obrigatorio` documenta explicitamente *por que* aquele valor `auto` não pode ser editado, o que também deixa a intenção clara para quem ler o modelo de dados sem o contexto desta proposta.

---

## 4. Mapeamento para o modelo de dados existente

Dois campos novos são necessários:

- **Novo:** `ConfiguracaoContainer.origem: 'indefinida' | 'manual' | 'auto'`, persistido junto com `ConfiguracaoContainer.cor` (RF11, diagrama de classes).
- **Novo:** `ConfiguracaoContainer.obrigatorio: Boolean` (default `false`), persistido junto com `origem` e `cor`. Setado para `true` apenas por `aplicarDirecaoRecomendada()` (seção 3.6) — sempre em conjunto com `origem = 'auto'`.
- `CardSkinId` (`app/lib/outfit-card.ts`) **não** precisa mais de uma tabela de classificação `SKIN_VISUAL_FAMILY` para esta proposta — a família de skin (seção 3.1) deixou de ser lida por qualquer gatilho automático. Fica registrada só como documentação; implementar essa tabela é opcional e fora de escopo aqui.
- O efeito "passe-partout" é só CSS: a arte já ocupa o background do card (`OutfitBackgroundConfig`); o container de conteúdo já é uma camada por cima (`ConfiguracaoContainer`) — a regra apenas decide, automaticamente, o preenchimento dessa camada em vez de deixá-la vazia/manual, e só faz isso quando `aplicarDirecaoRecomendada()` roda.

---

## 5. Escopo

- Aplica-se apenas a cards de **Esquema** (a única entidade que tem "container do esquema" formalizado na v13; Peça não tem esse elemento de anatomia). Para DNA de Estilo, o container (v2 do documento de anatomia do DNA) sempre existe estruturalmente, independente de skin — esta proposta não introduz nenhum comportamento automático adicional para DNA além do que já é estrutural.
- A escolha do skin ativo (Atelier/Spread/.../Specimen) ainda não está modelada no `.puml` do RF11 — é uma feature já existente no código (`selectedCardSkin`/`onSelectSkin`), documentada separadamente em `RF11_PROMPTS_SKINS_CARD.md`. Esta proposta assume o skin como um estado já definido antes de entrar em "Arte com IA", sem modelar sua própria seleção aqui.
