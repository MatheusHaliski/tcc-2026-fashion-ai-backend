# Etapa 4 — RF24: a IA do Fashion AI como requisito transversal

> **Decisão de modelagem.** A lista da Etapa 4 enumera dez capacidades de IA espalhadas por telas diferentes (Criar Look, Copilot, Adicionar Peça, DNA de Estilo, Provador, Marcas/Celebridades). Criar um RF por capacidade produziria dez requisitos que só diferem no prompt enviado ao mesmo motor. Criar um único RF guarda-chuva repetiria o erro do RF19.
>
> **Solução adotada:** **RF24 é o requisito do *motor* de IA** — contrato, limites, privacidade, degradação e rastreabilidade da inferência. **Cada capacidade é um CA de RF24 que aponta para o RF hospedeiro** onde a interface vive. Assim a IA tem dono único (um serviço, um conjunto de RNFs) e nenhuma tela fica sem requisito.

---

## RF24 — Prover capacidades de inteligência artificial ao usuário do Fashion AI

**Enunciado:** O sistema deve oferecer, por meio de um serviço interno de IA, capacidades de geração e de análise sobre o guarda-roupa, os esquemas e o perfil do usuário, com resposta rastreável, degradação controlada quando o provedor externo falhar e uso restrito aos dados que o usuário autorizou.

**Dependências:** RF2 (usuário autenticado), RF4 e RF5 (dados sobre os quais a IA opera), RNF3, RNF6, RNF8.
**Sprint sugerida:** 3 (motor + Copilot e detecção) e 4 (DNA, arte, provador).

### Critérios de aceite de RF24

| ID | Capacidade | RF hospedeiro | Dado que | Quando | Então |
|---|---|---|---|---|---|
| RF24.CA01 | **Detecção de peça** na aba "Adicionar nova peça" | RF4 | o usuário enviou a fotografia de uma peça | o upload conclui | o sistema devolve categoria, cor dominante, padrão e tipo de tecido com um índice de confiança, pré-preenchendo o formulário sem bloquear a edição manual |
| RF24.CA02 | **Criação de looks** por IA | RF5 | o usuário tem ≥3 peças e informou ocasião | aciona "gerar com IA" na aba Criar Look | o sistema devolve 3 composições distintas usando **apenas** peças do guarda-roupa do usuário |
| RF24.CA03 | **Sugestões do Copilot** (peças e looks) | RF10 | o usuário informou contexto (ocasião, humor, clima) | solicita sugestão | cada sugestão vem com justificativa em linguagem natural de no máximo duas frases |
| RF24.CA04 | **DNA de Estilo** — arquétipo, paleta, silhueta, índice de ousadia, peça ícone e Frase de Identidade | RF13 | o usuário atende aos pré-requisitos | gera o DNA | o sistema sintetiza numa frase única, sem apenas listar os campos: cruzando as Camadas 1 e 2 quando a Identidade de Vida foi preenchida, ou **somente a Camada 1 quando o usuário pulou o formulário** (RF13.CA03) |
| RF24.CA05 | **Perfil Lookbook** — organização e agrupamento sugeridos do acervo | RF6 | o Closet Digital tem ≥20 peças | o usuário abre o Lookbook | o sistema propõe agrupamentos por estilo/ocasião, sempre descartáveis pelo usuário |
| RF24.CA06 | **Recomendação de marcas e celebridades** afins ao perfil | RF14, RF22 | o usuário tem DNA de Estilo gerado | abre a aba Marcas ou Celebridades | o feed é ordenado por afinidade com o arquétipo, com a ordenação alternável para "mais recentes" |
| RF24.CA07 | **Geração de arte de fundo** (Background Studio) | RF11 | o usuário descreveu um cenário | confirma a geração | a arte é entregue em até 30 s ou o sistema informa o andamento do job |
| RF24.CA08 | **Sobreposição no Provador 2D** — recorte e ajuste da peça ao manequim | RF18 | a peça foi levada ao manequim | a sobreposição é calculada | a peça é recortada do fundo e escalada à camada correta do manequim escolhido |
| RF24.CA09 | **Sugestão de vínculo por selo** — indicar marca/celebridade compatível com o look criado | RF20, RF21 | o usuário terminou de compor um esquema | aciona "vincular" | o sistema sugere até 3 marcas/celebridades compatíveis, sem criar o vínculo automaticamente |
| RF24.CA10 | **Assistência na edição de esquema** | RF9 | o usuário está editando um esquema salvo | aciona "melhorar com IA" | o sistema propõe alterações (trocar peça, ajustar ocasião) como *diff* aceitável ou recusável item a item |
| RF24.CA11 | **Curadoria de Minhas Fotos** — deduplicação e sugestão de descarte | RF12 | o acervo tem fotos quase idênticas | o usuário abre "Minhas Fotos" | o sistema agrupa as duplicatas e sugere manter a de melhor qualidade, nunca excluindo sozinho |
| RF24.CA12 | **Transparência da inferência** | transversal | qualquer resposta de IA é exibida | o usuário aciona "por quê?" | o sistema informa quais dados alimentaram a inferência e qual provedor foi usado (**RNF6**) |
| RF24.CA13 | **Degradação controlada** | transversal | o provedor externo está indisponível, lento ou acima da cota | o usuário aciona uma função de IA | o sistema informa a indisponibilidade e, quando houver, aplica o fallback por regras locais, sem travar a interface (**RNF8**) |
| RF24.CA14 | **Limite de uso** | transversal | o usuário excedeu a cota diária de chamadas de IA | aciona nova geração | o sistema informa a cota, o horário de reposição e mantém as demais funções operantes |
| RF24.CA15 | **Consentimento de uso de dados** | transversal | o usuário não autorizou o envio de fotos a provedores externos (RF3.CA06) | aciona uma função que dependeria desse envio | o sistema executa apenas o processamento local possível e explica a limitação |
| RF24.CA16 | **Registro da inferência** | transversal | qualquer chamada de IA é executada | a resposta retorna | ficam registrados usuário, função, provedor, modelo, latência e custo estimado (**RNF5**) |

---

## Tabela RF × serviço externo de IA

Legenda de custo: **G** gratuito / free tier suficiente para o TCC · **P** pago por uso · **H** híbrido (free tier + excedente pago).

| CA / RF | Capacidade | Serviço recomendado | Alternativa | Custo | Observação para o TCC |
|---|---|---|---|---|---|
| RF24.CA01 / RF4 | Detecção e classificação de peça | **Google Gemini Flash (Vision)** | Claude Haiku (visão), YOLOv8 auto-hospedado | **H** | Free tier do Gemini cobre o volume de demonstração. YOLO local é o plano B sem dependência de rede. |
| RF24.CA01 / RF4 | Remoção de fundo da peça | **rembg** (auto-hospedado, ONNX) | remove.bg API | **G** / P | Já há `REMOVE_BG_API_KEY` no projeto atual; migrar para rembg elimina custo e dependência externa. |
| RF24.CA02 / RF5 | Composição de looks | **Claude (Anthropic API)** | Gemini Flash | **P** | Tarefa de raciocínio combinatório com restrição ("só peças do acervo") — modelo de texto com *tool use* sobre o catálogo. |
| RF24.CA03 / RF10 | Copilot: sugestões + justificativa | **Claude (Anthropic API)** | Gemini Flash | **P** | Mesma rota de RF24.CA02, com prompt de justificativa curta. |
| RF24.CA04 / RF13 | Frase de Identidade do DNA | **Claude (Anthropic API)** | GPT-4o mini | **P** | Precisa sintetizar, não listar — exige modelo forte em texto. |
| RF24.CA04 / RF13 | Paleta cromática dominante | **processamento local** (k-means sobre as imagens) | Cloud Vision Image Properties | **G** | Não terceirizar: é determinístico, barato e evita enviar fotos a terceiros (**RNF6**). |
| RF24.CA05 / RF6 | Agrupamento do acervo | **embeddings + clustering local** | Vertex AI Matching Engine | **G** | Embeddings gerados uma vez por peça; clustering roda no backend. |
| RF24.CA06 / RF14, RF22 | Afinidade perfil ↔ marca | **similaridade de embeddings local** | — | **G** | Reaproveita os embeddings de RF24.CA05. |
| RF24.CA07 / RF11 | Geração de arte de fundo | **Adobe Firefly** (Etapa 6) | Stable Diffusion via Replicate; Gemini Image | **H** / P | Firefly é a escolha do time para as pranchas; para geração em runtime, avaliar cota. |
| RF24.CA08 / RF18 | Sobreposição no Provador 2D | **FASHN.ai** (já integrado) | IDM-VTON via Replicate | **P** | `FASHN_API_KEY` já existe no `.env.example`. |
| RF24.CA09 / RF20, RF21 | Sugestão de vínculo por selo | **similaridade de embeddings local** | Claude com catálogo em contexto | **G** | Sugerir é barato; a decisão continua humana (RF20.CA03). |
| RF24.CA10 / RF9 | Assistência na edição | **Claude (Anthropic API)** | Gemini Flash | **P** | Resposta precisa ser um *diff* estruturado → usar saída em JSON validada por schema. |
| RF24.CA11 / RF12 | Deduplicação de fotos | **hash perceptual local** (pHash) | — | **G** | Zero custo e zero envio de dados. |
| RF16 | Geração 3D da peça | **Meshy** (já integrado) | Blender headless auto-hospedado (já há `blender-worker/`) | **P** / G | Stretch goal; manter atrás de *feature flag*. |
| — | Clima para o Copilot | **Open-Meteo** | OpenWeather | **G** | Open-Meteo não exige chave. |
| — | E-mail transacional (RF3.CA07) | **Resend** | SMTP institucional | **H** | `RESEND_API_KEY` já existe. |

### Regras que valem para toda integração de IA (derivam de RNF8)

1. **Toda chamada externa passa por uma porta** (`AiProviderPort`), nunca pelo SDK direto no controller — permite trocar provedor sem tocar em regra de negócio.
2. **Timeout obrigatório** (30 s) + **1 retry** com *backoff* + ***circuit breaker*** por provedor.
3. **Fallback declarado por capacidade** — cada linha da tabela acima precisa responder "o que acontece se cair?" antes de ir para a sprint.
4. **Nenhuma chave de API no frontend.** Toda chamada sai do backend Java (ver `01-bootstrap-repo-java.md`).
5. **Custo observável**: RF24.CA16 registra custo estimado por chamada — sem isso não há como defender a escolha de provedor na banca.
