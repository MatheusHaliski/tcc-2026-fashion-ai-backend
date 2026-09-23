# RF6 — Aba "Look do Dia": Versões de Painel

**Projeto:** FashionAI (SAI-TCC-2026)
**Requisito Funcional:** RF6 — Perfil Lookbook (aba "Look do Dia")
**Complementa:** `RF6_Perfil_Lookbook_Atividades.puml`, `RF6_HYPE_SCORE_CALCULO.md`
**Base de vocabulário visual:** `anatomias_card_v13.html` (mesmo catálogo de anatomias já usado no RF11, seção "Layout & Estilo") — documento oficial de modelagem de parâmetros de dimensões/anatomia de card do projeto, na raiz do repositório.

> **Correção desta rodada.** Uma rodada anterior desta revisão havia marcado a citação a `anatomias_card_v12.html` como referência a um arquivo inexistente e reescrito as seções 2.2–2.4 como "propostas sem componente para reaproveitar". Isso estava errado: `anatomias_card_v13.html` é o documento oficial de modelagem de anatomia de card do projeto — só não estava, até esta rodada, commitado neste repositório (agora está, na raiz, corrigindo também o número de versão de v12 para v13). As classes `.runway-*`/`.rail-passarela`, `.xray-*` e `.bento-*` citadas abaixo existem de fato nesse arquivo.

---

## 1. Princípio

Todas as versões abaixo **exibem o mesmo dado** — Hype Score, breakdown, selos, sugestão da IA e histórico calculados exatamente como descrito em `RF6_HYPE_SCORE_CALCULO.md`. O que muda entre versões é **apresentação**, não cálculo: nenhuma versão recalcula o Hype Score com peso diferente; a única constante obrigatória em todas é a **barra/indicador do Hype Score visível sem precisar expandir nada**. Isso mantém a fórmula com uma única fonte de verdade (seção 4 do doc de cálculo) e reduz a escolha de versão a uma preferência de UI, configurável pelo usuário ou testável em A/B sem tocar no back-end de cálculo.

O `.puml` do RF6 seleciona a versão em um único passo ("Selecionar a versão de painel configurada") logo antes de renderizar — trocar de versão não dispara novo cálculo.

---

## 2. Catálogo de versões

### 2.1 Spotlight Clássico (padrão)

Layout seguro e legível, recomendado como padrão para todo usuário novo.

- Esquema em versão compacta, centralizado.
- Barra horizontal do Hype Score logo abaixo, com classificação textual ao lado ("72% · Muito Estiloso").
- Total de curtidas como número simples no canto.
- Selos (Trendsetter/Style Match) em linha, só os conquistados.
- Sugestão da IA como uma linha de texto no rodapé.
- **Quando usar:** default do sistema; usuários que preferem um painel direto, sem curadoria adicional.

### 2.2 Passarela

Reaproveita o componente de passarela do RF11 (`.runway-*`/`.rail-passarela` de `anatomias_card_v13.html`): esquema apresentado como "em destaque no palco", com luz de holofote.

- Esquema em destaque grande, com efeito de spotlight (gradiente radial sobre fundo escuro).
- Hype Score como **termômetro vertical** ao lado do esquema (não barra horizontal) — reforça a metáfora de "quão alto" o look está.
- Peças do esquema em um rail lateral inferior, cada uma com sua contribuição individual de curtidas como "medalha".
- Breakdown de curtidas/comentários/shares/remixes exibido como troféus/ícones, não barras.
- **Quando usar:** usuários com Hype Score alto (faixas 5–7) que querem uma celebração visual mais dramática; também bom para compartilhamento externo (RF19.CA09), por ser mais "screenshot-ável".

### 2.3 Raio-X do Estilo

Reaproveita o componente de scanner/callout do RF11 (`.xray-*` de `anatomias_card_v13.html`).

- Esquema central com linhas de callout coloridas apontando para cada peça, mostrando a contribuição individual daquela peça ao total de curtidas/comentários.
- Mini radar/gráfico dos componentes do Engajamento Normalizado (curtidas, comentários, shares, remixes) lado a lado com o Alinhamento de Tendência detalhado por atributo (marca, cor, estilo, ocasião).
- Sem "termômetro" único — o foco é decompor o número, não só mostrá-lo.
- **Quando usar:** usuários "power" que querem entender *por que* o score é o que é; também útil para o próprio time de produto em telas de debug/QA.

### 2.4 Bento do Dia

Reaproveita o grid assimétrico interativo do RF11 (`.bento-*` de `anatomias_card_v13.html`).

- Bloco grande fixo: esquema + Hype Score.
- 2–3 blocos menores, reordenáveis pelo usuário (mesmo padrão do seletor interativo do Bento no RF11), cada um mostrando **um** destes: selo conquistado, comparação com o look do dia anterior (Δ ↑/↓/=), sugestão da IA, ou ranking semanal (Top X%, seção 4.1 do doc de cálculo).
- **Quando usar:** usuários que já entendem o Hype Score e querem priorizar qual indicador secundário veem primeiro — mais um painel "configurável" do que "fixo".

### 2.5 Editorial Minimal

O oposto do Passarela: nenhuma gamificação visível além do essencial.

- Só a foto do esquema em grande e o nome do look.
- Hype Score como um único número discreto (ex. "72%") sem barra nem cor de destaque forte — tipografia editorial, não HUD de jogo.
- Breakdown, selos e sugestão da IA ficam atrás de um "ver detalhes" (expansível), nunca visíveis por padrão.
- **Quando usar:** usuários que reagiram mal a excesso de badges/gamificação (mesmo público que prefere o preset AURA `aura_editorial_mono` no RF11) — mantém o Hype Score presente (obrigatório em toda versão) sem competir visualmente com o look em si.

### 2.6 Coach de Estilo

A sugestão da IA vira o elemento principal, não um rodapé.

- Texto grande, em tom de orientação pessoal, ocupa o topo do painel: *"Seus remixes estão baixos — peças de {marca} costumam remixar mais nesta faixa de estilo."*
- Hype Score e breakdown aparecem **abaixo**, como "prova" que sustenta a sugestão, não como destaque principal.
- Botão de ação direto ligado à sugestão (ex.: abrir o Background Studio já na peça/atributo sugerido).
- **Quando usar:** usuários com Hype Score baixo/médio (faixas 1–3) que se beneficiam mais de orientação acionável do que de números; bom gatilho de reengajamento.

---

## 3. Resumo comparativo

| Versão | Ênfase | Hype Score sempre visível como | Melhor para |
|---|---|---|---|
| Spotlight Clássico | Equilíbrio | Barra horizontal + texto | Padrão geral |
| Passarela | Celebração/drama | Termômetro vertical | Scores altos, compartilhamento |
| Raio-X do Estilo | Transparência do cálculo | Número + breakdown expandido | Usuários avançados |
| Bento do Dia | Priorização configurável | Bloco fixo grande | Usuários recorrentes |
| Editorial Minimal | Minimalismo | Número discreto | Baixa tolerância a gamificação |
| Coach de Estilo | Orientação acionável | Secundário, abaixo da sugestão | Scores baixos/médios, reengajamento |

## 4. Nota de implementação

A versão selecionada é uma preferência (`panelVersion`) armazenada no perfil do usuário (mesmo padrão de outras preferências de interface já existentes) — sem valor salvo, aplica-se Spotlight Clássico. Nenhuma versão altera o contrato de dados do painel: todas consomem o mesmo objeto de resultado (`HypeScore`, faixa, breakdown, selos, `TopPercentSemanal`, sugestão da IA) calculado uma única vez por `RF6_HYPE_SCORE_CALCULO.md` — a troca de versão é puramente de apresentação e pode ser feita client-side, sem nova chamada ao serviço de cálculo.
