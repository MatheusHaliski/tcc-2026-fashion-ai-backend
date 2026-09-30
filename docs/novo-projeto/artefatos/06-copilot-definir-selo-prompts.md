# Etapa 7 (complemento) — Copilot "Definir selo" e os padrões de prompt `#createsealpolicy`

> **Decisão de interface.** O editor "Cadastrar novo selo" (Artefato #11, RF20/RF21) **não tem campo textual**.
> Toda decisão é um `select`, um segmento ou um switch; a única entrada em linguagem natural é a **janela do
> Copilot na versão "Definir selo"**, aberta pelo campo **Política de selo**. O que o perfil emissor escreve lá
> vira um objeto estruturado (`SealPolicy`), validado contra o banco do próprio perfil, e é **esse objeto** — não o
> texto — que o formulário grava. O texto fica só no transcript, para auditoria.

Este documento é a fonte dos **padrões de prompt** que o Copilot reconhece pela tag `#createsealpolicy`, do
objeto que ele devolve e das regras de resolução contra o banco. Os critérios de aceite moram em
[`docs/rf20-rf21-vinculo-marca-celebridade.md`](../rf20-rf21-vinculo-marca-celebridade.md) (§4.3, CA24–CA30);
a capacidade de IA é `RF24.CA17` ([`03-rf24-ia-e-servicos-externos.md`](03-rf24-ia-e-servicos-externos.md)).

---

## 1. Por que a política não é um campo de texto

| Se fosse texto livre no formulário | Com a política via Copilot |
|---|---|
| A regra vive numa string que ninguém valida; "12 meses" e "1 ano" divergem no código | A regra vive em `SealPolicy.validity.months = 12`; o formulário só lê o objeto |
| O emissor descreve uma coleção que não existe no catálogo e o erro aparece meses depois | Cada entidade citada é **resolvida no banco** na hora; o que não existe vira pergunta com opções |
| Duas marcas escrevem a mesma regra de dois jeitos e o motor de sugestão (RF24.CA09) não consegue comparar | Políticas comparáveis campo a campo: dá para simular elegibilidade e medir conversão por política |
| Texto livre é dado pessoal potencial (LGPD) espalhado em N campos | Um único transcript, com retenção definida, ligado ao `policy_id` |

A mesma regra vale para o **nome do selo**: o Copilot propõe três nomes a partir da coleção/era e o emissor
**escolhe** num `select`. Ninguém digita nome de selo.

---

## 2. Gramática da tag

```
#createsealpolicy <frase em linguagem natural com «slots»>
```

- **`#createsealpolicy`** abre a versão "Definir selo" do Copilot. Sem a tag, a mensagem cai no Copilot comum (RF10) e é recusada com o atalho para a versão correta.
- **`«…»`** marca um *slot*: valor que o Copilot precisa **resolver no banco** (coleção, campanha, era, peça, marca parceira) ou **tipar** (número, período, percentual). Na interface os slots aparecem como chips já preenchidos com o que o perfil tem cadastrado — o emissor troca o chip, não digita.
- Vários padrões podem ir na **mesma mensagem**; o Copilot compõe um único `SealPolicy` e reporta o que ficou faltando.
- A resposta é sempre: **(a)** a política interpretada em cartão estruturado, **(b)** as fontes consultadas, **(c)** avisos e conflitos, **(d)** ações "Aplicar ao selo" / "Ajustar". Nunca prosa solta.

---

## 3. Catálogo de padrões

Os exemplos usam o perfil fictício **Meridiano** (marca) e **Rosa Venturi** (celebridade), os mesmos do Artefato #11.
Os slots «» já vêm preenchidos pelo que o Copilot encontra no banco do perfil.

### 3.1 Elegibilidade — o que um look precisa ter para ganhar o selo

| # | Padrão | O que o Copilot resolve no banco | Campo de `SealPolicy` |
|---|---|---|---|
| P01 | `#createsealpolicy selo tier LOOK para looks com pelo menos «2» peças da coleção «Inverno 26»; as demais peças são livres.` | coleção existe no catálogo RF27 (14 peças) | `tier`, `eligibility.min_pieces_from_issuer`, `eligibility.collections[]` |
| P02 | `#createsealpolicy selo tier PEÇA para qualquer «calçado» detectado como desta marca com confiança acima de «0,80».` | categoria válida (RF4); `brand_detection_confidence` disponível | `tier`, `eligibility.categories[]`, `eligibility.min_confidence` |
| P03 | `#createsealpolicy só looks cujo wearstyle seja «Social» ou «Trabalho» e que tenham ao menos uma peça «superior» da marca.` | wearstyles permitidos por parte do corpo (documento 04, §Artefato #7) | `eligibility.wearstyles[]`, `eligibility.body_parts[]` |
| P04 | `#createsealpolicy excluir looks que contenham peça de «marca concorrente cadastrada».` | lista de marcas validadas (RF1.CA06) | `eligibility.exclude_issuers[]` |

### 3.2 Revisão — quem aprova o vínculo e quando

| # | Padrão | Resolve | Campo |
|---|---|---|---|
| P05 | `#createsealpolicy aprovar automaticamente acima de «0,85», revisar manualmente entre «0,72» e «0,85», recusar abaixo; SLA de revisão de «48 h».` | limiar mínimo do perfil (regra 2, §7 do RF20/21) | `review.mode = hybrid`, `review.auto_threshold`, `review.manual_below`, `review.sla_hours` |
| P06 | `#createsealpolicy toda sugestão passa por revisão manual; ninguém é auto-aprovado.` | — | `review.mode = manual` |
| P07 | *(celebridade)* `#createsealpolicy revisão sempre manual, como exige o direito de imagem.` | perfil verificado (RF21.CA18); auto-aprovação travada (RF21.CA19) — o Copilot **recusa** `auto` para celebridade | `review.mode = manual` (forçado) |

### 3.3 Validade e teto

| # | Padrão | Resolve | Campo |
|---|---|---|---|
| P08 | `#createsealpolicy validade de «12 meses» ou até o fim da campanha «Inverno 26», o que vier primeiro.` | `ends_at` da campanha | `validity.months`, `validity.expires_with_campaign` |
| P09 | `#createsealpolicy teto de «2.000» selos, «1» por usuário, no máximo «200» por semana.` | cota da promoção vinculada (aviso se o teto do selo > cota) | `quota.total`, `quota.per_user`, `quota.per_period` |
| P10 | *(celebridade)* `#createsealpolicy no máximo «300» Selos Premium nesta campanha; ao atingir, novos vínculos entram em fila.` | RF21.CA23 exige teto > 0 — o Copilot **não devolve** política válida sem teto | `quota.total`, `quota.on_exceed = queue` |
| P11 | `#createsealpolicy revogar automaticamente se a peça vinculada for excluída ou marcada indisponível, e avisar o usuário.` | RF31.CA02 (indisponível), RF7.CA03 (peça excluída) | `revocation.on_piece_removed`, `revocation.notify_user` |

### 3.4 Promoção — o que o selo destrava

| # | Padrão | Resolve | Campo |
|---|---|---|---|
| P12 | `#createsealpolicy vincular à promoção «Desconto e-commerce · 15%» já cadastrada; sem selo, sem cupom.` | `promotion_id` existente do perfil; janela e cota | `promotion.promotion_id` |
| P13 | `#createsealpolicy criar promoção do tipo «cupom de loja» de «R$ 50», válida de «01/03» a «30/06», «1» por usuário, habilitada por este selo.` | tipos permitidos (`ecommerce_discount`/`store_coupon`/`event_ticket`/`exclusive_content`) | `promotion.create = {...}` |
| P14 | *(celebridade)* `#createsealpolicy promoção «pré-venda Turnê Vitral» executada pela marca parceira «Meridiano».` | marca parceira validada; código de duplo identificador (RF21.CA22) | `promotion.partner_brand_id` |

### 3.5 Estética — como o selo se apresenta

| # | Padrão | Resolve | Campo |
|---|---|---|---|
| P15 | `#createsealpolicy material «tecido», moldura «malha de pontos», centro «logotipo cadastrado», denominação «ano».` | catálogo de materiais (12) e molduras da Coleção E; `logo_url` do perfil | `aesthetics.material`, `aesthetics.frame_pattern`, `aesthetics.center`, `aesthetics.denomination` |
| P16 | *(celebridade)* `#createsealpolicy Selo Premium na era «Vitral · 2019–2022», material «vidro» ou «holográfico».` | eras cadastradas no perfil (RF21.CA17); materiais vítreos são os únicos aceitos para Premium (RF21.CA20) | `aesthetics.material ∈ {vidro, holo}`, `celebrity.era_id` |

### 3.6 Nome, reuso e simulação

| # | Padrão | Resolve | Campo / efeito |
|---|---|---|---|
| P17 | `#createsealpolicy propor «3» nomes para o selo a partir da coleção e da estação, sem usar o nome da marca.` | coleção, estação, nomes já usados pelo perfil (evita duplicata) | `name_proposals[3]` → `select` "Nome do selo" |
| P18 | `#createsealpolicy copiar a política do selo «Fio Seco · Inverno 26» trocando a coleção para «Verão 27».` | política anterior versionada | novo `SealPolicy` com `derived_from` |
| P19 | `#createsealpolicy simular quantos looks publicados nos últimos «90 dias» seriam elegíveis com esta política.` | esquemas públicos + peças detectadas | `simulation.eligible_count`, `simulation.sample[]` (não altera a política) |
| P20 | `#createsealpolicy afrouxar a elegibilidade até que ao menos «50» looks do último trimestre sejam elegíveis.` | mesma base de P19; o Copilot propõe **uma** alteração por vez e mostra o efeito | `eligibility.*` ajustado + `rationale` |

### 3.7 Pacote completo (uma mensagem)

```
#createsealpolicy selo tier LOOK para looks com pelo menos «2» peças da coleção «Inverno 26»;
aprovar automaticamente acima de «0,85» e revisar entre «0,72» e «0,85»;
validade «12 meses» ou até o fim da campanha; teto «2.000», «1» por usuário;
vincular à promoção «Desconto e-commerce · 15%»;
material «tecido», moldura «malha de pontos», centro «logotipo cadastrado»;
propor «3» nomes.
```

---

## 4. O objeto que o Copilot devolve — `SealPolicy`

```json
{
  "policy_id": "pol_01J9…",
  "version": 2,
  "derived_from": null,
  "issuer_type": "brand",
  "issuer_id": "brand_meridiano",
  "tier": "LOOK",
  "eligibility": {
    "min_pieces_from_issuer": 2,
    "collections": ["col_inverno26"],
    "categories": [],
    "wearstyles": [],
    "body_parts": [],
    "min_confidence": 0.72,
    "exclude_issuers": []
  },
  "review": { "mode": "hybrid", "auto_threshold": 0.85, "manual_below": 0.72, "sla_hours": 48 },
  "validity": { "months": 12, "expires_with_campaign": true },
  "quota": { "total": 2000, "per_user": 1, "per_period": { "count": 200, "period": "week" }, "on_exceed": "queue" },
  "revocation": { "on_piece_removed": true, "notify_user": true },
  "promotion": { "promotion_id": "promo_a31", "create": null, "partner_brand_id": null },
  "aesthetics": { "material": "tecido", "frame_pattern": "malha", "center": "logo_url", "denomination": "year" },
  "celebrity": null,
  "name_proposals": ["Fio Seco · Inverno 26", "Ponto Cheio · 26", "Trama de Inverno"],
  "status": "valid",
  "warnings": [],
  "conflicts": [],
  "sources": [
    { "table": "collection", "id": "col_inverno26", "detail": "14 peças" },
    { "table": "promotion", "id": "promo_a31", "detail": "cota 2.000 · 01/03–30/06" },
    { "table": "seal_policy", "id": "pol_01J8…", "detail": "3 selos anteriores do perfil" }
  ],
  "rationale": "Looks com duas ou mais peças da coleção Inverno 26 recebem o selo; acima de 0,85 o vínculo é automático."
}
```

**Estados de `status`:** `valid` (pode publicar) · `incomplete` (falta campo obrigatório — teto para celebridade,
promoção para qualquer emissor) · `conflict` (ex.: teto do selo maior que a cota da promoção; material opaco em
Selo Premium) · `unresolved` (slot que o banco não encontrou e o emissor ainda não escolheu).

**Mapeamento política → formulário.** Cada `select` do editor lê um campo do objeto e **pode sobrescrevê-lo**;
a sobrescrita gera uma nova versão da política, nunca edita o texto do transcript.

| Campo do editor (select) | Lê de | Opções |
|---|---|---|
| Tier | `tier` | PEÇA · LOOK |
| Nome do selo | `name_proposals[]` | as 3 propostas · "pedir outras 3" |
| Material | `aesthetics.material` | plástico · metal · madeira · vidro · mármore · tecido · couro · cerâmica · neon · concreto · ouro martelado · holográfico |
| Moldura | `aesthetics.frame_pattern` | malha de pontos · hachura · listras · chevron · xadrez · losango · pérolas · raios · ondas · estrelas |
| Centro | `aesthetics.center` | logotipo cadastrado · camisa 3D · sacola FAI · vazio |
| Denominação | `aesthetics.denomination` | ano · nº de edição · nº de série |
| Validade | `validity.months` | 3 · 6 · 12 · 24 meses · até o fim da campanha |
| Teto | `quota.total` | 100 · 300 · 500 · 1.000 · 2.000 · 5.000 · sem teto *(marca)* |
| Limiar de confiança | `eligibility.min_confidence` | 0,60 · 0,72 · 0,80 · 0,90 |
| Auto-aprovar | `review.mode` | switch, **travado** em celebridade |
| Promoção habilitada | `promotion.promotion_id` | promoções ativas do perfil · "criar no Copilot" |
| Era do look *(celebridade)* | `celebrity.era_id` | eras cadastradas no perfil |

---

## 5. Regras de resolução contra o banco

1. **Todo slot é resolvido antes de responder.** Coleção, campanha, era, peça, marca parceira e nomes já usados são consultados no banco do perfil emissor. Nada é inventado: se não existe, vira pergunta.
2. **Pergunta é sempre com opções.** Quando um slot é ambíguo ("Inverno" bate com `Inverno 25` e `Inverno 26`) ou inexistente, o Copilot devolve um `select` com os candidatos e "nenhum destes". Não pede para "digitar de novo".
3. **Regras duras sobrepõem o pedido.** Celebridade nunca recebe `review.mode = auto` (RF21.CA19); Selo Premium só aceita material vítreo (RF21.CA20); teto obrigatório para celebridade (RF21.CA23); promoção obrigatória para qualquer selo (RF20.CA11). O Copilot explica **qual regra** bloqueou, com o CA.
4. **Uma alteração por rodada em ajustes.** Em P20 (afrouxar até N elegíveis) o Copilot muda um critério, mostra o efeito e pergunta se continua — evita política que ninguém entende.
5. **Transcript é auditoria, não dado de produto.** Fica ligado ao `policy_id`, com retenção de 12 meses após a última versão (RNF6); o objeto `SealPolicy` é o único dado lido pelo motor de sugestão (RF24.CA09).
6. **Cota e degradação.** Segue RF24.CA13–CA14: sem provedor, o editor mantém a última política válida e informa que não é possível criar uma nova; nunca abre um campo de texto como "plano B".

---

## 6. Estados da janela "Definir selo"

| Estado | O que aparece |
|---|---|
| **Vazio** | Chips dos padrões (Elegibilidade · Revisão · Validade · Teto · Promoção · Estética · Nome) já com os slots preenchidos pelo banco; atalho "pacote completo" |
| **Interpretando** | Esqueleto do cartão de política; sem animação sob `prefers-reduced-motion` |
| **Política válida** | Cartão estruturado + fontes + "Aplicar ao selo" |
| **Slot não resolvido** | Pergunta com `select` de candidatos (regra 2) |
| **Conflito** | Cartão com o campo em vermelho, o CA que bloqueia e a ação que resolve ("Definir teto", "Trocar material") |
| **Cota esgotada / provedor fora** | Última política válida preservada; botão "Definir com o Copilot" desabilitado com horário de reposição (RF24.CA14) |

---

## 7. Onde isso encosta no resto do projeto

- **Artefato #11** (`artefatos/11-perfil-institucional-rf14-rf22.html`): aba "Cadastrar novo selo" redesenhada sem campos textuais + as duas telas da janela do Copilot.
- **RF20/RF21** (`docs/rf20-rf21-vinculo-marca-celebridade.md`): CA24–CA30, entidade `seal_policy`, endpoint `POST /api/copilot/seal-policy`.
- **RF24.CA17** (`03-rf24-ia-e-servicos-externos.md`): a capacidade "Definir selo" com saída JSON validada por schema e *tool use* sobre o banco do emissor.
- **Catálogo de materiais e molduras**: os selos vetoriais em `insumos/selos/` (série Fashion AI, materiais e marcas) são a referência visual de cada opção dos `select` de estética.
- **Trello**: os CAs novos precisam entrar na checklist do card **HU-RF20** e **HU-RF21** (regra da §0 do documento 02) — feito à mão, este documento não escreve no Trello.
