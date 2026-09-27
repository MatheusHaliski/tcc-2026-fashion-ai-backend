# Plano: extrair a ficha da pessoa e gerar o corpo 3D pelo Meshy

Plano para o desenho **foto → ficha estruturada da pessoa → prompt → Meshy → corpo humano 3D em pé**.

A ideia tem duas metades de qualidade muito diferente, e vale separá-las antes de executar:

- **Metade 1 — extrair a ficha (§2).** É a melhor parte da ideia, e **já está quase toda construída** no projeto.
  Vale formalizar de qualquer forma, porque ela serve aos dois caminhos.
- **Metade 2 — o Meshy gerar o corpo (§3–§5).** É executável, mas o que sai é **um corpo plausível, não o corpo
  daquela pessoa**: não é medível, não é reproduzível, não tem esqueleto, e quebra o provador. §6 lista o porquê,
  item por item, e §7 propõe a variante que preserva a ideia sem esses custos.

Este plano entrega os dois: o pipeline como pedido, instrumentado para ser **medido e julgado** com as métricas que o
repositório já tem, e a variante recomendada.

---

## 1. O que decide antes de escrever código

Três perguntas que o experimento precisa responder. Se as três derem "não", o caminho morre — e isso é resultado de
TCC, não fracasso.

| Pergunta | Como medir | Onde |
|---|---|---|
| O corpo gerado bate com as medidas da ficha? | erro relativo por proporção | `metrics.ts:proportionError` |
| Ele é anatomicamente íntegro? | completude, conexões, simetria | `metrics.ts:completeness/connectivity/symmetry` |
| Ele bate com a foto? | erro de pontos (PCK) e IoU da silhueta | `metrics.ts:keypointError`, `iou` |

A comparação é sempre contra o corpo paramétrico atual, nas **mesmas fotos** (T1–T7 mais voluntários), com
`scripts/avatar3d/eval-body.mjs` estendido.

---

## 2. Etapa 1 — A ficha estruturada da pessoa

"Filtrar apenas os dados da pessoa da foto" é exatamente o que `lib/avatar3d/` já faz. O que falta é **juntar num
artefato só, com a origem de cada campo**.

### 2.1 O que entra, e de onde

| Campo | Origem | Já existe? |
|---|---|---|
| `sex` | **cadastro (RF1)**, nunca inferido da foto | ✅ `users.sex`, já usado em `TryOnService.resolve` |
| `heightCm` | informado pela pessoa | ✅ `applyUserData` |
| `stature`, `shoulderW`, `chestW`, `waistW`, `hipW`, `legLen`, `armLen`, `headH` | medidos na foto de frente | ✅ `observeBody` |
| `chestD`, `waistD`, `hipD` | medidos na foto de perfil | ✅ `observeProfile` (PR #27) |
| `build` | medido, ou estimado do IMC quando nada foi medido | ✅ `applyUserData` |
| `skinHex` | medido nas bochechas e testa | ✅ `image-stats.ts:sampleSkin` |
| `hair` (cor, volume, franja) | medido de frente | ✅ `image-stats.ts:hairStats` |
| `faceShape` | 468 pontos, razões geométricas | ✅ `geometry.ts:faceMetrics` |
| `warnings` | qualidade da foto e da pose | ✅ `quality.ts:checkPhoto`, `observeBody` |

Cada campo carrega sua origem — `observed` \| `user` \| `estimated` \| `default` — que o `BodyModel` já tem.

### 2.2 Dois campos que o plano pede e que **não** devem entrar

**Peso.** O próprio projeto já decidiu e documentou o contrário, em
`investigacao-pipeline-avatar.md` §4.2, resposta 12: *"não é justificável inferir peso nem idade de uma foto para
este fim: o erro não é controlável e a inferência expõe dados sensíveis"*. O peso entra **informado pela pessoa**,
opcional, e só orienta a compleição quando nada foi medido. Voltar atrás disso contradiz o texto do próprio TCC.

**Sexo inferido da foto.** Classificar sexo ou gênero a partir de imagem é exatamente o que o *Gender Shades*
(Buolamwini & Gebru, já na bibliografia do projeto) mostra ter erro muito desigual entre subgrupos. E é
desnecessário: o cadastro já tem o dado, e o provador já o usa. A foto, no máximo, **confirma**; nunca decide.

### 2.3 O artefato

Um JSON só, derivado do `BodyModel` que já existe — sem inventar estrutura nova:

```jsonc
{
  "v": 1,
  "sex": "FEMININO",              // do cadastro
  "heightCm": 168,                // informado
  "params":  { "stature": 1.68, "shoulderW": 0.195, "hipW": 0.212, "waistD": 0.118, "...": 0 },
  "sources": { "shoulderW": "observed", "hipW": "observed", "waistD": "observed", "...": "default" },
  "skinHex": "#c8966e",
  "hair":    { "present": true, "color": "#2b1c14", "top": 0.08, "fringe": 0.3 },
  "warnings": ["CLOTHING"]
}
```

Esta etapa é útil **independentemente do Meshy**: é ela que alimenta o corpo paramétrico, o provador e o relatório de
qualidade. Faça-a primeiro.

---

## 3. Etapa 2 — Da ficha para o prompt

**Comece determinístico, sem LLM.** Um gabarito com lacunas é reproduzível, não alucina atributo que a foto não viu,
não custa nada e é auditável no TCC. Só depois, se houver ganho medido, vale um LLM para polir a redação.

### 3.1 Gabarito

```
A full-body 3D character of a standing adult {sex}, neutral A-pose, arms slightly away from the body,
feet together on the ground, facing forward, eyes forward, neutral expression.
Body proportions: {build_phrase}, {shoulder_phrase}, {waist_phrase}, {hip_phrase}.
Skin tone {skin_name}. Hair: {hair_phrase}.
Plain light grey studio background, even soft lighting, no shadows on the backdrop.
Full body visible from head to feet, centered, orthographic-like framing.
Simple fitted neutral grey bodysuit. No logos, no text, no props, no accessories.
```

As lacunas vêm de **faixas**, não de números — porque o gerador não entende centímetros:

| Lacuna | Regra |
|---|---|
| `build_phrase` | `build < -0.4` → "slim build" · `-0.4..0.4` → "average build" · `0.4..1.0` → "athletic build" · `> 1.0` → "plus-size build" |
| `shoulder_phrase` | compara `shoulderW` com a referência do sexo: "narrow / average / broad shoulders" |
| `waist_phrase`, `hip_phrase` | idem, com `waistW` e `hipW` |
| `skin_name` | tom medido → rótulo da escala Monk (a escala já está na bibliografia) |
| `hair_phrase` | de `hairStats`: comprimento, volume, franja, cor |

**Só entram campos cuja origem seja `observed` ou `user`.** Campo `default` não vira adjetivo — senão o prompt
descreve a referência, não a pessoa, e o resultado parece "acertar" sem ter medido nada.

**Negativos:** `no text, no logo, no watermark, no extra limbs, not sitting, not walking, no props`.

### 3.2 Se quiser o LLM na jogada

O repositório já tem o provedor pronto (`ClaudeProvider`, SDK oficial da Anthropic, com `ProviderCircuit` e cota).
O encaixe é uma `AiCapability` nova — `BODY_PROMPT` — dentro do `AiEngine`, com **o gabarito determinístico como
motor local de fallback**. Modelo: `claude-opus-5`. Saída restrita por *structured outputs*, para o LLM não inventar
atributo fora da ficha. Guarde o prompt gerado junto do job: sem ele, o resultado não é reproduzível.

---

## 4. Etapa 3 — A chamada ao Meshy

### 4.1 O que o repositório fala hoje

`MeshyModel3dAdapter` usa **`POST /openapi/v1/image-to-3d`**, com `enable_pbr`, `should_texture`, `should_remesh`,
`topology: triangle`, `target_polycount: 30000`. O custo declarado é `0.4000` por modelo e o poll aceita
`SUCCEEDED | FAILED | CANCELED | EXPIRED | IN_PROGRESS`.

Ou seja: **a porta `Model3dPort` é imagem→3D e recebe `byte[] image`** — ela não aceita um prompt de texto. Texto→3D
é outro endpoint. São dois caminhos possíveis:

| Caminho | O que muda | Prós e contras |
|---|---|---|
| **A. texto→3D direto** | porta nova `BodyMeshProviderPort` com `submit(String prompt)` | menos etapas; nenhum controle de enquadramento, pose ou silhueta |
| **B. ficha → imagem de referência → imagem→3D** | um gerador de imagem (o projeto já tem `ImageGenerationPort` e o `ReplicateImageGenerationAdapter`) e depois o Meshy que já existe | **recomendado**: dá para conferir e refazer a imagem antes de gastar o 3D, e a pose/enquadramento ficam controláveis |

O caminho B também é mais barato de errar: a imagem sai em segundos e custa pouco; o 3D leva 1–3 min e custa mais.

### 4.2 O job

Reaproveitar o padrão do `Model3dService`, sem inventar máquina de estados nova: `PipelineJob` com
`QUEUED → PROCESSING → COMPLETED | FAILED`, timeout configurável e um reprocessamento grátis. Novo
`PipelineJobType.BODY_MESH_GENERATION`. Guardar no job: a ficha, o prompt, a imagem de referência (caminho B), o id
da tarefa no Meshy, o custo e o tempo — é esse registro que vira a tabela do TCC.

---

## 5. Etapa 4 — Pós-processamento (a parte que ninguém orça)

O GLB que volta **não serve como está**. No mínimo:

1. **Escala.** O Meshy devolve escala arbitrária. Normalizar pela altura informada: caixa delimitadora → altura =
   `heightCm`. Sem a altura informada, não há escala nenhuma — a foto não tem régua.
2. **Orientação e apoio.** Girar para frente em +Z, pés em y = 0, centrar em x.
3. **Sem articulações.** A malha não tem `joints` nem `levels`. Para o provador funcionar, é preciso **ajustar o
   corpo paramétrico à malha gerada** (encontrar os parâmetros que minimizam a diferença de silhueta) e usar esse
   ajuste como o corpo "de verdade". Ou seja: o paramétrico continua sendo o medidor; o Meshy vira a aparência.
4. **Orçamento de malha.** 30.000 triângulos por corpo, sem Draco/meshopt/KTX2 hoje, mais as peças, numa cena de
   celular. Medir FPS antes de adotar.

---

## 6. Os limites, item por item

Nenhum destes é opinião: são consequências do que a apuração e o código mostram.

| # | Limite | Consequência |
|---|---|---|
| 1 | **Não é a pessoa.** Um prompt textual não reproduz um rosto nem uma silhueta específica | o avatar "se parece com a descrição", não com quem enviou a foto |
| 2 | **Não é medível.** Não existe pedir "cintura 78 cm" a um gerador e receber 78 cm | some a origem por medida, que é o eixo de honestidade do projeto |
| 3 | **Não é reproduzível.** A mesma ficha gera corpos diferentes a cada execução | o "digital double" do provador deixa de ser o mesmo personagem entre sessões |
| 4 | **Sem esqueleto.** Casca fechada, sem ossos e sem pesos | incompatível com a Fase 1 do `plano-a-rig-e-rosto.md`; sem pose, sem roupa acompanhando |
| 5 | **Quebra o provador.** `garmentMold` deriva o molde de `s.torso` — cortes que a malha opaca não tem | o caimento atual para de funcionar, a menos que se faça o ajuste do §5.3 |
| 6 | **Custo por pessoa e por tentativa.** ~US$ 0,40 por corpo, mais a imagem no caminho B, mais cada refação | o paramétrico custa zero |
| 7 | **LGPD.** A ficha é derivada de biometria, e descrever o corpo de alguém em texto para um terceiro **continua sendo dado pessoal** | exige `AI_EXTERNAL_PHOTO_PROCESSING`, registro de destinatário e país |
| 8 | **Peso e sexo** | §2.2 — contradizem decisões já escritas no próprio TCC |

O ponto 3 é o mais subestimado: `TryOnService.resolve` foi escrito justamente para o manequim **ser** o avatar do
perfil. Um corpo que muda a cada geração desfaz essa identidade.

---

## 7. A variante que salva a ideia: Meshy como gerador de biblioteca

Quase tudo em §6 vem de gerar **um corpo por pessoa, em tempo de execução**. Tire essa premissa e o Meshy vira útil:

> Gere **offline**, uma vez, uma pequena biblioteca de corpos base — por sexo × compleição (por exemplo 2 × 5 = 10
> corpos) — usando exatamente o pipeline de prompt de §3. Revise à mão, rigue uma vez no Blender, e publique como
> asset do projeto. Em tempo de execução, a pessoa recebe o corpo da sua faixa, deformado pelas **medidas reais** da
> ficha.

O que isso resolve, ponto a ponto: custo por usuário volta a zero (1); as medidas continuam vindo da foto, aplicadas
como deformação (2); o corpo é o mesmo entre sessões (3); o rig é feito uma vez, à mão, e fica correto (4); e o
provador continua funcionando porque o corpo tem parâmetros conhecidos (5). A ficha (§2) e o prompt (§3) — as partes
que você quer — continuam sendo usados integralmente.

É também mais honesto no texto do TCC: "a IA generativa produziu a biblioteca de corpos base; as medidas de cada
pessoa vêm da foto dela" é uma frase defensável. "A IA gerou o corpo da pessoa a partir de uma descrição" não é.

---

## 8. Ordem de execução

| # | Etapa | Esforço | Observação |
|---|---|---|---|
| 1 | Ficha estruturada (§2) | 1–2 d | útil nos dois caminhos; faça primeiro |
| 2 | Gabarito de prompt determinístico (§3.1) | 1 d | sem LLM, sem custo |
| 3 | **Decidir: por usuário (§3–§5) ou biblioteca (§7)** | — | a decisão que muda tudo |
| 4a | Se biblioteca: gerar 10 corpos, revisar, rigar no Blender | 3–5 d | recomendado |
| 4b | Se por usuário: porta, job, pós-processamento | 6–10 d | some o custo recorrente e os limites de §6 |
| 5 | Avaliação com `eval-body.mjs` estendido (§1) | 2–3 d | é o que vira capítulo |

---

## 9. Critérios de aceitação do experimento

O caminho "um corpo por usuário" só deve ser adotado se, nas mesmas fotos:

1. O erro de proporção contra a ficha for **menor** que o do corpo paramétrico — e não é: o paramétrico adota as
   medidas observadas por construção, então o erro dele é zero onde há medida. Este critério praticamente já está
   decidido, e vale escrevê-lo assim no TCC.
2. Completude, conexões e simetria passarem nos mesmos invariantes.
3. IoU da silhueta e PCK **não piorarem**.
4. A mesma ficha, gerada duas vezes, produzir corpos com diferença abaixo de um limiar declarado — teste de
   reprodutibilidade que o caminho por usuário provavelmente reprova.
5. Custo e latência couberem no orçamento medido, não estimado.

Um resultado negativo aqui é publicável e economiza dinheiro: *"testamos gerar o corpo por IA generativa a partir de
uma ficha extraída da foto; o corpo sai plausível mas não é medível nem reproduzível, então a geração foi movida
para a produção offline da biblioteca de corpos base"*.

---

## 10. O que não fazer

- **Não** inferir peso nem sexo da foto (§2.2).
- **Não** deixar campo de origem `default` virar adjetivo no prompt: descreveria a referência, não a pessoa.
- **Não** mandar a ficha ou a foto para fora sem consentimento específico registrado.
- **Não** trocar o corpo paramétrico pelo Meshy antes de o experimento de §9 dar um veredito.
- **Não** exibir o corpo gerado sem dizer, na interface, que ele é uma **representação gerada**, e não uma medição.
