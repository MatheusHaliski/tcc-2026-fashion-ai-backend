# FashionAI como app de loja (App Store, PlayStation Store, Xbox) com Unreal Engine para o FLAIR 3D

> Estudo feito em 07/11/2026 a pedido da dona do projeto: "projetar o app como um aplicativo de Apple Store/PS Store/Xbox
> Store, para poder renderizar os gráficos do FLAIR 3D. A versão web app (fashion-ai.com) é temporária e vamos utilizar
> como teste para o futuro aplicativo que suportará uma carga maior de dados e Unreal Engine 3D".
>
> **Legenda**: **[D]** documentado em fonte oficial (Epic, Apple, Sony, Microsoft, Google, lei ou órgão público);
> **[P]** imprensa, blog técnico ou fórum; **[I]** inferência deste estudo. **[verificar]** = reconfirmar na fonte no
> dia em que o item for implementado. Nada aqui foi submetido a nenhuma loja; não é parecer jurídico.
>
> Complementa `docs/multiplataforma/` (plano de 10/10/2026, esqueleto em `clients/unreal/FashionAI/`). Este documento
> foca o FLAIR 3D e **corrige três pontos** daquele plano: a licença do MetaHuman mudou em 2025 (§1.4); a diretriz
> Apple 4.8 não exige mais "Sign in with Apple" por nome (§2.1); e o ECA Digital proíbe caixas de recompensa para
> menores desde 17/03/2026 (§3.4). Contexto do jogo: `docs/flair/flair-3d/CINCO_JOGOS.md`,
> `docs/flair/cbc/CINCO_ELENCOS.md`, `docs/flair/cbc/FLAIR_CBC.md` e `docs/flair/3d-puzzles/*.md`.

## 0. Resumo executivo

1. **Motor**: Unreal Engine **5.8** (junho/2026) é a versão atual e, segundo a Epic, a última grande versão da UE5;
   a UE6 deve ter prévias em 2027 [D/P]. Começar na 5.8 e planejar migração para a 6 na fase de consoles [I].
2. **Licença**: grátis até US$ 1 mi de receita bruta vitalícia **por produto**; depois, 5% sobre o que passar disso,
   contando compras dentro do app e publicidade, cobrados pelo bruto (antes da taxa da loja) [D/P].
3. **iPhone/iPad não rodam Lumen** e Nanite não é suportado oficialmente no iOS [D]. O FLAIR 3D no celular usa o
   renderizador Mobile, com luz pré-calculada e LODs; o visual "Lumen" fica para Mac M2+, PC e consoles [D/I].
4. **MetaHuman** deixou de ser exclusivo da Unreal (junho/2025) e roda em celular com LOD 3, cabelo em cards e
   texturas de 2048 [D]. O rosto do avatar do jogador é dado biométrico pela LGPD; tratar com cuidado (§3.4).
5. **Apple**: US$ 99/ano; moedas e pacotes digitais só por compra dentro do app (IAP); cupons de produto físico,
   ingressos e meet-and-greet ficam fora do IAP; sorteio ou concurso precisa ter o próprio FashionAI como
   patrocinador, com regulamento no app dizendo que a Apple não participa [D].
6. **Brasil, 2026**: com caixas de recompensa o app vira 18+ na App Store do Brasil [D], e o ECA Digital as proíbe
   para crianças e adolescentes [D]. **Pacote FLAIR aleatório pago está fora** para um público 13+ [I].
7. **Consoles**: PlayStation exige cadastro no PlayStation Partners, conceito aceito e acordos; os requisitos de
   certificação (TRC) ficam sob NDA [D/P]. No Xbox, a documentação do GDK ficou pública em 2026, o ID@Xbox não cobra
   taxa de certificação e os kits saem com o conceito aprovado [D]. Os dois exigem empresa constituída [I].
8. **Web continua**: rede social, loja, guarda-roupa, administração e o resgate de prêmios reais ficam em
   fashion-ai.com; o app nativo concentra os 5 jogos FLAIR 3D, o provador 3D e o CBC [I].
9. **Pixel Streaming** só serve para testes e demonstrações com hora marcada: cada sessão ocupa uma GPU na nuvem
   (~US$ 0,50/h por GPU T4 nos EUA) [D/P].
10. **Roteiro** (§4.3): Fase 0 web e protótipo (3–4 meses), Fase 1 iOS/iPadOS (9–15 meses), Fase 2 Windows/Mac
    (+3–6 meses), Fase 3 consoles (+9–18 meses após aprovação). Uma equipe de TCC entrega com realismo a Fase 0 e um
    vertical slice de **um** jogo; os cinco jogos pedem equipe profissional [I].

## 1. Unreal Engine 5 para o FLAIR 3D

### 1.1 Versão

- **UE 5.8**, lançada em 17/06/2026, com MegaLights pronto para produção, **Lumen Lite** (beta, iluminação global média
  "duas vezes mais rápida que o Lumen de alta qualidade", suportada em PC), MetaHuman Crowds (experimental) e Chaos
  Cloth "production ready" [D: notas de versão 5.8]. A Epic diz que a 5.8 é a última grande versão da UE5 [P].
- SDKs mínimos na 5.8 [D]: **Xcode 26** (recomendado 26.1.1), alvo iOS/iPadOS **17+** (iPhone 11 ou posterior);
  Windows SDK 10.0.22621+; PS5 Prospero SDK 12+; Xbox GDK abril/2026; Android SDK 26+. Desde 28/04/2026 a App Store
  só aceita builds feitos com Xcode 26 e SDK 26 [D].
- **UE6**: imprensa fala em prévia ou acesso antecipado em 2027 [P]. Não começar na UE6; manter o código do FLAIR em
  módulos C++ pequenos para facilitar a migração [I].
- A UE5 **não exporta para navegador** (o alvo HTML5 saiu do motor na época da 4.24) [P]. No web, o 3D continua em
  Three.js/React Three Fiber, e a Unreal só aparece no navegador via Pixel Streaming (§1.7) [I].

### 1.2 Licença e royalties

| Ponto | Regra | Fonte |
|---|---|---|
| Uso | Grátis para criar; o royalty só incide em "produto pronto" que embute código da Unreal (um jogo ou app distribuído) | [D] |
| Taxa | **5%** da receita bruta vitalícia **acima de US$ 1 mi por produto** (ex.: US$ 2 mi brutos → 5% de US$ 1 mi = US$ 50 mil) | [D/P] |
| O que conta | Receita bruta vinda de usuários finais, quem quer que a receba: venda do app, compras dentro do app, DLC e publicidade no app; calculada **antes** da taxa de 15–30% da loja | [D/P] |
| Isenções | Vendas na **Epic Games Store** e compras feitas com o pagamento da Epic; primeiro US$ 1 mi; contratos customizados (royalty negociado) | [D/P] |
| Launch Everywhere | Royalty de **3,5%** para jogos de Windows, macOS e Android lançados na Epic Games Store antes ou junto das outras lojas (desde 01/2025); no lançamento do programa, iOS e consoles não entravam | [P] |
| Formalidades | Avisar a Epic do lançamento (Release Form) e informar a receita por trimestre | [P] |
| Empresas não jogo | Assinatura por assento (US$ 1.850/ano) para empresas com mais de US$ 1 mi/ano que **não** distribuem app com código Unreal | [D/P] |

**Para o FashionAI** [I]: o app nativo é um produto distribuído, então vale o regime de royalty, como diz o
`docs/multiplataforma/05` §4. Cupons e ingressos de marca dados como prêmio não são receita de usuário final.
Já patrocínio de marca **dentro** do app pode ser lido como receita "atribuível ao produto". Confirmar com a Epic por
escrito antes de fechar contrato com marca [verificar].

### 1.3 O que cada plataforma renderiza de fato

| Alvo | Renderizador e recursos | Limites que importam para o FLAIR 3D |
|---|---|---|
| **iPhone/iPad** (Metal) | Renderizador **Mobile**; na 5.8 o padrão móvel é o deferred multi-pass [D]. **Lumen não funciona em iOS/iPadOS** [D]; Lumen móvel é experimental e só no Android de ponta [D]. Nanite **não consta** como suportado em iOS; há relatos de hacks em fórum [D/P]. Shader Model 6 em iOS é experimental, A15+ [D] | Cada cenário pede luz pré-calculada (lightmaps), reflection captures, LODs manuais, até 75 ossos por personagem e texturas de até 2048 [D/I]. Memória: um iPhone 13 libera ~2,2 GB ao app com a entitlement `increased-memory-limit` [D/P]. Calor: aparelhos reduzem o clock em sessões longas; a meta é 30 fps estáveis e não 60 [I] |
| **Mac** (Apple Silicon) | Desktop renderer; **Nanite em M2 ou posterior** com SM6 e macOS 15+; M1 fica de fora [D: blog Epic] | Lumen: suporte em Mac existe, mas o desempenho tem de ser medido; usar Lumen Lite onde houver [I/verificar] |
| **Windows** | Recurso completo: Lumen, Lumen Lite, Nanite, MegaLights, cabelo em fios (groom), Chaos Cloth em tempo real [D] | Variedade de GPU: perfis de escalabilidade (`docs/multiplataforma/04`) |
| **PS5** | Recurso completo da UE5 (Lumen/Nanite), SDK por acesso concedido [D/P] | Certificação TRC; meta de 30 ou 60 fps decidida por cenário [I] |
| **Xbox Series X\|S** | Recurso completo; o **Series S** (menos memória e GPU) é o piso [P] | Medir cada cenário no Series S primeiro [I] |

**Consequência para os 5 jogos** [I]: os cenários (suíte, camarim, rooftop, boutique, salão de gala) são interiores
pequenos e de luz controlada. É o melhor caso para luz pré-calculada no celular. O pôr do sol do rooftop varia de
luz: no iOS ele usa 3–4 estados de luz pré-calculados com transição, e não iluminação global dinâmica. Os efeitos
Aura Hype (partículas Niagara), Metamorfose (troca de material) e Impersonation (avatar vestindo a peça) cabem no
renderizador Mobile se o número de partículas e de materiais ficar dentro de orçamento medido em aparelho real.

### 1.4 MetaHuman para protagonistas e avatar

- **Licença** [D/P]: desde 04/06/2025 (UE 5.6), o MetaHuman segue o EULA padrão da Unreal. Personagens e animações
  MetaHuman passaram a ser "non-engine products": **podem ser usados em outros motores** (Unity, Godot) e vendidos
  em marketplaces. É proibido usá-los para treinar ou melhorar modelos de IA. A regra antiga de "só renderizar na
  Unreal" **não vale mais**.
- **Celular** [D]: a especificação oficial para iOS/Android prevê, no máximo, o **LOD 3**, cabelo em *cards* (fios
  são pesados demais), texturas de 2048, sem ray tracing e até 75 ossos. O projeto de exemplo traz configurações
  para iOS e Android.
- **Protagonistas fictícios** (Lina Vale e outros): MetaHuman Creator dentro da Unreal [D]. Cabelo em cards no
  celular e em fios no PC e nos consoles [I].
- **Avatar do jogador** [I]: o FashionAI já tem identidade canônica do avatar (`docs/multiplataforma/03`). Há dois
  caminhos: (a) manter o corpo canônico próprio (MPFB2) importado na Unreal, que é o plano atual; ou (b) gerar um
  MetaHuman a partir do rosto (Mesh to MetaHuman). O caminho (b) usa serviços de nuvem da Epic para rig e textura
  [P], ou seja, envia **dado biométrico de menor** a terceiro fora do Brasil. Para o público 13+, recomendo (a), com o
  MetaHuman só para os personagens fictícios.

### 1.5 Simulação de roupa (Chaos Cloth)

- **Chaos Cloth** está "production ready" na 5.8, com o Panel Cloth Editor baseado em painéis (molde) [D]. O ML Cloth
  (Machine Learning Cloth) aprende com simulação offline e roda leve em memória e processamento [D]. Há relatos de
  arestas no pipeline do ML Deformer na 5.8 [P].
- **Uso no FLAIR** [I]: no PC, Mac e consoles, simulação em tempo real para vestidos e saias na Impersonation. No
  celular, simulação só na peça em destaque (1 peça, poucos vértices) e animação pré-gravada ou ML Cloth nas
  demais; a carta "encaixada" no soquete 3D é malha rígida com animação de encaixe, sem simulação.
- Toda peça que veste precisa passar pelo gate de asset (`GarmentFitGate`, `docs/multiplataforma/03`), com
  retopologia, rig e LOD feitos por artista. A geração automática sozinha não basta [I].

### 1.6 Tamanho do pacote e download sob demanda

- **Formato** [D]: o build "cozinhado" vai em contêineres **Pak** e **IoStore** (`.pak`, `.utoc`, `.ucas`). Os
  *Primary Asset Labels* dividem o conteúdo em **chunks**, e o **ChunkDownloader** baixa e monta chunks de uma CDN
  própria a partir de um manifesto. O **IoStore OnDemand** (instalação e streaming sob demanda) ainda está no
  caminho `Experimental` do motor, e a API mudou entre a 5.4 e a 5.6 [D]. Na Android, a Unreal tem plugin para o Play
  Asset Delivery [D].
- **Apple** [D]: app até **4 GB** descompactado (executável até 500 MB). Para conteúdo maior, a Apple recomenda
  **Background Assets**, inclusive *asset packs* hospedados pela Apple. Fórum aponta limite de 200 GB por app e
  falhas de download em iOS 26.4–26.6 [P].
- **Proposta** [I]: o app base traz a interface, o avatar e o jogo 1 (Espelho Partido). Cada um dos outros 4 cenários
  vira um chunk de 150–400 MB no celular, baixado ao abrir o capítulo. As cartas (peças) vêm por manifesto do backend,
  com hash de conteúdo, em 3 perfis (`MOBILE_LOW`, `MOBILE_HIGH`, `DESKTOP_HIGH`) já previstos em
  `docs/multiplataforma/02`. Usar ChunkDownloader com CDN própria nos cenários (funciona em todas as lojas) e deixar
  Background Assets/Play Asset Delivery como otimização posterior. **Atualização de conteúdo** (cartas novas) não
  exige nova revisão de loja; **código** novo exige [D/I].

### 1.7 Pixel Streaming na transição (UE dentro do fashion-ai.com)

- **Como funciona** [D]: um app Unreal empacotado roda numa máquina com GPU e envia vídeo por **WebRTC** ao navegador.
  Os serviços web (Signalling Server, Matchmaker, SFU) ficam no GitHub da Epic. É preciso servidor STUN/TURN
  (por exemplo, coturn) para redes restritas. A Epic recomenda autoescala própria ou de terceiros para produção.
- **Limites** [D/P]: em GPU NVIDIA, a partir da 9ª transmissão simultânea o encoder passa a ser por software. Na
  prática é **uma instância Unreal por jogador** em interação (fórum recomenda uma por GPU). A latência depende da
  distância até o datacenter. No celular, a transmissão consome dados móveis (vídeo contínuo de vários Mbps).
- **Custo** [D/P/I]: uma `g4dn.xlarge` (GPU T4) custa **US$ 0,526/h** sob demanda em us-east-1 [D: tabela de preços].
  A região São Paulo é mais cara [verificar]. Com 1 sessão por GPU, 100 jogadores × 20 min/dia ≈ 33 h-GPU/dia ≈
  **US$ 500–700/mês** só de GPU, sem contar TURN e banda. Provedores gerenciados (Eagle 3D, CoreWeave e outros)
  cobram por minuto ou por GPU [P].
- **Recomendação** [I]: usar Pixel Streaming **só na Fase 0** para (1) mostrar à banca e a parceiros de marca a cena
  Unreal sem instalar nada e (2) testar cenários, câmera e encaixe com usuários convidados, com sessão agendada e
  teto de horas. Não usar como modo público do FLAIR: o custo cresce linearmente e o app nativo é o objetivo.
  Pixel Streaming é uma forma de distribuição do produto e conta para royalty se gerar receita [verificar].

## 2. Caminhos de loja

### 2.1 Apple App Store (iPhone, iPad e, depois, Mac)

- **Programa** [D]: Apple Developer Program, US$ 99/ano, que cobre iOS, iPadOS e macOS. Conta de **organização**
  (CNPJ + D-U-N-S) recomendada para aparecer como FashionAI e não como pessoa física [I]. Small Business Program:
  comissão de 15% para quem fatura até US$ 1 mi/ano [D].
- **3.1.1 — compra dentro do app** [D]: "moedas de jogo", níveis, conteúdo premium e funções exigem IAP.
  **FAI Points pagos, pacotes FLAIR e cartas pagas só via StoreKit.** Vale-presentes, vouchers e cupons
  **resgatáveis em bens digitais** só podem ser vendidos via IAP. Caixas de recompensa exigem mostrar as chances
  antes da compra.
- **3.1.3(b) — multiplataforma** [D]: o app pode liberar o que foi comprado em outra plataforma ou no site, inclusive
  consumíveis, **desde que os itens também estejam à venda como IAP no app**.
- **3.1.3(e) — bens e serviços fora do app** [D]: produtos físicos ou serviços consumidos fora do app **devem** usar
  outro meio de pagamento. **Cupom de desconto numa loja de marca, ingresso de show e meet-and-greet** são bens e
  serviços fora do app. Dados como prêmio, não há pagamento a processar [I].
- **Brasil, junho/2026** [D]: após acordo com o CADE, apps no Brasil podem oferecer pagamento alternativo ao lado do
  IAP ou link para o site. As comissões ficaram em 10% (pequenas empresas) ou 21%, mais 5% de processamento quando
  se usa IAP, e 15% (ou 10%) sobre compras feitas via link. Para **menores de 18**, o pagamento alternativo exige
  *parental gate* e **link de compra para o site é proibido**. Como o público começa aos 13, o fluxo de menor
  continua em IAP [I].
- **5.3 — jogos, concursos e sorteios** [D]: 5.3.1 sorteios e concursos devem ser **patrocinados pelo desenvolvedor
  do app**; 5.3.2 regulamento oficial **dentro do app** deixando claro que **a Apple não é patrocinadora** nem
  participa; 5.3.3 IAP não pode comprar crédito para jogo com dinheiro real. **Impacto** [I]: o regulamento do CBC
  precisa ter o FashionAI como promotor (a marca entra como fornecedora do prêmio), ficar visível no app e citar a
  Apple. Mesmo sem sorteio, prêmio por desempenho é "concurso".
- **1.2 — conteúdo gerado por usuário** [D]: filtro de conteúdo ofensivo, denúncia com resposta rápida, bloqueio de
  usuários abusivos e contato publicado. Afeta looks, posts, desafios da comunidade e a arte final do CBC com as
  peças do jogador.
- **5.1 — privacidade** [D/I]: "rótulo nutricional" (App Privacy) e Privacy Manifest declarando fotos, rosto e corpo,
  compras e identificadores; texto de finalidade para câmera e fotos. **5.1.2(vi)**: dados de mapeamento facial ou de
  profundidade obtidos por ARKit e APIs de câmera ou fotos **não podem ser usados para marketing, publicidade ou
  mineração de uso**, nem por terceiros. Isso vale para o busto do avatar. **2.5.13**: se houver login por rosto,
  usar LocalAuthentication (Face ID) e oferecer alternativa para menores de 13.
- **4.8 — login** [D]: se houver login social de terceiro (Google, etc.) para a conta principal, é preciso oferecer
  **também** um login equivalente que limite os dados a nome e e-mail, permita esconder o e-mail e não rastreie para
  publicidade sem consentimento. O texto atual não nomeia o "Sign in with Apple", mas ele atende ao requisito e é o
  caminho mais simples [I]. O login próprio por e-mail e senha não dispara a 4.8.
- **5.1.1(v) — exclusão de conta** [D]: app que cria conta precisa permitir **excluir a conta dentro do app**
  (bloqueio B1 de `docs/multiplataforma/01` §4).
- **Classificação etária** [D]: desde 2025 as faixas são 4+, 9+, **13+**, 16+ e 18+, por questionário no App Store
  Connect. Há perguntas novas (localização compartilhada, namoro) com prazo informado pela imprensa até 12/01/2027
  [P]. **Brasil (24/02/2026)**: app que declara **caixas de recompensa** passa a **18+** na vitrine brasileira; apps
  18+ só são baixados por adultos confirmados; a **Declared Age Range API** dá a faixa etária com consentimento [D].
  Fórum relata a API sem resposta em produção no Brasil [P].
- **Mac** [I]: build macOS separado (Mac App Store ou distribuição notarizada), na Fase 2.

### 2.2 PlayStation Store (PS5)

- **Entrada** [D]: cadastro em **partners.playstation.net** ("PlayStation Partners"). Depois do cadastro e do
  *onboarding*, a Sony analisa o **conceito do jogo**. Aceito o conceito, o programa de empréstimo dá **1 kit de
  desenvolvimento + 1 kit de teste PS5 gratuitos**, a devolver em até 2 anos (programa anunciado em 07/2022). A
  página pública remete a uma lista de **países suportados**, que não conseguimos ler sem login: confirmar se o Brasil
  está nela [verificar].
- **Unreal no PS5** [D]: a Epic só libera o código e a documentação de console a quem prova ser desenvolvedor
  aprovado pela plataforma, mediante NDA de console da Epic, sem custo extra de motor.
- **O que é público × NDA** [D/P]: público é o cadastro, o empréstimo de kits e a existência da certificação. **Sob
  NDA**: SDK, **TRC** (checklist técnico de certificação), regras de loja, de conta de menor e de trocas entre
  plataformas, taxas e prazos de certificação. A comissão de 30% em console é amplamente noticiada [P].
- **Exigências práticas** [P]: empresa constituída, e-mail de domínio corporativo, IP fixo ou VPN para o portal,
  pitch e, muitas vezes, protótipo jogável. A aprovação leva semanas a meses (fóruns citam 4–8 semanas para cadastro
  e até ~3 meses para o acesso de console da Epic) [P].
- **Certificação** [P]: planejar pelo menos **um ciclo de reprovação e reenvio** e um passe completo de regressão de
  TRC 4–6 semanas antes do envio. A Sony não publica prazos oficiais [P/I].
- **Não documentado publicamente** [I]: se a Sony aceita prêmios físicos de marca, cupons e meet-and-greet ligados a
  um jogo; regras de UGC e de rosto do avatar no PS5; e se a política de "cross-platform revenue share" de 2019
  (royalty quando a receita fora do PlayStation supera a de dentro, revelada no processo Epic × Apple) ainda vale [P].

### 2.3 Xbox (Series X|S e Windows/PC)

- **ID@Xbox** [D]: sem taxa para entrar, certificar, publicar ou atualizar; pode haver uma taxa única pequena no Partner
  Center. Requisitos: ter 18+ (ou um responsável inicia o vínculo), assinar NDA e estar em país onde a Microsoft opera.
  Para liberar console e os serviços Xbox completos, o **conceito** é enviado pelo **Xbox Onboarding Hub** para
  análise. Todo jogo do programa passa por revisão de confiança e segurança do jogador.
- **GDC 2026** [D]: documentação Xbox **pública** sem NDA, ambiente de desenvolvimento pronto "em cerca de 30
  minutos", contratos automáticos por etapa, GDK para PC como projeto x64 padrão, validação de certificação no
  empacotamento e **PlayFab gratuito** para jogos lançados no Xbox. Os kits de console continuam ligados ao conceito
  aprovado [D/P].
- **Certificação** [D/P]: cumprir os **Xbox Requirements (XR)**. O pacote é MSIXVC via GDK. O acesso à Unreal para
  Xbox exige provar o status de desenvolvedor aprovado e aceitar o NDA de console da Epic [D].
- **PlayFab/Xbox services** [D/P]: o PlayFab cortou o modo gratuito de desenvolvimento para 1.000 usuários por título
  (março/2026). O "Foundation Mode" é gratuito para títulos no Xbox [P/verificar]. O FashionAI já tem backend próprio:
  usar só os serviços Xbox obrigatórios (conta Xbox, conquistas se exigidas) e manter a conta FashionAI no Spring [I].
- **Creators Program / UWP** [D/P/I]: a UWP está oficialmente depreciada pela Microsoft. Fóruns relatam que o Partner
  Center deixou de aceitar UWP no Creators Program, e a Microsoft não confirmou o fim oficial [P]. A Unreal 5 não
  gera UWP. **Para o FashionAI, o caminho é ID@Xbox + GDK** [I].
- **Comissão** [P]: 12% em jogos de PC na Microsoft Store desde 2021; 30% em console.

### 2.4 Google Play / Android (nota)

- No Brasil, o Android tem **~75–79%** dos celulares e o iOS **~21–25%** (StatCounter, jun–ago/2026) [D/P]. Lançar só
  em iOS deixa de fora a maior parte do público brasileiro [I].
- A Unreal usa o mesmo renderizador Mobile no Android; o trabalho extra é a variedade de GPUs (Adreno, Mali, Xclipse)
  e de memória [D/I]. O plano anterior (`docs/multiplataforma/05`) já punha Android no lançamento 1. **Sugestão** [I]:
  Fase 1 em iOS/iPadOS como referência de qualidade e, logo depois (Fase 1b), Android de ponta com lista de aparelhos
  permitidos. Play Console custa US$ 25 uma vez; classificação via IARC [D].

## 3. Questões que cruzam plataformas

### 3.1 Uma conta FashionAI em web e lojas

| Ponto | Proposta | Base |
|---|---|---|
| Identidade principal | `users.id` (UUID) do Spring; contas de loja (Apple, PSN, Xbox, Google, Epic) **vinculadas**, nunca substitutas | `docs/multiplataforma/02` §2 [I] |
| Celular | Login próprio (e-mail/senha ou passkey) + Sign in with Apple se houver Google/social (4.8) | [D/I] |
| Consoles | Pareamento por código (*device authorization*): a TV mostra um código, a pessoa confirma no celular | [I] |
| Vínculo de plataforma | O SDK de cada plataforma emite um token, o backend valida no servidor da plataforma e grava em `linked_platform_accounts`. Opcional: Epic Online Services (Connect) é **gratuito** e já faz vínculo entre PSN, Xbox, Steam e Epic [D] | [D/I] |
| Menores | Respeitar controle parental de cada console e o ECA Digital (vínculo a responsável quando houver rede social, §3.4) | [D/I] |
| Exclusão | Excluir no app (Apple) e no web; desvincular plataforma não apaga a conta | [D] |

### 3.2 Compras, carteiras e progresso

- **Progresso compartilhado** (cartas ganhas jogando, FAI Points ganhos, XP, elencos CBC concluídos) pode valer em
  todas as plataformas: é dado da conta, não compra [I]. Nos consoles, os contratos sob NDA podem restringir até isso
  [verificar].
- **Saldo comprado com dinheiro** [D/P/I]: Apple aceita usar no iOS o que foi comprado fora, desde que também esteja à
  venda por IAP (3.1.3(b)). Sony tinha política de compensação quando a receita sai do PlayStation [P]. Regra
  conservadora: **carteira paga separada por loja** (`entitlements.store`), saldo **ganho** comum.
- **Taxas** [D/P]: Apple 15% (Small Business) ou 30%; no Brasil, 10% ou 21% + 5% de IAP, ou 15% por link [D]; Google
  15% no primeiro US$ 1 mi/ano [verificar]; Microsoft PC 12%; consoles 30% [P]. A royalty da Unreal (5% acima de
  US$ 1 mi) incide **sobre o bruto**, antes dessas taxas [D/P].
- **Recomendação** [I]: no lançamento, **não vender FAI Points nem pacotes**. Monetizar com parcerias de marca,
  assinatura premium (se houver) e itens cosméticos **de conteúdo visível antes da compra**. Isso evita IAP de moeda,
  política de saldo entre lojas e a classificação 18+ (§3.4).

### 3.3 Prêmios reais do CBC (cupom, ingresso, meet-and-greet, arte numerada)

| Prêmio | Apple | Consoles | Brasil |
|---|---|---|---|
| Cupom de desconto para produto físico de marca | Fora do IAP (3.1.3(e)); concurso com o FashionAI como patrocinador e regulamento no app (5.3) [D] | Não público; perguntar à Sony e à Microsoft [I] | Prêmio de concurso com fim promocional (Lei 5.768) [D/I] |
| Ingresso de show, meet-and-greet | Serviço fora do app (3.1.3(e)) [D] | Idem [I] | Idem; para menor, autorização do responsável já prevista no `FLAIR_CBC.md` [I] |
| Arte exclusiva numerada (digital) | Dada por mérito: livre; se for vendida: IAP (3.1.1); não usar NFT ou cripto (3.1.5) [D/I] | Item digital da conta; venda pela loja do console [P/I] | Sem impacto específico [I] |
| Peça ou acessório físico da marca | Fora do IAP [D] | Não público [I] | Lei 5.768 + Código de Defesa do Consumidor na entrega [I] |

**Proposta** [I]: o app mostra o prêmio, o regulamento e o status. **Resgate e dados de entrega** (endereço,
documento do ingresso) ficam no **fashion-ai.com**, como já previsto no `FLAIR_CBC.md`. Isso reduz a exposição às
regras de console e o dado pessoal guardado no app.

### 3.4 Lei brasileira

- **Lei 5.768/1971 (promoção comercial)** [D/P]: a distribuição gratuita de prêmios com fim promocional por
  **sorteio, vale-brinde, concurso ou operação assemelhada** depende de **autorização prévia da Secretaria de
  Prêmios e Apostas (SPA/MF)**. A exceção do art. 3º, II vale para concurso **exclusivamente cultural, artístico,
  desportivo ou recreativo**, sem sorte, sem pagamento e sem vínculo com compra. Análise jurídica aponta que **exigir
  cadastro** pode tirar o caráter exclusivamente cultural [P]. A Portaria SPA/MF 1.818/2026 detalhou sanções [P].
  **Leitura para o CBC** [I]: o plano atual (mérito, ordem de conclusão enquanto houver estoque, sem sorteio) evita
  o sorteio, mas prêmio de marca com fim promocional e conta obrigatória **provavelmente** é "concurso" que pede
  autorização. A ordem de chegada pode ser lida como "operação assemelhada". **Pedir parecer** antes de dar prêmio
  real; até lá, usar só prêmios digitais e cupons emitidos pela própria loja da marca.
- **ECA Digital, Lei 15.211/2025, em vigor desde 17/03/2026** (Decreto 12.880/2026; fiscalização da ANPD) [D]:
  - **caixas de recompensa proibidas** em jogos voltados a crianças e adolescentes ou de acesso provável por eles. A
    definição cobre itens ou vantagens **aleatórios** pagos com dinheiro ou moeda do jogo. Versões sem caixa de
    recompensa dispensam a verificação de idade [D/P]. **Pacote FLAIR aleatório comprável, mesmo com FAI Points,
    fica proibido** para o público 13+. Cartas pagas precisam ter conteúdo conhecido antes da compra [I];
  - jogos com interação entre usuários: moderação e, **por padrão**, funções de interação limitadas até o
    consentimento dos pais ou responsáveis [D];
  - supervisão parental (compras, contatos, tempo de uso), padrões de privacidade mais protetivos e limites a
    recompensa por tempo de uso e notificações que prendem o usuário [D]. Isso afeta *streaks* e notificações do
    FLAIR [I];
  - redes sociais: contas de menores de 16 vinculadas a um responsável. Para conteúdo impróprio a menores de 18, a
    verificação de idade não pode ser autodeclarada [D]. Multas de até R$ 50 milhões por infração [D].
- **Classificação indicativa** [D/P]: a Portaria MJSP 1.048/2025 criou a faixa "não recomendado para menores de 6" e
  passou a considerar a **interatividade digital** (contato com adultos desconhecidos, compras não autorizadas,
  exposição algorítmica) [P]. Jogos só digitais podem se autoclassificar via **IARC**, que tem o ClassInd entre os
  fundadores e atende Google Play, Microsoft Store, PlayStation Store e Nintendo eShop [D/P].
- **LGPD e o rosto do avatar** [D/I]: dado biométrico é dado pessoal sensível (art. 5º, II) e só pode ser tratado
  pelas bases do art. 11, na prática **consentimento específico e destacado**. Dado de adolescente segue o melhor
  interesse (art. 14). A ANPD tem tomada de subsídios sobre biometria na agenda 2025–2026 [D]. **Para o app** [I]:
  gerar o avatar do rosto no aparelho ou no backend próprio, nunca em nuvem de terceiro sem contrato e transferência
  internacional válida (art. 33); guardar a malha e não a foto; permitir apagar; nunca usar para publicidade
  (também é a regra Apple 5.1.2(vi)). A Impersonation por avatar exige consentimento próprio, e o manequim é o padrão.

### 3.5 Classificação etária esperada

| Sistema | Fatores do FashionAI | Resultado provável [I] |
|---|---|---|
| Apple | UGC, interação, compras (se houver), marcas reais; **sem** caixa de recompensa | **13+**; com caixa de recompensa, 18+ no Brasil [D] |
| IARC (Google, Microsoft/Xbox, PlayStation Store digital) | "Usuários interagem", "Compras no jogo" se houver | ClassInd 10–12 / PEGI 7–12 / ESRB E10+–T [verificar no questionário] |
| ClassInd (critério de interatividade digital de 2025) | Contato entre usuários, compras, algoritmo de recomendação | Tende a 12–14 com interação aberta; a moderação e os padrões protetivos ajudam [P/I] |

Marcas reais não mudam a faixa por si, mas publicidade para adolescentes segue o CDC, o CONAR e o ECA Digital [I].
O público mínimo de 13 anos é decisão do produto. A loja pode classificar acima, nunca abaixo [I].

## 4. Arquitetura e roteiro

### 4.1 Arquitetura recomendada

```
 fashion-ai.com (Next.js 16)                 App nativo Unreal 5.8 (iOS/iPadOS → Win/Mac → PS5/Xbox)
 social · loja · guarda-roupa · admin        FLAIR 3D (5 cenários) · CBC 3D · provador 3D · avatar
 resgate de prêmios · conta/privacidade      módulos: FaiCore (HTTP/sessão/cache) · FaiFlair · FaiAvatar
        │  BFF (cookies)                     FaiPlatform (StoreKit, PSN, Xbox, push, Keychain)
        └────────────── HTTPS/JSON ──────────────┘
                     Spring Boot (fai-*) — regras do FLAIR no servidor (serie-*.json, Flair3dPenalties)
                     MySQL · Redis · S3 + CDN (manifestos e chunks por plataforma) · verificadores de loja
```

- **O servidor decide; o app mostra** [I]: vaga, requisito, sintonia, penalidade e recompensa já são calculados no
  backend (`CINCO_JOGOS.md`). O cliente Unreal manda "carta X no encaixe Y" e recebe o resultado. Isso impede trapaça
  e mantém web e app com as mesmas regras.
- **Autenticação** [I]: apps chamam `/api/auth/*` direto (sem BFF). Access token curto em memória, refresh token no
  Keychain ou no armazenamento seguro do console, rotação a cada uso, revogação por sessão (tela "Sessões"). No celular,
  o login no navegador do sistema usa OAuth com PKCE; no console, o pareamento por código. Para pedidos sensíveis
  (resgate, compra), usar App Attest (Apple) ou Play Integrity como sinal extra [D/I].
- **Versionamento** [I]: manter os cabeçalhos `X-FAI-Platform`, `X-FAI-Quality` e `X-FAI-App-Version`, com
  `GET /api/client/config` devolvendo `updateRequired` (`docs/multiplataforma/02`). Mudança incompatível de contrato
  só em rota nova (`/api/v2/...`), com o app de loja convivendo de 6 a 12 meses com versões antigas, porque o
  usuário demora a atualizar e cada versão passa por revisão.
- **Assets 3D e CDN** [I]: (1) **cenários** como chunks Unreal cozinhados por plataforma (iOS ASTC, PC BCn, consoles
  formatos próprios), versionados pelo build; (2) **cartas/peças** como pacotes por perfil de qualidade, listados num
  manifesto assinado (`/api/flair/manifest` com hash, tamanho e URL assinada da CDN), baixados sob demanda e guardados
  em cache LRU com teto (por exemplo, 1,5 GB no celular). Os modelos 3D das peças precisam ser **cozinhados** para a
  Unreal na plataforma alvo: um GLB do web não carrega direto num build de console sem pipeline de importação em
  runtime (glTFRuntime ou Interchange em runtime) [P/verificar].
- **Telemetria** [I]: endpoint próprio de eventos (`/api/telemetry/batch`) com esquema versionado: fps por cenário,
  memória, temperatura (`thermalState` no iOS), tempo de download por chunk, falhas e funil de cada jogo. Sem dado
  pessoal, com consentimento quando houver identificador. Crash reports pelo Crash Reporter da Unreal ou serviço
  compatível com console.

### 4.2 O que fica no web e o que vai para o app

| Área | Web (fashion-ai.com) | App nativo |
|---|---|---|
| Rede social, perfis, posts, comentários | **Fica** (moderação e SEO) | Leitura e reações; postar a arte do CBC [I] |
| Loja de marcas, cupons, compra de produto físico | **Fica** (pagamento fora do IAP é obrigatório para bem físico) | Vitrine com link só para maiores de 18 no Brasil [D/I] |
| Guarda-roupa (upload, fotos, recorte, catálogo) | **Fica** como fluxo principal | Visualizar e escolher peças; upload pela câmera na Fase 1+ |
| Administração, painel de marcas, emissores de selo | **Fica** só no web | — |
| FLAIR 3D (5 jogos) e CBC com elenco 3D | Protótipo leve (Three.js) e Pixel Streaming de teste | **Vai** para o app (experiência principal) |
| Provador 3D e avatar | Prévia leve | **Vai**: corpo, Impersonation e tecido |
| Conta, privacidade, exclusão, consentimentos | **Fica** | Também no app (exclusão obrigatória na Apple) |
| Resgate de prêmio real (endereço, documento) | **Fica** | Só o status [I] |

### 4.3 Roteiro em fases (fashion-ai.com como banco de testes)

| Fase | Escopo | Duração [I] | Equipe [I] | Custo direto [I] |
|---|---|---|---|---|
| **0 — Web e protótipos** | Regras dos 5 jogos validadas no web (já no servidor); 1 cenário em Unreal (suíte) com encaixe e Aura; Pixel Streaming para banca e marcas; telemetria de funil no web; resolver B1–B5; parecer sobre a Lei 5.768; decidir monetização sem caixa de recompensa | 3–4 meses | dona + 1 dev Unreal + 1 artista 3D (parcial) | Mac Apple Silicon e iPhone de teste (~R$ 15–30 mil, se não houver); nuvem de GPU US$ 50–300/mês com teto |
| **1 — iOS/iPadOS** | App Unreal com conta, avatar, os 5 jogos FLAIR 3D, CBC 3D, download por chunk, IAP só se houver item pago, TestFlight, App Review | 9–15 meses | 4–7 pessoas: 2 Unreal (C++/Blueprint), 1 tech artist, 1–2 artistas 3D, 1 backend, QA parcial | Pessoal ~R$ 0,6–2 mi (mercado BR) ou escopo menor num TCC; Apple US$ 99/ano; CDN |
| **1b — Android de ponta** (recomendado) | Mesmo app no Play, lista de aparelhos permitidos | +2–4 meses | +1 dev | Play US$ 25; aparelhos |
| **2 — Windows e Mac** | Qualidade alta (Lumen Lite/Nanite onde houver), mouse/teclado e controle, Microsoft Store (12%) ou Epic (royalty isento/3,5%) | +3–6 meses | 2–4 pessoas | PC com GPU; certificado de código se fora da Store |
| **3 — PS5 e Xbox Series X\|S** | Cadastro em PlayStation Partners e ID@Xbox **no início da Fase 1** (prazos longos); port, navegação por controle, TRC/XR, classificação, contas de menor | +9–18 meses após aprovação | 5–8 pessoas + QA de certificação terceirizado | Kits (empréstimo Sony; Xbox com o conceito), QA de certificação (dezenas de milhares de US$ [P]), jurídico |

**Realismo para o TCC** [I]: com 1–3 pessoas, o entregável honesto da Fase 0 é um *vertical slice* jogável de **um**
jogo (Espelho Partido) em iPhone e Mac, com medição real de fps, memória e temperatura. Os cinco jogos com arte final
e os consoles são trabalho de estúdio, não de TCC.

### 4.4 Riscos principais

1. **Arte 3D é o gargalo** [I]: 5 cenários e centenas de peças que vestem, com retopologia, rig e LOD por artista.
   Geração automática não chega à qualidade de loja.
2. **Celular sem Lumen e Nanite** [D]: a expectativa visual "Unreal" precisa ser recalibrada para o iPhone.
3. **Prêmios reais × lei e lojas** [D/I]: a Lei 5.768 pede autorização; a Apple 5.3 exige o FashionAI como
   patrocinador; os consoles não têm regra pública.
4. **Caixas de recompensa** [D]: qualquer pacote aleatório pago derruba o público 13+ (ECA Digital) e vira 18+ na
   Apple Brasil.
5. **Biometria de adolescente** [D/I]: o rosto do avatar exige consentimento específico, sem nuvem de terceiros e
   sem uso publicitário.
6. **Acesso a console** [P/I]: depende de empresa constituída, de aprovação de conceito, de NDA e de certificação.
   Não há data possível antes da aprovação.
7. **Duas bases de 3D** [I]: Three.js no web e Unreal no app. As regras e o manifesto têm de ser os mesmos. A
   aparência pode diferir, e o web vira "modo leve".
8. **UE5 → UE6** [P]: a UE6 chega durante a Fase 2 ou 3. Manter código isolado e não depender de plugin experimental.
9. **Custos recorrentes** [I]: CDN de chunks, GPU de Pixel Streaming e royalty de 5% acima de US$ 1 mi.

### 4.5 Decisões que cabem à dona do projeto

- [decidir] Android logo depois do iOS (Fase 1b) ou só depois do PC.
- [decidir] Monetização inicial: nada pago no app, assinatura, ou cosméticos de conteúdo visível. Nunca pacote
  aleatório pago.
- [decidir] Prêmios reais só depois do parecer sobre a Lei 5.768; até lá, apenas digitais e cupons emitidos pela marca.
- [decidir] Avatar canônico próprio (recomendado) × MetaHuman gerado a partir do rosto.
- [decidir] Abrir CNPJ e as contas Apple, PlayStation Partners e ID@Xbox já na Fase 0.

## Fontes

Formato: tema — URL(s). [P] marca imprensa, blog ou fórum; o resto é fonte oficial.

- **UE 5.8**: https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes · https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available · [P] https://gamefromscratch.com/unreal-engine-5-8-released/ · [P] https://www.dsogaming.com/?p=195358
- **iOS na Unreal**: https://dev.epicgames.com/documentation/unreal-engine/ios-ipados-and-tvos-development-requirements-for-unreal-engine · https://dev.epicgames.com/documentation/en-us/unreal-engine/using-lumen-global-illumination-on-mobile-in-unreal-engine · https://dev.epicgames.com/documentation/unreal-engine/rendering-features-for-mobile-games-in-unreal-engine · [P] https://forums.unrealengine.com/t/ios-nanite/2687586
- **Mac/Nanite**: https://www.unrealengine.com/en-US/tech-blog/bringing-unreal-engine-on-macos-up-to-feature-parity-with-windowsprogress-report
- **Licença**: https://www.unrealengine.com/en-US/license · https://www.unrealengine.com/en-US/eula · https://www.unrealengine.com/en-US/eula-change-log/unreal · https://www.unrealengine.com/blog/we-are-updating-unreal-engine-twinmotion-and-realitycapture-pricing-in-late-april · [P] https://pcgamer.com/unreal-engine-games-no-longer-owe-royalties-on-their-first-dollar1m-in-revenue · [P] https://conductatlas.com/platform/unreal-engine/unreal-engine-eula/in-app-advertising-revenue-included-in-royalty-revenue/ · [P] https://gamefromscratch.com/unreal-engine-launch-everywhere-with-epic/ · [P] https://www.cgchannel.com/2024/10/epic-games-to-cut-royalty-rate-on-unreal-engine-games/
- **Consoles na Unreal**: https://dev.epicgames.com/documentation/unreal-engine/consoles-development-in-unreal-engine · https://dev.epicgames.com/documentation/en-us/unreal-engine/xbox-development-in-unreal-engine
- **MetaHuman**: https://dev.epicgames.com/documentation/en-us/metahuman/platform-support-and-lod-specifications-for-metahumans · [P] https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/
- **Tecido**: https://dev.epicgames.com/documentation/en-us/unreal-engine/machine-learning-cloth-simulation-overview
- **Pacotes e chunks**: https://dev.epicgames.com/documentation/en-us/unreal-engine/patching-content-delivery-and-dlc-in-unreal-engine · https://dev.epicgames.com/documentation/en-us/unreal-engine/hosting-a-manifest-and-assets-for-chunkdownloader-in-unreal-engine · https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/IoStoreOnDemandCore
- **Pixel Streaming**: https://dev.epicgames.com/documentation/en-us/unreal-engine/pixel-streaming-in-unreal-engine · https://dev.epicgames.com/documentation/en-us/unreal-engine/hosting-and-networking-guide-for-pixel-streaming-in-unreal-engine · https://aws.amazon.com/blogs/gametech/deploy-unreal-engines-pixel-streaming-at-scale-on-aws · https://instances.vantage.sh/aws/ec2/g4dn.xlarge · [P] https://forums.unrealengine.com/t/best-setup-for-running-multiple-avatars-with-pixel-streaming-50-500-users/2636562
- **Epic Online Services**: https://onlineservices.epicgames.com/news/epic-online-services-expands-free-crossplay-overlay-from-pc-to-consoles
- **Apple, diretrizes (atualizadas em 16/10/2026)**: https://developer.apple.com/app-store/review/guidelines/
- **Apple, builds, assets e memória**: https://developer.apple.com/help/app-store-connect/reference/app-uploads/maximum-build-file-sizes/ · [P] https://developer.apple.com/forums/thread/810659 · https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.kernel.increased-memory-limit
- **Apple no Brasil e idade**: https://www.apple.com/newsroom/2026/06/apple-announces-changes-to-ios-in-brazil/ · https://developer.apple.com/news/?id=f5zj08ey · [P] https://developer.apple.com/forums/thread/828152 · [P] https://9to5mac.com/2025/07/24/apple-notifies-developers-of-new-app-store-age-rating-system/ · [P] https://trysonar.app/blog/app-store-age-rating.md
- **Apple, programa e taxas**: https://developer.apple.com/support/compare-memberships · https://developer.apple.com/app-store/small-business-program/
- **PlayStation**: https://sonyinteractive.com/en/news/blog/complimentary-development-hardware/ · https://partners.playstation.net/ · [P] https://www.pcgamer.com/sony-charges-for-crossplay-support-to-protect-psn-revenue-documents-show · [P] https://snoopgame.com/blog/pass-certification-first-attempt/
- **Xbox**: https://developer.microsoft.com/en-us/games/publish · https://developer.microsoft.com/en-us/games/articles/2026/03/gdc-2026-press-start-get-your-pc-game-ready-for-xbox-in-one-day/ · https://news.xbox.com/en-us/?p=218818 · https://github.com/microsoft/GDK · https://learn.microsoft.com/en-za/xbox/playfab/pricing/development-mode · [P] https://accelbyte.io/blog/playfab-just-cut-its-free-tier-by-99.-heres-what-that-means-for-your-game · [P] https://learn.microsoft.com/en-us/answers/questions/5630614/uwp-no-longer-accepted-for-xbox-game-submissions-i · [P] https://community.monogame.net/t/has-microsoft-ended-the-xbox-creators-program/19811 · [P] https://pcgamer.com/microsofts-new-pc-revenue-share-makes-things-weird-for-cross-buy-games
- **Mercado móvel no Brasil**: https://gs.statcounter.com/os-market-share/mobile/brazil
- **Classificação etária**: https://www.globalratings.com/milestones · https://www.gov.br/pt-br/servicos/obter-classificacao-indicativa · [P] https://canaltech.com.br/apps/brasil-ganha-nova-faixa-etaria-e-amplia-classificacao-indicativa-para-apps/
- **Lei 5.768/1971**: https://www.planalto.gov.br/ccivil_03/leis/l5768compilado.htm · https://www.gov.br/pt-br/servicos/obter-autorizacao-para-atividades-de-distribuicao-gratuita-de-premios-a-titulo-de-propaganda-ou-de-captacao-de-poupanca-popular · [P] https://www.mattosfilho.com.br/unico/promocoes-comerciais-pontos-de-atencao/ · [P] https://www.legisweb.com.br/legislacao/?id=497376
- **ECA Digital**: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15211.htm · https://agenciagov.ebc.com.br/noticias/202608/eca-digital-conheca-as-regras-de-protecao-de-criancas-e-adolescentes-no-ambiente-online · https://www.gov.br/mj/pt-br/assuntos/noticias-1/mjsp-pede-a-anpd-que-monitore-jogos-eletronicos-com-caixas-de-recompensa-que-nao-implementaram-verificacao-de-idade/NotaTcnican55.pdf · [P] https://www12.senado.leg.br/noticias/materias/2026/03/17/eca-digital-para-protecao-on-line-de-criancas-e-adolescentes-entra-em-vigor · [P] https://www.conjur.com.br/2025-out-22/impactos-do-eca-digital-no-segmento-de-jogos-eletronicos/
- **LGPD e biometria**: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm · https://www.gov.br/participamaisbrasil/ts-dados-biometricos
