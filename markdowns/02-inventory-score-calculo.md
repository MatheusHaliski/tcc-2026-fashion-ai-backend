# RF34 — FAI Inventory Score: cálculo, elegibilidade e antifraude

**Projeto:** FashionAI (SAI-TCC-2026)
**Requisito Funcional:** RF34 — Destaques do Meu Inventário
**Complementa:** [`01-especificacao-meu-quarto.md`](01-especificacao-meu-quarto.md) §4
**Indicador irmão (não misturar):** Hype Score, em [`RF6_HYPE_SCORE_CALCULO.md`](../../markdowns/RF6_HYPE_SCORE_CALCULO.md)

---

## 1. O que o score mede

> **Quão desenvolvido, versátil e bem utilizado é o guarda-roupa, independentemente do tamanho dele?**

O score vai de 0 a 1000 e é a média ponderada de 7 dimensões, cada uma de 0 a 100.

### 1.1 Rubrica absoluta, não percentil

O Hype Score normaliza por percentil porque responde a uma pergunta **relativa** (relevância frente à comunidade). O Inventory Score responde a uma pergunta **sobre o próprio guarda-roupa**, então cada dimensão é uma **rubrica absoluta**: uma razão ou média calculada só com os dados do usuário.

Isso garante duas propriedades:

1. **Controle do usuário.** A nota só muda quando o guarda-roupa do usuário muda. Ela não cai porque outros melhoraram.
2. **Explicabilidade.** Toda dimensão tem uma regra que cabe numa frase ("62% das suas peças disponíveis foram usadas nos últimos 90 dias"), que é o que o Copilot usa no RF10.CA13.

O percentil entra **só no ranking** (§6).

---

## 2. Princípio anti-quantidade

> Alguém precisa conseguir melhorar o Inventory Score **sem comprar nenhuma roupa nova**.

Todas as dimensões são **razões, médias ou entropias normalizadas**, nunca contagens absolutas. O número de peças entra num único lugar, o **fator de confiança** $k$ (§4), que satura em 20 peças. Acima de 20 peças, o volume **não vale nada**.

Teste de regressão obrigatório (RF34.CA03): 30 peças completas, diversas e usadas > 500 peças sem dados e sem uso. Estimativa com as regras do §3:

| Dimensão | 30 peças bem curadas | 500 peças só com categoria, sem uso |
|---|---|---|
| $C$ | ~90 | ~15 |
| $D$ | ~75 | ~30 (sem cor, estilo nem ocasião) |
| $U$ | ~70 | 0 |
| $V$ | ~80 | 0 (sem ocasião → sem combinação válida; sem looks) |
| $R$ | ~70 | 0 (nenhum resgate, nenhum look inédito) |
| $O$ | ~85 | ~55 (endereços automáticos coerentes, gavetas sem rótulo) |
| $I$ | ~85 | omitida (sem DNA) |
| **Score** | **~790** | **~130** |

---

## 3. Dimensões

Notação: $P$ = peças do acervo, $A \subseteq P$ = peças disponíveis (RF31), $n = |P|$.

### 3.1 Catalogação ($C$)

Média da completude de cada peça:

$$C = \frac{1}{n}\sum_{p \in P} \text{compl}(p)$$

| Campo | Peso na completude |
|---|---|
| categoria (`piece_type`) | 15 |
| cor | 15 |
| ocasiões (≥ 1) | 15 |
| estilos (≥ 1) | 15 |
| imagem aprovada (`approved_catalog_2d_url`) | 15 |
| material | 10 |
| marca | 10 |
| modelo 3D (`model_3d_url`) | 5 |
| **total** | **100** |

O 3D pesa pouco de propósito: ele depende de pipeline externo (RF16, *stretch goal*) e o usuário não deve ser punido por uma falha de geração.

### 3.2 Diversidade ($D$)

Variedade **útil** das peças disponíveis. Usa a entropia de Shannon normalizada por atributo:

$$\hat H(X) = \frac{-\sum_i f_i \ln f_i}{\ln m}$$

em que $f_i$ é a fração das peças de $A$ no valor $i$ do atributo e $m$ é o número de valores possíveis do atributo (se $m \le 1$, $\hat H = 0$).

$$D = 100 \times \Big(0{,}25\,\hat H(\text{categoria}) + 0{,}25\,\hat H(\text{cor}) + 0{,}25\,\hat H(\text{estilo}) + 0{,}25\,\text{Cob}_{ocasião}\Big)$$

$\text{Cob}_{ocasião}$ é a fração das ocasiões de referência (faculdade/trabalho, casual, social, esporte, festa) para as quais existe **ao menos uma combinação completa válida** (§3.4). É o termo "útil": ter 10 cores sem nenhum calçado para ocasião social não é diversidade útil.

### 3.3 Utilização ($U$)

A Utilização **não** usa o conjunto $A$ do instante do cálculo. Se usasse, bastaria marcar as peças paradas como indisponíveis logo antes do recálculo para tirá-las do numerador e do denominador ao mesmo tempo, inflando $U$. Por isso ela usa uma **população de exposição** na janela de 90 dias:

$$E = \{p \in P : p \text{ esteve disponível por } \ge 7 \text{ dias da janela}\}$$

$$U = \begin{cases} 100 \times \dfrac{|\{p \in E : \text{usada na janela}\}|}{|E|} & \text{se } |E| > 0 \\[2mm] 0 & \text{se } |E| = 0 \end{cases}$$

- **Exposição:** os dias de disponibilidade saem do histórico de transições de disponibilidade (RF31), que precisa ser registrado com data (`saiWardrobeAvailabilityLog`: `wardrobe_item_id`, `available`, `changed_at`). Uma peça marcada como indisponível ontem, depois de 80 dias disponível, continua em $E$ e continua contando como não usada.
- **Mínimo de 7 dias:** evita que uma peça cadastrada na véspera do recálculo pese como se tivesse tido a janela inteira para ser usada.
- **$E$ vazio vale 0**, e não omite a dimensão. Omitir abriria o caminho inverso: marcar tudo como indisponível para tirar $U$ da média.
- **"Usada"** = participou de um esquema criado ou editado na janela, ou de um Look do Dia registrado na janela (`saiDailyLooks`). Cada peça conta **no máximo uma vez por dia** (§5).

### 3.4 Versatilidade ($V$)

**Combinação válida:** (`upper` + `lower` + `shoes`) ou (`dress` + `shoes`), com peças de $A$ que tenham **ao menos uma ocasião em comum**. Peça sem nenhuma ocasião cadastrada **não forma combinação válida**: se fosse tratada como coringa, um acervo enorme e sem dados teria Versatilidade máxima, o que quebraria o §2.

$$V = 100 \times \Big(0{,}6 \times \text{Conect} + 0{,}4 \times (1 - \text{Conc})\Big)$$

- $\text{Conect}$ = fração das peças de $A$ que participam de **≥ 3** combinações válidas. Mede equilíbrio: 14 partes de cima para 3 de baixo deixam as de baixo conectadas, mas muitas combinações dependem das mesmas 3.
- $\text{Conc}$ = concentração: fração das aparições de peças nos looks dos últimos 90 dias que vêm das **3 peças mais usadas**. É o "72% dos seus looks dependem de 3 peças" do diagnóstico. Se não houver looks na janela, o termo $(1 - \text{Conc})$ vale **0**: sem uso real não há evidência de versatilidade em uso.

$\text{Conect}$ é uma **fração**, não uma contagem de combinações. Contar combinações cresce de forma combinatória com o volume e quebraria o §2.

### 3.5 Organização ($O$)

$$O = 100 \times \Big(0{,}5 \times \text{Coer} + 0{,}3 \times \text{Rot} + 0{,}2 \times \text{Rev}\Big)$$

- $\text{Coer}$ = fração das peças cujo endereço no quarto (`saiRoomStorageMap`) é coerente com o tipo e a categoria da gaveta (calça numa gaveta "Jeans" ou sem rótulo = coerente; calça em "Academia" sem tag de esporte = incoerente).
- $\text{Rot}$ = fração das gavetas ocupadas que têm rótulo (dado pelo usuário ou aceito da IA).
- $\text{Rev}$ = 1 − fração das peças **indisponíveis há mais de 30 dias sem revisão** (o cesto esquecido).

### 3.6 Descoberta ($R$)

$$R = 100 \times \Big(0{,}5 \times \text{Resg} + 0{,}5 \times \text{Inéd}\Big)$$

- $\text{Resg}$ = taxa de resgate nos últimos 90 dias, sobre as **oportunidades distintas de resgate**:

  $$F = F_0 \cup F_{jan}, \qquad \text{Resg} = \frac{|\{p \in F : p \text{ voltou a um look depois de ficar esquecida}\}|}{|F|}$$

  em que $F_0$ = peças esquecidas (60+ dias sem uso) no início da janela e $F_{jan}$ = peças que ficaram esquecidas durante a janela. Cada peça entra **uma vez só** no denominador: somar "esquecidas no início" com "resgatadas" contaria duas vezes as resgatadas de $F_0$ (resgatar todas as 10 esquecidas daria $10/(10+10) = 0{,}5$ em vez de $1$). Como toda peça resgatada pertence a $F$, $\text{Resg} \in [0, 1]$. Se $F = \varnothing$ (nenhuma peça esquecida), $\text{Resg} = 1$: não ter peças esquecidas não é defeito.
- $\text{Inéd}$ = fração dos looks da janela que contêm **ao menos um par de peças nunca combinado antes**. Se não houver looks na janela, $\text{Inéd} = 0$, pelo mesmo motivo do $\text{Conc}$ (§3.4): sem looks não há evidência de descoberta. É o caso comum do primeiro uso, e ele precisa dar um valor definido.

### 3.7 Identidade ($I$)

Correspondência entre o inventário e o DNA de Estilo (RF13, Camada 1):

$$I = 100 \times \Big(0{,}5 \times \cos(\vec c_{inv}, \vec c_{DNA}) + 0{,}5 \times \cos(\vec s_{inv}, \vec s_{DNA})\Big)$$

- $\vec c$ = distribuição de cores (paleta de 5 cores do DNA contra a distribuição de cores de $A$, com as cores agrupadas em famílias).
- $\vec s$ = distribuição de estilos (arquétipo do DNA expandido em tags contra as tags de estilo de $A$).

**Sem DNA gerado, $I$ é omitida** e os pesos das outras dimensões são renormalizados (RF34.CA04). Só a Camada 1 entra: a Identidade de Vida (Camada 2) nunca é usada no score (**RNF6**).

---

## 4. Score final

| Dimensão | Peso $w$ |
|---|---|
| Catalogação $C$ | 0,20 |
| Utilização $U$ | 0,20 |
| Versatilidade $V$ | 0,15 |
| Descoberta $R$ | 0,13 |
| Diversidade $D$ | 0,12 |
| Organização $O$ | 0,10 |
| Identidade $I$ | 0,10 |
| **total** | **1,00** |

$$S_{bruto} = 10 \times \frac{\sum_d w_d \cdot d}{\sum_d w_d} \quad (d \text{ nas dimensões disponíveis})$$

$$\boxed{\text{InventoryScore} = \operatorname{round}\big(S_{bruto} \times k\big)}, \qquad k = \min\!\Big(1, \frac{n}{20}\Big)$$

**Por que Catalogação e Utilização pesam mais:** são as duas dimensões que mais melhoram o próprio FashionAI (dados melhores → sugestões melhores) e as mais diretamente sob controle do usuário.

**Por que $k$ existe:** sem ele, 3 peças perfeitas dariam 1000. O fator exige um guarda-roupa mínimo para a nota ser representativa e deixa de agir a partir de 20 peças. **Elegibilidade:** o score é exibido a partir de 10 peças (RF34.CA02, mesmo limiar do RF13.CA01). Entre 10 e 19 peças, a interface mostra o $k$ ("sua nota cresce até 20 peças").

### 4.1 Faixas

| Faixa | Score | Rótulo |
|---|---|---|
| 1 | 0–299 | Em Montagem |
| 2 | 300–499 | Organizado |
| 3 | 500–649 | Versátil |
| 4 | 650–799 | Bem Curado |
| 5 | 800–899 | Closet Inteligente |
| 6 | 900–959 | Signature Closet |
| 7 | 960–1000 | Maison Closet |

---

## 5. Antifraude

| Tentativa de inflar | Dimensão | Neutralização |
|---|---|---|
| Preencher campos com lixo | $C$ | as tags precisam ser coerentes com a detecção da IA no RF4. Um campo divergente com confiança alta da IA conta como 50% |
| Cadastrar muitas peças genéricas | $C$, $D$ | as dimensões são médias e razões. Volume puxa a média para baixo, não para cima |
| Criar looks descartáveis para "usar" peças | $U$, $R$ | cada peça conta 1×/dia. Um look precisa ter ≥ 2 peças e sobreviver 24 h (esquema apagado antes disso não conta) |
| Alternar disponível/indisponível | $O$, $U$ | $U$ usa a população de exposição $E$ da janela (§3.3), não o conjunto disponível no instante do cálculo. Marcar uma peça como indisponível não a tira do denominador |
| Reorganizar o quarto em ciclos | $O$ | $O$ mede o estado, não a quantidade de mudanças. Reorganizar não pontua de novo |

---

## 6. Rankings

O ranking é o único lugar que usa percentil. A posição de cada usuário é calculada **dentro do segmento** entre os participantes com opt-in (RF34.CA08):

$$\text{Top}\% = 100 \times \frac{N_{seg} - \text{posição} + 1}{N_{seg}}$$

(mesma construção da fatia superior inclusiva do `markdowns/RF6_HYPE_SCORE_CALCULO.md` §4.1, com a posição em ordem crescente e 1-indexada).

| Ranking | Chave de ordenação |
|---|---|
| Global / País / Cidade / Faixa / Estilo | InventoryScore |
| Inventário Sustentável | $0{,}5\,U + 0{,}5\,R$ |
| Mais Versáteis | $V$ |
| Rising Wardrobe | $\Delta$InventoryScore em 30 dias (exige ≥ 30 dias de histórico) |

Cidade só com consentimento explícito e só exibida para grupos com ≥ 50 participantes.

---

## 7. Cadência de cálculo

- **On-demand** ao abrir Destaques, com cache de 1 h por usuário. As entradas são dados do próprio usuário, então o custo é proporcional a $n$.
- **Snapshot diário** em `saiInventoryScoreSnapshots` (base para a evolução mensal, o Rising Wardrobe e as conquistas).
- **Job de ranking** a cada poucas horas: materializa as posições por segmento, com a mesma lógica de job periódico descrita no `markdowns/RF6_HYPE_SCORE_CALCULO.md` §7.
- A contagem de combinações válidas (§3.4) é $O(|upper| \cdot |lower| \cdot |shoes|)$. Para acervos grandes, contar por grupos de ocasião em vez de enumerar triplas: dentro de um grupo, o número de combinações de uma peça superior é $|lower_g| \cdot |shoes_g|$.
