# RF6 — Aba "Look do Dia": Cálculo do Hype Score e Indicadores Sociais

**Projeto:** FashionAI (SAI-TCC-2026)
**Requisito Funcional:** RF6 — Perfil Lookbook (aba "Look do Dia")
**Depende de:** RF19 — Interações sociais (curtir, comentar, compartilhar, remixar)
**Complementa:** `RF6_Perfil_Lookbook_Atividades.puml`

---

## 1. Contexto

O "Look do Dia" é sempre um **Esquema de Vestimenta** — nunca uma Peça avulsa nem um registro de DNA de Estilo, os quais não participam desta aba. A marcação é um **registro datado**, não um flag booleano mutável: cada dia em que o usuário marca (ou a marcação persiste) gera/atualiza um documento em `saiDailyLooks` (mesma coleção descrita em `docs/autopiloto-architecture.md`, com `user_id`, `date`, `scheme_id`; aqui com `source = "manual"` para distinguir de marcações geradas pelo Autopiloto). Um flag booleano isolado no esquema não sustenta o histórico exibido na aba, a comparação com o look do dia anterior, nem o feedback datado da HU19 — por isso o registro datado é a fonte de verdade, e qualquer flag de leitura rápida no esquema é só um cache derivado do registro de hoje.

**Continuidade na virada do dia.** "A marcação persiste" só é verdade na prática se existir um documento para *cada* data em que o look permanece ativo — inclusive quando o usuário não faz nada. Por isso, ao carregar a aba, se não existir registro para a data atual, o sistema busca o registro mais recente anterior e **materializa** um novo documento de hoje copiando `scheme_id`/`source` dele, antes de qualquer outra leitura (ver `RF6_Perfil_Lookbook_Atividades.puml`). Sem esse passo, um look marcado ontem e nunca remarcado desapareceria à meia-noite, mesmo a marcação devendo continuar ativa — a materialização lazy no primeiro acesso do dia resolve isso sem depender de um job agendado (um job em lote continua sendo uma otimização de leitura válida em escala, mas não é necessário para a correção).

O painel da aba exibe o esquema em versão compacta mais um conjunto de indicadores sociais, com destaque para o **Hype Score**: um percentual (0–100%) que responde "o quão estiloso este look está sendo percebido, agora, pela comunidade e frente às tendências globais da plataforma".

Dois problemas de design que a fórmula abaixo resolve deliberadamente:

1. **Contagens brutas (curtidas, shares...) não são comparáveis entre si nem limitadas a 0–100%** — um usuário com 3 seguidores e outro com 30 mil nunca teriam scores no mesmo intervalo se somássemos direto.
2. **"Estiloso" não é só "engajado"** — um look pode ter poucas curtidas mas estar vestindo exatamente o que está bombando na plataforma agora (ou o contrário: ser hiperengajado sem repetir nada que já é tendência, o que o RF6 chama de efeito *trendsetter*, seção 5).

A fórmula por isso combina dois eixos independentes, cada um normalizado por **percentil** (não por um teto fixo), o que evita "número mágico" que fica desatualizado conforme a base de usuários cresce.

---

## 2. Eixo 1 — Engajamento Normalizado (E_norm)

### 2.1 Soma ponderada bruta

$$E_{raw} = 1\!\cdot\!L + 3\!\cdot\!C + 5\!\cdot\!S + 8\!\cdot\!R$$

| Símbolo | Métrica (RF19) | Peso | Por quê |
|---|---|---|---|
| `L` | Curtidas — esquema **+** soma das curtidas de todas as peças do esquema | 1 | ação de menor esforço; sinal de base |
| `C` | Comentários — esquema + peças | 3 | exige digitar algo; engajamento qualificado |
| `S` | Compartilhamentos (feed interno + rede externa, RF19.CA08/CA09) | 5 | redistribui o conteúdo; sinal de alcance |
| `R` | Remixes — quantas vezes o esquema/peças foram usados como base por outro usuário (RF19.CA13, contador em `remixes`) | 8 | maior peso: alguém *copiou/adaptou* o look — validação de estilo mais forte que existe |

Estes pesos seguem a mesma lógica usada em fórmulas de taxa de engajamento de redes sociais reais: ações que custam mais esforço ao usuário (comentar, compartilhar, remixar) valem mais que uma curtida passiva.

**Por que "Retornar" não entra na soma.** RF19.CA13/CA14 define *Retornar* como uma ação de **navegação**: a partir de uma peça na lista de um esquema, ela apenas abre o esquema de origem que usou aquela peça — não é reconhecimento nem reuso por terceiros, e não existe (nem faria sentido existir) um contador de "retornos" nos dados do RF19. Tratá-la como sinal de engajamento social contaria cliques comuns de navegação como se fossem endosso — por isso o cálculo usa somente `L`, `C`, `S`, `R`.

### 2.2 Normalização por percentil

$$E_{norm} = 100 \times \frac{\text{posição de } E_{raw} \text{ em ordem crescente entre os esquemas ativos de referência}}{N}$$

**Janela de calibração (população de referência):** todos os esquemas públicos com pelo menos 1 interação nos últimos 90 dias (janela móvel, recalculada periodicamente — ver seção 7). Isso mantém `E_norm` sempre em [0, 100] e auto-calibrado: a régua acompanha o crescimento da base de usuários, sem precisar de um "teto" hardcoded que se torna obsoleto.

---

## 3. Eixo 2 — Alinhamento de Tendência (T_norm)

Mede se o usuário está vestindo o que **globalmente** está em uso agora — marca, cor, categoria de peça e estilo/ocasião do esquema.

### 3.1 Fração de uso global recente por atributo

Para cada atributo `a` (marca, cor, categoria, estilo, ocasião) e cada valor `v` que esse esquema usa:

$$u(a, v) = \frac{\text{nº de usuários distintos com uma peça/esquema usando } v \text{ no atributo } a, \text{ publicado, editado ou marcado como look do dia nos últimos 30 dias}}{\text{nº total de usuários ativos}}$$

**A janela de recência é sobre o *item*, não sobre o usuário.** Exigir apenas que o usuário dono esteja ativo (sem condição de tempo sobre o próprio uso do valor `v`) faria uma peça comprada há anos, parada no guarda-roupa, contar para sempre a favor da tendência — o acervo acumulado dominaria `Trend_raw` e o resultado deixaria de representar o que está em uso "agora", que é exatamente o que este eixo promete medir. Por isso o numerador conta só usos com **publicação, edição ou marcação como look do dia nos últimos 30 dias** — uma janela mais curta que a de calibração de 90 dias da seção 2.2/3.3 (que define o *tamanho da régua de percentil*, não a *recência do sinal de tendência*; são preocupações independentes).

### 3.2 Combinação ponderada

$$Trend_{raw} = \frac{\sum_i w_i \cdot u(a_i, v_i)}{\sum_i w_i}$$

| Atributo | Peso `w` | Origem do dado |
|---|---|---|
| Estilo (`style`) | 1.5 | `EsquemaVestimenta.style` (HU05) |
| Marca | 1.0 | marca de cada `WardrobeItem` do esquema |
| Cor | 1.0 | cor dominante de cada peça |
| Ocasião (`occasion`) | 1.0 | `EsquemaVestimenta.occasion` |
| Categoria/tipo de peça | 0.5 | `pieceType` de cada peça — pesa menos porque categoria (ex. "camisa") é pouco discriminante de tendência |

### 3.3 Normalização por percentil

$$T_{norm} = 100 \times \frac{\text{posição de } Trend_{raw} \text{ entre os esquemas ativos de referência}}{N}$$

Mesma **janela de calibração** de 90 dias do Eixo 1 (seção 2.2) — essa janela define o tamanho da população usada para ranquear o percentil, e é independente da janela de 30 dias usada dentro de `u(a,v)` para decidir o que conta como uso "recente" de cada atributo.

---

## 4. Hype Score final

$$\boxed{HypeScore = 0{,}65 \times E_{norm} + 0{,}35 \times T_{norm}} \quad \in [0, 100]\%$$

**Por que 65/35 e não 50/50:** o Hype Score responde primeiro "a comunidade reagiu a ESTE look" (prova social direta) — isso é o E_norm. O alinhamento de tendência entra como reforço secundário, porque moda não é só conformidade: um look pouco alinhado a tendências pode e deve continuar pontuando alto se tiver engajamento real (ver Selo Trendsetter, seção 5). Por isso `α > β`, mas nenhum dos dois eixos tem peso zero.

### 4.1 Percentil semanal do score composto (necessário para o "Top X%")

**`HypeScore` é uma média ponderada de dois percentis — não é, ele mesmo, um percentil.** `100 − HypeScore` portanto **não** diz quantos looks estão acima deste: uma combinação linear de duas variáveis já normalizadas por percentil não preserva a propriedade de percentil (ex.: `E_norm=90` e `T_norm=10` dá `HypeScore=64,5`, mas isso não significa que 35,5% dos looks pontuam mais alto — a posição real de 64,5 na distribuição dos `HypeScore` de todos os looks pode ser bem diferente).

Para sustentar a alegação "Top X% dos looks **desta semana**" de forma correta:

1. Define-se uma **população semanal de comparação** — todos os esquemas ativos/atualizados nos últimos 7 dias — **distinta** da janela de calibração de 90 dias das seções 2.2/3.3 (aquela só define a escala de `E_norm`/`T_norm`; esta define contra quem o score final é comparado).
2. Calcula-se `HypeScore` para cada esquema dessa população semanal (usando os `E_norm`/`T_norm` já calibrados pela janela de 90 dias).
3. Ordena-se a população semanal por `HypeScore` **crescente** e localiza-se `posição` (1-indexada: `posição = 1` é o menor score, `posição = N_semana` é o maior) do esquema atual nessa ordem.
4. Calcula-se diretamente a **fatia superior inclusiva** — a própria definição de "Top X%" — sem passar por um percentil intermediário que depois precise ser invertido:

$$TopPercentSemanal = 100 \times \frac{N_{semana} - posição + 1}{N_{semana}}$$

**Por que não `100 × posição / N` seguido de `100 − isso`.** Com posição 1-indexada, o item de maior score tem `posição = N_semana`, o que daria percentil ascendente `100 × N_semana / N_semana = 100` e, na inversão ingênua, "Top `100 − 100`% = Top 0%" — uma fatia impossível, já que nenhuma população não vazia coloca um item em 0% de si mesma (o melhor item de N itens está, no mínimo, no Top `100/N`%). A fórmula de `TopPercentSemanal` acima calcula a fatia superior direto, sem essa inversão: para o melhor item (`posição = N_semana`), dá `100 × 1 / N_semana` (ex.: Top 1% em uma população de 100); para o pior item (`posição = 1`), dá `100%` (está, trivialmente, no Top 100% — no fim de todo mundo).

Só `TopPercentSemanal` — não o `HypeScore` bruto, nem um percentil ascendente invertido — pode virar a alegação "Top `TopPercentSemanal`% dos looks desta semana" (seção 6).

---

## 5. Faixas de classificação

Como os dois eixos já são normalizados por percentil, o `HypeScore` tende a se distribuir de forma aproximadamente uniforme entre os usuários — por isso faixas de largura próxima já mapeiam, na prática, para fatias parecidas da base de usuários, sem que 95% dos looks caiam todos na faixa mais baixa (o problema comum de scores baseados em contagem bruta). Sete faixas, no mesmo espírito das 7 faixas já usadas pelo sistema de Aura de engajamento (`app/lib/aura-system.ts`, `RAW → LEGENDARY`):

| Faixa | Hype Score | Rótulo |
|---|---|---|
| 1 | 0 – 14% | **Despretensioso** |
| 2 | 15 – 29% | **Em Construção** |
| 3 | 30 – 49% | **Notado** |
| 4 | 50 – 69% | **Com Estilo** |
| 5 | 70 – 84% | **Muito Estiloso** |
| 6 | 85 – 95% | **Arrasando no Look** |
| 7 | 96 – 100% | **Ícone de Estilo** |

(Os nomes das pontas — "impopular"/"arrasando no look" — foram suavizados para tom de produto; troque livremente, a régua numérica é o que importa.)

---

## 6. Outros indicadores do painel

Todos derivam dos mesmos dados já calculados acima — nenhum precisa de fonte nova.

- **Total de curtidas** = `L` (soma das curtidas do esquema + de todas as peças) — exibido como número absoluto ao lado do Hype Score.
- **Breakdown por métrica** — mini-barras de `L`, `C`, `S`, `R`, cada uma normalizada por percentil individualmente (mesmo método da seção 2.2, aplicado a cada métrica isolada). Mostra ao usuário *qual* alavanca puxar.
- **Selo "Trendsetter"** — concedido quando `E_norm ≥ 70` **e** `T_norm ≤ 30`: o usuário está sendo muito bem recebido usando algo que ainda **não** é tendência — ele está criando uma, não seguindo.
- **Selo "Style Match"** — concedido quando `T_norm ≥ 70`: o usuário está fortemente alinhado com o que está bombando agora na plataforma.
- **Ranking textual** — "Top `TopPercentSemanal`% dos looks desta semana" (seção 4.1) — a fatia superior inclusiva, calculada direto contra a população semanal; **não** é `100 − HypeScore` nem um percentil ascendente invertido.
- **Comparação com o Look do Dia anterior** — `Δ = HypeScore de hoje − HypeScore do registro de saiDailyLooks de data imediatamente anterior do mesmo usuário`, exibido como seta ↑ / ↓ / = , incentivando a repetição da marcação diária. Como a marcação é um registro datado (seção 1), "o look anterior" é sempre um documento concreto (`scheme_id` + `date`), nunca uma inferência sobre um flag já sobrescrito.
- **Sugestão da IA** — o sistema identifica a métrica do breakdown com pior percentil e a `AIArtworkService`/`ContextAnalysisService` (já existentes na arquitetura do RF11) geram uma dica acionável, ex.: *"Seus remixes estão baixos — looks com peças de marca X costumam ser mais remixados nesta faixa de estilo."*

---

## 7. Nota de implementação (cadência de cálculo)

Os contadores brutos (`L`, `C`, `S`, `R`) atualizam em tempo real a cada interação (RF19). Já a **janela de calibração** (posição entre os N esquemas de referência, seção 2.2/3.3) e a **janela de recência de tendência** (30 dias, seção 3.1) não precisam — e não devem — ser recalculadas a cada interação: um job periódico (ex.: a cada poucas horas, via o mesmo `ContextAnalysisService` que já roda as análises de contexto do RF11) recalcula a distribuição de `E_raw`/`Trend_raw` entre os esquemas de referência e atualiza os limites de percentil usados por `E_norm`/`T_norm`. Um segundo job, com cadência semanal (ou diária, recalculando sobre uma janela móvel de 7 dias), recalcula a **população semanal de comparação** e a distribuição de `HypeScore` usada para o percentil semanal da seção 4.1 — esse job é independente do de calibração de 90 dias. O Hype Score exibido é sempre recalculado on-demand (contadores atuais × última distribuição de referência), sem exigir reprocessar toda a base a cada abertura da aba.
