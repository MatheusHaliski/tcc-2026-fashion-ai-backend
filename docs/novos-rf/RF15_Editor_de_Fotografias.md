# RF15 · Editor de Fotografias da Peça (Editor Canvas Interativo 2D): plano

> **Status:** Tema Futuro. No Trello o card está na lista *Requisitos Funcionais - TEMAS FUTUROS*, com sprint planejada 4.
> Este documento é um **plano**: diz o que construir, em que ordem e por quê. O editor de hoje (seção 1.3) continua
> como está até a Fase 1. O Trello não foi alterado: este texto só segue o que está lá.

| Trello | Texto |
|---|---|
| **RF15** | Editar uma fotografia de uma peça de roupa proveniente da adição de uma peça de roupa ou criação de novo esquema de vestimenta, através de um Editor Canvas Interativo 2D. 🔗 Dependência: RF4 (a foto da peça precisa existir para ser editada). ✅ Entrega esperada: Editor Canvas Interativo 2D edita a fotografia da peça. 📅 Sprint planejada: 4 |
| **HU-RF15** | COMO usuário autenticado no sistema, POSSO editar a fotografia de uma peça de roupa utilizando um Editor Canvas Interativo 2D, PARA ajustar e aprimorar a apresentação visual das minhas peças e esquemas |
| **RF4** (mudança) | A fotografia passou a ser **opcional**: a peça nasce do catálogo + formulário, e a foto entra quando a pessoa quer um item mais personalizado. Ao enviar uma foto opcional, no cadastro ou depois, numa edição, nasce o fluxo do RF15 |

---

## Sumário

0. [Resumo em uma página](#0-resumo-em-uma-página)
1. [Contexto, escopo e o que já existe](#1-contexto-escopo-e-o-que-já-existe)
2. [Princípios](#2-princípios)
3. [Fundamentos de fotografia de moda que o editor precisa respeitar](#3-fundamentos-de-fotografia-de-moda-que-o-editor-precisa-respeitar)
4. [Política de fidelidade: Fiel, Vitrine, Criativa](#4-política-de-fidelidade-fiel-vitrine-criativa)
5. [Arquitetura do editor](#5-arquitetura-do-editor)
6. [Coach de qualidade (orientar, não punir)](#6-coach-de-qualidade-orientar-não-punir)
7. [IA assistiva: opcional, explicável e governada](#7-ia-assistiva-opcional-explicável-e-governada)
8. [Fluxos: de onde a foto vem e para onde vai](#8-fluxos-de-onde-a-foto-vem-e-para-onde-vai)
9. [Interface e acessibilidade](#9-interface-e-acessibilidade)
10. [Modelo de dados e API](#10-modelo-de-dados-e-api)
11. [Integração com o resto do FashionAI](#11-integração-com-o-resto-do-fashionai)
12. [Segurança e privacidade](#12-segurança-e-privacidade)
13. [Desempenho](#13-desempenho)
14. [Critérios de aceitação propostos](#14-critérios-de-aceitação-propostos)
15. [Métricas de sucesso](#15-métricas-de-sucesso)
16. [Estratégia de testes](#16-estratégia-de-testes)
17. [Roteiro por fases](#17-roteiro-por-fases)
18. [Riscos](#18-riscos)
19. [Decisões em aberto para o time](#19-decisões-em-aberto-para-o-time)
20. [Referências](#20-referências)

---

## 0. Resumo em uma página

O editor do RF15 tem uma função: fazer a foto que a pessoa tirou **mostrar bem a peça real**. Isso vale para o
guarda-roupa, o card, o look, o perfil, a venda e a doação. Ele não serve para inventar uma peça que não existe.
As decisões que sustentam o plano:

1. **Original imutável e edição não destrutiva.** A foto enviada nunca é regravada. O editor guarda uma **receita**
   (lista de parâmetros, em ordem fixa) e gera versões a partir dela. Qualquer versão pode ser reaberta, ajustada ou
   desfeita até a original, também numa sessão posterior.
2. **Três classes de fidelidade.** Cada operação tem uma classe e a versão herda a mais alta entre as que usou:
   - **Fiel** (enquadrar, endireitar, luz e cor corrigidas, fundo removido): pode ser usada em tudo.
   - **Vitrine** (fundo de estúdio, sombra, manequim invisível, remoção de fiapo): pode ser capa, mas não serve de
     referência de cor.
   - **Criativa** (filtros, troca de cor, cenário gerado por IA): vai sempre rotulada e nunca entra em busca, Lens,
     selos, catálogo, venda ou doação.

   A classe é **medida no servidor** (desvio de cor ΔE₀₀ na região da peça), e não apenas declarada pelo cliente.
3. **Ordem fixa de processamento**, como num revelador de foto profissional: geometria → balanço de branco → tom →
   cor → detalhe → ajustes locais → retoque → fundo e composição → saída. É previsível, explicável e reproduzível.
4. **Coach de qualidade em vez de recusa.** Nitidez, exposição, inclinação, dominante de cor, cobertura e resolução
   viram mensagens com um botão de correção ("Foto inclinada 3,2° · Endireitar"). Ele usa o mesmo vocabulário do
   `QualityMetrics`.
5. **Modo guiado primeiro** (Enquadrar → Luz e cor → Fundo → Revisar, cada etapa com "Pular") e **modo avançado** por
   divulgação progressiva.
6. **Proibido mexer no corpo.** Não existe ferramenta de afinar, alongar ou remodelar silhueta, nem em fotos de look.
   É uma escolha ética: a França, por exemplo, obriga a menção "Photographie retouchée" quando a silhueta é alterada.
7. **Edição não move ranking.** Editar a foto não altera HypeScore, selos nem posição em rankings. É a mesma regra de
   "sem pay-to-win" já aplicada aos selos.
8. **Mobile-first e acessível** (WCAG 2.2 AA): toda ação de arrastar tem alternativa por campo numérico ou teclado,
   os alvos de toque são grandes e o estado é anunciado por leitor de tela.
9. **Reuso, não reescrita.** A remoção de fundo, o Estúdio, o manequim invisível, o enquadramento por categoria, o
   `CanonicalPhotographer`, as versões com aprovação e a revisão com `baseRev` já existem. O editor passa a ser a
   interface única sobre eles.
10. **Fases.** A Fase 1 (sprint 4) entrega a receita não destrutiva, o enquadramento por destino, o endireitar, o
    balanço de branco, o tom, as classes de fidelidade, as versões e o coach. Máscaras, retoque, presets em lote e o
    criativo generativo (RF44) vêm depois.

---

## 1. Contexto, escopo e o que já existe

### 1.1 O que mudou no RF4

Até 04/10/2026 o criador de peças não aceitava foto: a peça nascia da busca catalogada (RF47), com a foto oficial do
catálogo ou a imagem padrão da subcategoria (`useDefaultImage`). A rota de análise de uma foto foi retirada (veja a
nota no topo de [`RF04_ADAPTIVE_GARMENT_CAPTURE.md`](../visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md)).

No Trello, o RF4 agora diz que a **fotografia é opcional**. O catálogo e o formulário continuam sendo o caminho
principal, e a foto existe para quem quer o item **mais personalizado**: o próprio exemplar, com o desgaste, a cor
real sob a luz de casa, o bordado feito à mão ou a customização. Por isso o RF15 trata de um tipo específico de
imagem: uma foto de celular, tirada por quem não é fotógrafo, de uma peça que já tem uma ficha (categoria, cor,
marca) e às vezes uma foto oficial ao lado. O editor precisa aproximar essa foto da ficha, e não afastá-la.

### 1.2 De onde vem a foto (entradas)

| # | Entrada | Situação hoje | No RF15 |
|---|---|---|---|
| E1 | **Cadastro da peça** (RF4), passo opcional "Adicionar minha foto" | não existe no criador | abre o editor em modo guiado logo após o envio (com "Pular") |
| E2 | **Edição posterior da peça** (página da peça → "Editar imagem") | `EditImageDialog` + `PhotoEditor` | reabre a **receita** da versão ativa, não os pixels já gravados |
| E3 | **Esquema de vestimenta (look)**: capa ou foto do look vestido (`Scheme.coverImageUrl`) | capa sem editor | modo *Look*: pessoa na foto, regras de corpo e rosto, marcação das peças |
| E4 | **Minhas Fotos** (RF12) | `PhotoEditor` com `photoId` | igual, ganhando a receita e as versões |
| E5 | **Lens · "Eu tenho"** (RF54/RF45) | cria a peça a partir da foto | oferece "Ajustar foto" antes de salvar |

### 1.3 Inventário do que já existe (e serve de base)

| Peça | Onde | O que faz | Limite que o RF15 resolve |
|---|---|---|---|
| Editor Canvas 2D | `components/photo-editor.tsx` | recorte livre, giro de 90°, brilho/contraste, remoção de fundo, histórico, desfazer/refazer, voltar à original, confirmação ao sair | **destrutivo ao salvar** (grava um PNG "assado"); sem proporções nem zonas seguras, sem endireitar fino, sem balanço de branco, sem medida de fidelidade, histórico perdido ao fechar |
| Salvar edição | `PhotoService.saveEdit`, `WardrobeService.replaceImage` | guarda a original em Minhas Fotos e troca a imagem da peça | sem receita, sem classe de fidelidade, troca a capa na hora (sem versão pendente) |
| Remoção de fundo | `FlatLayPipeline` (rembg → remove.bg → local), `POST /api/photos/background-removal` | cadeia com fallback e cota no `AiEngine` | sem refinamento de máscara pela pessoa |
| Estúdio | `StudioPipeline`, `StudioFraming`, `StudioQuality`, `GhostMannequin`, `LogoFinder` | fundo de estúdio, sombra, quadro por peça, manequim invisível, detalhe do logo | é um fluxo separado: a pessoa não ajusta parâmetros nem vê o que é fiel e o que é vitrine |
| Versões do estúdio | `StudioVersionsTest`, `edit-image.tsx` (`studioVersion`) | versão nova fica **pendente** até o dono aprovar | só para o estúdio |
| Revisão concorrente | `BackgroundStudioService.withRevision` (`PieceArtRevisionTest`) | `baseRev`: editor desatualizado é recusado | só para a arte do card |
| Asset canônico | `CanonicalPhotographer`, `PhotographySpecs`, `piece_images` (V29) | enquadramento determinístico sem pixel inventado | não tem interface de edição |
| Qualidade | `QualityMetrics` (nitidez, exposição, cobertura, centralização, fundo, resolução, cor) | relatório 0–1 com limiar 0,6 | não aparece como orientação acionável no editor |
| Comparação | `components/before-after.tsx` | divisor antes × depois | já pode ser reaproveitado |
| Privacidade | `lib/lens/redact.ts` (MediaPipe), remoção de EXIF, `ImageDecodeLimits` | rosto borrado, metadados retirados, limite de descompressão | o modo Look precisa reutilizar |

> **Colisão de numeração:** no código, os `@Operation` "RF15" de `WardrobeController` e `DiscoveryController` falam de
> *adicionar uma peça pública ao meu guarda-roupa*, numeração anterior ao board atual. Pelo Trello, o RF15 é o editor.
> Os comentários de `photo-editor.tsx`, `PhotoService` e `WardrobeService.replaceImage` já usam "RF15" no sentido
> certo. Fica como na nota do [índice](README.md): a renumeração pode ser feita num único passo de refatoração.

### 1.4 Fora do escopo

- Modelo 3D da peça (RF16) e provador (RF18).
- Geração de imagem, cenário e reiluminação por IA: fazem parte do **FAI Creative Engine (RF44)**. O RF15 apenas
  deixa o encaixe pronto (classe Criativa, seção 4).
- Edição de vídeo e de imagens do catálogo oficial (RF47). A foto oficial nunca é editada pelo usuário.

---

## 2. Princípios

| # | Princípio | Por quê | Fonte |
|---|---|---|---|
| P1 | **A verdade da peça vem primeiro** | Online não se toca o produto, e a foto compensa esse "déficit tátil". Se a foto mente sobre cor, tamanho ou estado, a pessoa se frustra (e, numa venda, isso tem consequência legal) | Peck & Childers (2003); Di et al. (2014); CDC arts. 31 e 37 |
| P2 | **Nada é destrutivo; tudo volta** | "Controle e liberdade do usuário" é uma das 10 heurísticas. O revelador profissional (Camera Raw, Lightroom, darktable) guarda parâmetros, não pixels | Nielsen (1994); padrão Command (Gamma et al., 1994) |
| P3 | **Orientar antes de recusar** | A recusa sem explicação gera atrito. É a mesma decisão do documento de captura adaptativa | RF04 Adaptive Capture §2 (P2) |
| P4 | **Consistência de vitrine** | Imagens fáceis de processar parecem mais agradáveis e confiáveis (fluência de processamento). No estudo do Airbnb, as fotos verificadas, com composição, cor e figura-fundo melhores, aumentaram a ocupação | Reber, Schwarz & Winkielman (2004); Zhang et al. (2022) |
| P5 | **Ética do corpo** | Não se altera a silhueta. A França exige "Photographie retouchée" (Décret 2017-738) e a Noruega exige rótulo em anúncios retocados desde 2022 | Légifrance; seção 4.4 |
| P6 | **Privacidade por padrão** | Uma foto de casa revela local (GPS), rostos e ambiente | LGPD; seção 12 |
| P7 | **Edição não é sinal de ranking** | O HypeScore mede tendência e engajamento reais; selos e edição não podem comprar posição | [`HYPESCORE_ARCHITECTURE.md`](../hype/HYPESCORE_ARCHITECTURE.md) |
| P8 | **Mobile-first e acessível** | A foto nasce no celular, e o editor tem de funcionar no polegar, no teclado e no leitor de tela | WCAG 2.2; Fitts (1954) |
| P9 | **IA como assistente, nunca como autora silenciosa** | Toda sugestão de IA vira passos visíveis e editáveis na receita, com consentimento e cota | governança do `AiEngine` (RF24) |

---

## 3. Fundamentos de fotografia de moda que o editor precisa respeitar

### 3.1 Tipos de foto de produto e o que o editor oferece para cada um

| Tipo | Para que serve | Regras profissionais | No editor |
|---|---|---|---|
| **Flat lay** (peça deitada, vista de cima) | camisetas, calças, acessórios; é o mais fácil em casa | câmera paralela ao chão (sem trapézio), peça alinhada e sem dobras soltas, margem uniforme | perspectiva de 4 pontos, endireitar, template de enquadramento da categoria, fundo liso |
| **Cabide** | camisas, casacos, vestidos | gancho centralizado, ombros simétricos, fundo neutro | remover o gancho (`GhostMannequin` já faz), nivelar pelos ombros |
| **Manequim invisível** (*ghost mannequin*) | volume de peça vestida sem corpo | gola com interior das costas, simetria | preenchimento do decote (já existe), classe **Vitrine** |
| **Vestida / look** | caimento e proporção, comum em esquemas | luz suave, corpo inteiro ou plano americano, rosto opcional | modo Look: 4:5, borrar rosto, marcar as peças, **sem ferramenta de corpo** |
| **Detalhe** | textura, etiqueta, botão, logo, costura, desgaste | macro nítido e luz rasante para revelar trama | recorte de detalhe (o `LOGO_DETAIL`/`TEXTURE_DETAIL` do canônico), nitidez local |
| **Escala** | dar noção de tamanho (bolsa no braço, tênis no pé) | 42% dos usuários tentam avaliar o tamanho pelas fotos | sugestão no coach: "Adicione uma foto em uso" |

As fotos de detalhe e textura respondem ao "déficit tátil" (Peck & Childers, 2003): quem não pode tocar o tecido quer
vê-lo de perto. Na Baymard, **56%** dos usuários começam a página de produto pelas imagens, e 25% dos sites não têm
resolução ou zoom suficientes. Por isso a saída mínima do editor é de **2000 px no lado maior** quando a fonte permite
(seção 3.4).

### 3.2 Luz e cor (onde a foto de celular mais erra)

| Situação | Problema | Técnica profissional | Ferramenta |
|---|---|---|---|
| Luz amarela de casa (≈ 2700–3000 K) | branco vira creme, azul-marinho vira preto | balanço de branco por **referência neutra** (cartão cinza 18%, papel branco, etiqueta branca); referência profissional de 5000–6500 K | conta-gotas neutro + temperatura/matiz; correção por adaptação cromática (Bradford/von Kries) em luz linear |
| Sem referência neutra | o automático erra em peça de cor única que ocupa o quadro (camisa vermelha "puxa" o gray-world para ciano) | estimar só no **fundo** (máscara invertida) e preferir *shades-of-gray*/borda a gray-world puro | "Automático fiel" mede no fundo; se o fundo for pequeno ou colorido, avisa e sugere o conta-gotas |
| Peça preta | sombras esmagadas, sem trama visível | levantar sombras sem lavar o preto; curva com ponto de preto preservado | controles de **Sombras** e **Pretos** separados; aviso de recorte (zebra) |
| Peça branca | realces estourados, sem textura | não passar de 250–252 na peça; branco puro 255 fica só no fundo | **Realces** + aviso de recorte; fundo branco puro separado da peça por máscara |
| Branqueador óptico (algodão branco, sintéticos) | fluorescência azulada sob flash ou luz do dia com UV | evitar flash direto; corrigir com matiz e não com saturação global | o coach detecta "branco azulado" na peça com fundo neutro |
| Superfícies brilhantes (cetim, couro, verniz, metal) | reflexo especular apaga a cor | luz grande e difusa; "família de ângulos" do reflexo | não há "remover reflexo" na classe Fiel (seria inventar). O coach orienta a refazer a foto |
| Estampas finas (listras, pied-de-poule, xadrez miúdo) | **moiré** ao reduzir a imagem | reamostragem com filtro antisserrilhado (Lanczos) | a saída usa Lanczos; o coach mede energia de alta frequência e sugere recorte mais próximo |
| Metamerismo (duas cores iguais numa luz, diferentes em outra) | cor "certa" no celular, diferente ao vivo | luz de referência D50/D65 (ISO 3664); cartão de cores | na Fase 3, cartão de cores (24 patches) na foto → correção por matriz e "cor calibrada" |

A cor é tratada em **sRGB** (IEC 61966-2-1) na saída. Fotos de iPhone vêm em Display P3: a entrada é convertida para
o espaço de trabalho com o perfil ICC respeitado. As diferenças de cor são medidas em **CIELAB com ΔE₀₀
(CIEDE2000)**, com a implementação validada pelos dados de teste de Sharma, Wu & Dalal (2005). Como referência
prática: ΔE₀₀ ≲ 1 é imperceptível, ≈ 2–3 é a tolerância comum em produção gráfica e de varejo, e > 5 é uma diferença
evidente. Os limiares da seção 4 partem disso e devem ser **calibrados no teste de usabilidade** (seção 16).

### 3.3 Composição

- **Foto de produto** (piece card 1:1 e 4:5): peça **centralizada** e com **margem uniforme**. Os marketplaces pedem
  que o produto ocupe **≈ 85% do quadro** em fundo branco puro RGB 255. A regra dos terços **não** se aplica aqui:
  quem compara produtos quer todos no mesmo lugar (consistência, P4).
- **Foto de look e de estilo de vida**: regra dos terços, linhas guia e espaço negativo na direção do olhar ou do
  movimento. Liu et al. (2010) otimizam a composição por terços, linhas diagonais e equilíbrio visual. O editor usa
  esses critérios **só como sugestão de recorte**, nunca aplicados sozinhos.
- **Relação figura-fundo**: um dos três grupos de atributos do estudo do Airbnb (Zhang et al., 2022). Na prática, o
  fundo deve ter contraste com a peça. O `StudioPipeline` já troca o royal pela Areia quando a peça é escura ou azul
  saturado, e o editor herda essa regra.
- **Zonas seguras**: os cards do FashionAI sobrepõem chips (Hype, selo, estado) nos cantos. Cada destino tem a sua
  máscara de zona segura, desenhada sobre a foto durante o enquadramento, para que nada importante (logo, gola,
  etiqueta) fique sob um chip.

### 3.4 Destinos e formatos (presets de enquadramento)

| Preset | Proporção | Saída sugerida | Onde aparece |
|---|---|---|---|
| Card da peça | 1:1 | 1600 × 1600 | `.fai-card .c-photo` |
| Card de peça (lista) / look | 4:5 | 1600 × 2000 | `.piece-card .pc-media`, `.c-photo.is-look` |
| Marketplace / Google Shopping | 1:1 | ≥ 2000 px | exportação "à venda" (RF31). O Google recomenda ≥ 1500 × 1500 e, a partir de 31/01/2027, exige mínimo de 500 × 500 |
| Instagram feed | 4:5 ou 3:4 | 1080 × 1350 / 1080 × 1440 | exportar look |
| Stories / Reels | 9:16 | 1080 × 1920 | exportar look (zona segura de interface em cima e embaixo) |
| Pinterest | 2:3 | 1000 × 1500 | exportar look |
| Livre | — | lado maior ≤ 4096 | uso geral |

Os templates de **categoria** (calça 4:5, tênis 1:1, vestido 9:16…) já vivem em `PhotographySpecs` e `StudioFraming`.
O editor os oferece como **"Enquadramento da categoria"**, e o recorte é calculado pelas âncoras e pela cobertura
alvo, não pelo olho.

### 3.5 Regras de marketplace (referência, não obrigação)

O FashionAI não é marketplace, mas a exportação "à venda" deve sair pronta para os principais:

- **Amazon**: imagem principal com fundo branco puro (255, 255, 255), produto em ≥ 85% do quadro e ≥ 1000 px no lado
  maior para o zoom (recomendado 2000+). Em vestuário nos EUA, a principal mostra a peça **vestida por modelo em pé**,
  não em manequim.
- **Google Merchant Center**: sem marca d'água, sem texto promocional ("Promoção", preço, selo) sobre a imagem; mínimo
  de 250 × 250 para vestuário, que sobe para 500 × 500 em 31/01/2027.

Consequência para o editor: a **exportação para venda** desliga sobreposições de texto, selos e molduras e entrega
fundo branco puro com a peça como **Fiel** ou **Vitrine**. A classe **Criativa** não é oferecida nesse destino.

---

## 4. Política de fidelidade: Fiel, Vitrine, Criativa

Esta seção é o núcleo do plano. Ela segue o RF44 (FAI Creative Engine), que separa o **asset canônico** (a "verdade
visual do produto") do **asset criativo** (derivado) e proíbe trocar o canônico em silêncio.

### 4.1 Classes

| Classe | Promessa ao usuário e a quem vê | Operações |
|---|---|---|
| **F0 · Original** | é a foto que você enviou (sem EXIF) | nenhuma; imutável |
| **F1 · Fiel** | a peça está como é: só a fotografia foi corrigida | recortar, endireitar (≤ 15°), perspectiva moderada de 4 pontos, girar 90°, **balanço de branco**, exposição, contraste, realces, sombras, brancos, pretos, nitidez e redução de ruído **moderadas**, remover o fundo (transparente, branco 255 ou neutro liso), reamostrar (ampliação ≤ 2×), enquadramento da categoria |
| **F2 · Vitrine** | a peça é a mesma; o cenário foi produzido | fundos do estúdio (degradê, cor), sombra de contato e projetada, reflexo de piso, **manequim invisível** (preenchimento do decote), remover gancho do cabide, **remover fiapo, poeira e pelo** em áreas pequenas fora do logo, suavizar vinco **leve** preservando a trama, vinheta suave |
| **F3 · Criativa** | imagem artística baseada na peça | filtros e LUTs, mudança de matiz, saturação além do limite da F1, troca de cor da peça, cenário gerado por IA, reiluminação por IA, super-resolução generativa, colagem, texto e adesivos, espelhamento (inverte logos e textos) |

A **classe da versão** é a maior entre as operações usadas **e** a medida (seção 4.2): uma receita só com operações F1
cujo resultado muda demais a cor da peça vira F3.

### 4.2 Guarda de fidelidade de cor (medida, não declarada)

Para cada versão, o servidor calcula, **dentro da máscara da peça**:

1. as 3–5 cores dominantes (k-means em CIELAB) da **versão** e do **estado de referência**. A referência é o estado
   **calibrado** quando a pessoa usou o conta-gotas neutro ou o cartão de cores; senão, é a original;
2. o **desvio** `colorDrift` = ΔE₀₀ ponderado pela área entre os pares de cores dominantes;
3. a **família de cor** (a mesma tabela de cores do formulário do RF4) da cor principal.

| Medida | Resultado |
|---|---|
| `colorDrift ≤ 3` e família igual | mantém a classe das operações |
| `3 < colorDrift ≤ 8` sem referência calibrada | **aviso**: "A cor da peça mudou bastante. Ela é assim ao vivo?" [É assim] [Desfazer cor]. Confirmar mantém F1 com a marca `colorConfirmedByOwner` |
| `colorDrift > 8` **ou** a família mudou | vira **F3**, salvo quando a correção partiu de referência neutra (calibrada) |
| família da foto ≠ cor declarada da peça | pergunta: "A peça está cadastrada como *azul-marinho*, mas a foto mostra *preto*. Atualizar o cadastro ou ajustar a foto?" |

A correção de balanço de branco **legítima** muda muito a cor (luz amarela para neutra). Por isso a referência
calibrada tem precedência: uma correção feita a partir de um neutro medido é, por definição, uma aproximação da cor
real. Os limiares (3 e 8) são o ponto de partida da seção 3.2 e serão ajustados com dados (seção 15).

### 4.3 Onde cada classe pode aparecer

| Superfície | F1 Fiel | F2 Vitrine | F3 Criativa |
|---|---|---|---|
| Capa da peça no guarda-roupa | ✅ | ✅ | ✅ com rótulo "Imagem criativa" visível no card e na página |
| Peça **à venda** ou **para doar** (RF31, V38) | ✅ | ✅ (a 1ª imagem da galeria tem de ser F1) | ❌ |
| Destaques em perfil de marca/celebridade (`InstitutionalService`) | ✅ | ✅ | ❌ (mostra a versão F1/F2 mais recente) |
| Busca visual, Lens e embeddings | ✅ (ou canônico) | ❌ | ❌ |
| Detecção de política de selos (cor, marca) | atributos da ficha + canônico | ❌ | ❌ |
| Contribuição ao catálogo (RF47) | ✅ com consentimento | ❌ | ❌ |
| Exportar para redes (look, Instagram, Pinterest) | ✅ | ✅ | ✅ com marca "Editada" opcional (C2PA, Fase 3) |
| HypeScore | **nenhuma classe influencia** | | |

### 4.4 Corpo e pessoa (modo Look)

- **Não existe** ferramenta de liquify, afinar, alongar, "corpo perfeito" ou suavização de pele. Recursos que a pessoa
  não pode usar mal são mais seguros do que recursos com aviso.
- Permitidos na pessoa: recorte, endireitar, luz e cor **globais**, borrar rosto (reuso de `lib/lens/redact.ts`),
  borrar pessoas ao fundo e placas.
- Se uma foto F3 com pessoa for exportada, o arquivo sai com "Imagem editada" nos metadados (C2PA, Fase 3). Isso
  segue o espírito do Décret 2017-738 (França) e da lei norueguesa de marketing, sem depender de detectar retoque
  de corpo, já que a ferramenta nem existe.

---

## 5. Arquitetura do editor

### 5.1 Visão geral

```
                    ┌──────────────────────── Navegador ────────────────────────────┐
 foto (E1–E5) ──►   │ Decodificação: createImageBitmap(imageOrientation) · ICC → sRGB│
                    │ Proxy de trabalho ≤ 4096 px (limite de área do Safari iOS)     │
                    │                                                                │
                    │  EditorStore (receita + histórico de comandos)                 │
                    │     │                                                          │
                    │     ▼                                                          │
                    │  Renderizador (Web Worker + OffscreenCanvas)                   │
                    │   WebGL2: geometria → WB → tom → cor → detalhe → máscaras      │
                    │           → retoque → fundo/composição → saída                 │
                    │   fallback: Canvas 2D (o caminho do editor atual)              │
                    │     │                                                          │
                    │  Coach (métricas no proxy, a cada mudança, com debounce)       │
                    └─────┬───────────────────────────────────────┬──────────────────┘
                          │ receita + render final (PNG/JPEG)     │ assistentes
                          ▼                                       ▼
            ┌──────────── API (fai-web) ───────────┐   /api/edit/assist/*
            │ ImageEditService                     │   (fundo, máscara, automático)
            │  ├ valida upload (UploadSafety)      │        │
            │  ├ mede classe e colorDrift (ΔE₀₀)   │        ▼
            │  ├ QualityMetrics da versão          │   FlatLayPipeline · AiEngine
            │  ├ moderação (CONTENT_MODERATOR)     │   (cota, consentimento, log)
            │  ├ grava versão (baseRev)            │
            │  └ gera renditions por destino       │
            └──────────────┬───────────────────────┘
                           ▼
              image_edit_versions · MediaStoragePort (chaves únicas, original intocado)
```

### 5.2 Pipeline de ordem fixa

Os reveladores profissionais aplicam os ajustes **numa ordem fixa**, seja qual for a ordem em que a pessoa mexeu nos
controles. Assim o resultado é previsível (exposição antes da curva, balanço de branco antes da saturação) e a mesma
receita sempre produz a mesma imagem. O histórico registra **a ordem dos comandos** (para desfazer), e o renderizador
aplica **a ordem do pipeline**.

| # | Estágio | Parâmetros | Classe | Notas técnicas |
|---|---|---|---|---|
| 1 | Entrada | orientação EXIF, perfil ICC, proxy | — | `createImageBitmap(blob, { imageOrientation: "from-image" })`; Display P3 → sRGB |
| 2 | Geometria | `rotate90`, `straightenDeg` (±15), `perspective` (4 pontos), `crop` (retângulo normalizado + proporção) | F1 | homografia (Hartley & Zisserman); o endireitar automático acha linhas dominantes (Hough) ou usa o corte reto que o Flat Lay já detecta |
| 3 | Balanço de branco | `temperature`, `tint` ou `neutralPoint` (x, y) | F1 | em luz **linear**, com adaptação cromática Bradford; "Automático" estima no fundo |
| 4 | Tom | `exposure` (EV), `contrast`, `highlights`, `shadows`, `whites`, `blacks`, `curve` | F1 | exposição multiplicativa em linear; realces e sombras com máscara de luminância suave (evita halo) |
| 5 | Cor | `vibrance`, `saturation` | F1 até ±15; além disso F3 | `hsl` (matiz por faixa) é sempre F3 quando atinge a peça |
| 6 | Detalhe | `sharpen` (quantidade, raio, limiar), `denoise` | F1 moderado | unsharp mask com limiar; ruído medido por Immerkær (já existe) e filtro bilateral |
| 7 | Ajustes locais | máscaras `garment`, `background`, `brush`, `linear`, `radial` com sub-receitas de tom e cor | herda | "clarear só o fundo", "escurecer só a peça" |
| 8 | Retoque | `heal[]` (pontos e raio) | F2 | PatchMatch local (Barnes et al., 2009); **bloqueado** sobre a caixa do logo e acima de 2% da área da peça por ponto |
| 9 | Fundo e composição | `background` (`keep`, `transparent`, `white`, `solid`, `studio:<id>`), `shadow`, `ghostMannequin`, `framingPreset`, `margin` | F1 (transparente, branco, sólido) ou F2 | reuso de `StudioPipeline.BACKDROPS`, `GhostMannequin` e `StudioFraming` |
| 10 | Saída | `renditions[]` por destino, formato, qualidade | — | Lanczos ao reduzir (moiré); sRGB; sem metadados pessoais |

### 5.3 A receita (`EditRecipe`)

Um documento JSON versionado guardado em cada versão. O exemplo mostra uma foto de calça em flat lay, corrigida da
luz amarela, endireitada e posta em fundo branco para venda:

```json
{
  "schema": "fai-photo-edit/1",
  "source": { "imageId": "8b7…", "width": 4032, "height": 3024, "sha256": "…" },
  "geometry": { "rotate90": 0, "straightenDeg": -2.4,
                "perspective": [[0.06,0.04],[0.95,0.03],[0.97,0.97],[0.04,0.98]],
                "crop": { "x": 0.08, "y": 0.02, "w": 0.84, "h": 0.96, "aspect": "4:5" } },
  "whiteBalance": { "mode": "neutralPoint", "point": [0.91, 0.12], "calibrated": true },
  "tone": { "exposure": 0.35, "contrast": 8, "highlights": -20, "shadows": 25, "whites": 0, "blacks": -4 },
  "color": { "vibrance": 5, "saturation": 0 },
  "detail": { "sharpen": { "amount": 40, "radius": 1.0, "threshold": 4 }, "denoise": 15 },
  "local": [],
  "heal": [],
  "background": { "mode": "white" },
  "framing": { "preset": "PANTS_FRONT_V1", "marginPct": 6 },
  "output": { "renditions": ["card-1x1", "card-4x5", "sale-2000"] },
  "meta": { "editor": "web", "ops": ["WB_NEUTRAL","STRAIGHTEN","PERSPECTIVE","TONE","BG_WHITE","FRAMING"] }
}
```

- **Imutável por versão.** Editar de novo cria outra versão (`parentVersionId`). O histórico de comandos de uma
  sessão é um detalhe da interface e não é persistido.
- **Compatibilidade:** campos desconhecidos são preservados. Uma versão nova do schema traz migração (`/1 → /2`).
- **Rascunho automático**: a receita em edição é guardada no IndexedDB a cada 2 s e, com rede, como versão `DRAFT`. Se
  o navegador fechar no meio da edição, ela é recuperada.

### 5.4 Renderização: onde e como

| Decisão | Escolha | Por quê |
|---|---|---|
| Prévia | WebGL2 (shaders encadeados, texturas half-float quando houver `EXT_color_buffer_float`) num **Web Worker** com `OffscreenCanvas` | o arraste de um controle não trava a interface; com a GPU, a prévia passa de 30 fps |
| Fallback | Canvas 2D (o editor atual), com `filter` e `ImageData` | navegadores sem WebGL2 ou com contexto perdido |
| Exportação | no cliente, em resolução final, por **tiles** quando passar do proxy | não envia a original a cada ajuste; funciona offline |
| Validação | no servidor: mede classe, drift e qualidade da imagem recebida | o cliente não é confiável para a classe (P1) |
| Re-render no servidor | **Fase 3**: implementação Java dos estágios F1 (2–6, 9) para presets em lote e para regenerar renditions | evita duas implementações no MVP; quando houver as duas, o teste de paridade exige ΔE₀₀ < 1 num cartão de cores sintético |

### 5.5 Máscaras e recorte

- **Máscara da peça**: vem da cadeia de remoção de fundo já existente (rembg/U²-Net → remove.bg → local). A confiança
  baixa (o recorte "partido" do `FlatLayPipeline`) abre o refinamento em vez de seguir sem aviso.
- **Refinamento** (Fase 2): pincel somar/subtrair com borda sensível à imagem (*guided filter*, He et al.) e
  **cliques de segmentação interativa** no estilo SAM (ponto dentro/fora). Um modelo leve (MobileSAM/EfficientSAM em
  ONNX no navegador) faz isso, com fallback no servidor.
- **Casos difíceis**, cada um com regra própria: renda e tricô vazado (o vazio é real, não buraco: "preservar
  transparências"), franja, pelo e plumas (matting suave, sem limiar duro), peça da cor do fundo (o recorte local
  falha e o coach pede contraste) e sapatos em par (dois componentes, sem fundir).

### 5.6 Histórico, desfazer e concorrência

- **Command pattern**: cada ação é um comando com `do/undo` sobre a receita. Os atalhos `Ctrl/Cmd+Z` e
  `Ctrl/Cmd+Shift+Z` já existem. O histórico nomeado e "Voltar à original" continuam.
- **Arrastar um controle conta como um passo**, que vira comando ao soltar. É o comportamento atual, e o mantemos.
- **Revisão com `baseRev`**: salvar sobre uma versão mais nova que a aberta é recusado com "Esta foto foi editada em
  outro dispositivo. [Ver a mais nova] [Salvar como outra versão]". É o mesmo contrato de `withRevision`.
- **Versão ativa nunca muda em silêncio**: o processamento automático (estúdio refeito, remoção de fundo melhor)
  cria uma versão **pendente** que o dono aprova, como já acontece no estúdio (`StudioVersionsTest`).

---

## 6. Coach de qualidade (orientar, não punir)

O coach mede a prévia em tempo real e a versão final no servidor, e transforma cada métrica numa orientação com
**uma correção de um toque**. As métricas reaproveitam as de `QualityMetrics` e de `lib/capture/frame-feedback`
(mesmos nomes e mesma escala 0–1).

| Métrica | Como mede | Mensagem | Correção |
|---|---|---|---|
| `sharpness` | variância do Laplaciano (Pech-Pacheco et al., 2000) | "A foto está tremida. Dá para melhorar um pouco, mas refazer com o celular apoiado fica melhor." | nitidez moderada · [Refazer foto] |
| `exposure` | % de pixels da peça recortados em 0 ou 255; mediana da luminância | "Os brancos da camiseta estouraram." | Realces −30 |
| `tilt` | ângulo das linhas dominantes (Hough) ou do corte reto | "A peça está inclinada 3,2°." | Endireitar |
| `keystone` | convergência das bordas da peça em flat lay | "A câmera não estava paralela à peça." | Perspectiva automática |
| `colorCast` | a\*/b\* médios nas áreas neutras do fundo | "Luz amarelada." | Balanço de branco automático · [Usar conta-gotas] |
| `coverage` / `centering` | já existem | "A peça ocupa só 40% do quadro." | Enquadramento da categoria |
| `background_uniformity` | desvio-padrão da luminância no fundo | "O fundo tem objetos." | Remover fundo |
| `noise` | Immerkær (já usado no `StudioQuality`) | "Foto com grão (pouca luz)." | Reduzir ruído |
| `resolution` | lado menor ÷ 1000 | "Resolução baixa para zoom." | — (só informa) |
| `moire_risk` | energia de alta frequência em padrão periódico | "Estampa fina pode tremer ao reduzir." | Recorte mais próximo |
| `colorDrift` | ΔE₀₀ (seção 4.2) | "A cor da peça mudou bastante." | [É assim] [Desfazer cor] |

Regras do coach:
- **Nunca bloqueia salvar** por qualidade. Só a moderação e a política ética (seção 4.4) bloqueiam.
- Mostra **no máximo três** orientações por vez, da maior para a menor perda, e cada uma diz o que mediu (P9).
- Exibe a nota antes e depois (0–100), sem gamificar: não dá ponto por nota alta (P7).
- Respeita o limiar existente (`ACCEPTANCE_THRESHOLD = 0,6`) apenas para mostrar o selo "Foto boa para venda".

---

## 7. IA assistiva: opcional, explicável e governada

| Assistente | Classe | Onde roda | Transparência |
|---|---|---|---|
| **Ajuste automático fiel** (um toque) | F1 | local (heurísticas da seção 6) | vira passos editáveis na receita ("WB automático", "Endireitar −2,4°", "Exposição +0,35") |
| Remoção de fundo | F1 | cadeia existente (local → rembg → remove.bg) | mostra o provedor ("remove.bg"), como o editor atual |
| Segmentação por cliques | F1 | navegador (ONNX), fallback no servidor | máscara visível e editável |
| Retoque de fiapo e poeira | F2 | local (PatchMatch) | marca cada ponto retocado; desfazer por ponto |
| Sugestão de recorte (look) | F1 | local (terços, saliência) | três sugestões; nenhuma aplicada sozinha |
| **Criativo** (cenário, reiluminação, upscale generativo) | F3 | provedores do RF44 via `AiEngine` | consentimento `AI_EXTERNAL_PHOTO_PROCESSING`, cota diária, log em `ai_inference_log`, rótulo "IA" |

Regras: a IA **nunca** é aplicada sem um toque da pessoa, nunca sai da classe declarada (a medição da seção 4.2
confere) e a falha de um provedor nunca trava as outras ferramentas (o CA04 de hoje).

---

## 8. Fluxos: de onde a foto vem e para onde vai

### 8.1 Cadastro da peça com foto opcional (E1)

```
Criador de peça (catálogo + formulário)
  └─ "Adicionar minha foto (opcional)"  ← só aparece depois de escolher o item ou a subcategoria
       ├─ câmera (com o guia de captura do RF04) ou galeria
       ├─ upload seguro: tipo real, limites de decodificação, EXIF/GPS removido, moderação
       ├─ Editor · modo guiado
       │    1 Enquadrar  (template da categoria já escolhida; zonas seguras do card)
       │    2 Luz e cor  (automático fiel + conta-gotas; aviso de drift)
       │    3 Fundo      (manter · remover · branco · estúdio)
       │    4 Revisar    (antes × depois, classe, coach) → [Usar esta foto] · cada passo tem "Pular"
       └─ Capa da peça: [Minha foto] [Foto oficial do catálogo]  ← a pessoa escolhe; as duas ficam na galeria
```

- A foto oficial do catálogo **nunca** é substituída nem editada; ela continua como alternativa (RF47).
- Quem pula o editor salva a foto como F1 sem ajustes. O editor pode ser aberto depois (E2).
- Quem fecha no meio recupera o rascunho (seção 5.3).

### 8.2 Edição posterior da peça (E2)

Página da peça → "Editar imagem" → o editor abre **a receita da versão ativa** sobre a original. A pessoa pode:
ajustar, criar outra versão, ativar uma versão antiga, comparar duas versões lado a lado ou voltar à original.

### 8.3 Esquema de vestimenta (E3)

Modo **Look**, para a capa do esquema ou a foto do look vestido:
- presets 4:5, 3:4, 9:16 e 2:3, com regra dos terços e sugestões de recorte;
- **rosto**: "Borrar meu rosto" e "Borrar pessoas ao fundo", com detecção automática e sugestão quando há rosto;
- **marcação de peças**: tocar na foto e ligar o ponto a uma peça do esquema. O card do look mostra os pontos e leva à
  peça (*shoppable tags*), e nada muda na imagem;
- sem ferramenta de corpo (seção 4.4).

### 8.4 Consistência do closet (Fase 3)

"Preset do meu closet": a pessoa salva uma receita parcial (fundo, margem, enquadramento e tom, **nunca** recorte nem
máscara) e aplica em várias peças. O servidor processa como `PipelineJob` (o mesmo padrão do "levar peças ao
estúdio", até 40 por vez). Cada peça recebe uma versão **pendente**, aprovada em lote ou uma a uma.

### 8.5 Estados e transições de uma versão

```
DRAFT ──salvar──► PENDING_REVIEW? ──aprovar──► ACTIVE ──outra ativada──► INACTIVE ──arquivar──► ARCHIVED
  │                 (só processamento automático)          ▲
  └──descartar──► (apagada)                                 └──reativar──┘
```

Uma edição feita pela própria pessoa e salva com "Usar esta foto" vai direto a `ACTIVE`. Apenas o que o sistema gera
sozinho (estúdio refeito, lote) passa por `PENDING_REVIEW`.

---

## 9. Interface e acessibilidade

### 9.1 Layout

| Área | Desktop | Celular |
|---|---|---|
| Palco | centro, com zoom (encaixar · 100% · 200%) e pan | tela cheia; pinça para zoom, dois dedos para endireitar |
| Ferramentas | trilho à esquerda: Enquadrar, Luz, Cor, Fundo, Retoque, Máscaras | barra inferior com as mesmas abas |
| Inspetor | à direita: controles da ferramenta, coach, classe | *bottom sheet* em três alturas |
| Topo | Desfazer, Refazer, Comparar, Original, Fechar | igual, com ícones |
| Rodapé | tira de versões (miniaturas, classe, data) | dentro de "Versões" |

**Comparar** tem três modos: segurar para ver a original (gesto rápido), divisor arrastável (`BeforeAfter`) e lado a
lado entre duas versões.

**Sobreposições opcionais**: grade dos terços, zonas seguras do destino, guia de 85% do marketplace, linha de nível
ao endireitar e aviso de recorte de luz (zebra listrada, não só vermelho, para quem tem daltonismo).

**Indicador de classe** sempre visível: "Fiel", "Vitrine" ou "Criativa", com ícone + texto, e a explicação ao tocar
("Vitrine: o fundo e a sombra foram produzidos; a peça não mudou").

### 9.2 Microtexto (pt-BR; en/es pelos catálogos)

- "Endireitar · −2,4°" · "Luz amarelada corrigida pelo ponto branco que você tocou"
- "Esta foto é **Fiel**: a peça aparece como é." · "Esta foto é **Criativa**: ela não pode ser usada na venda."
- "Voltar à original" · "Salvar como nova versão" · "Usar esta foto na peça"

### 9.3 Acessibilidade (WCAG 2.2 AA)

| Critério | Como o editor atende |
|---|---|
| 2.1.1 Teclado | todas as ferramentas por teclado. Setas movem o recorte 1% (Shift = 10%); `[`/`]` endireitam 0,1° (Shift = 1°) |
| 2.5.7 Movimentos de arrastar | todo arrastar tem alternativa sem arrastar: campos numéricos de recorte e ângulo, botões ±, presets |
| 2.5.8 Tamanho do alvo | alças e botões ≥ 24 × 24 px CSS (meta interna: 44 px no toque) |
| 1.4.11 Contraste de não texto | alças e guias com contorno duplo (claro e escuro), visíveis sobre qualquer foto |
| 4.1.3 Mensagens de status | `aria-live` anuncia a classe, o coach e o resultado de salvar |
| 1.1.1 Conteúdo não textual | o palco descreve a imagem atual (peça, cor, fundo, versão) |
| 2.3.3 Animação a partir de interações (AAA, adotado) | respeita `prefers-reduced-motion` |
| Contraste dos controles | tokens de cor do tema, também no modo escuro |

Textos só pelos catálogos `lib/i18n/messages/{pt-BR,en,es}.json`; o `i18n:check` e o `i18n:scan` exigem paridade.

---

## 10. Modelo de dados e API

### 10.1 Tabelas (proposta de migração aditiva)

O `piece_images` (V29) já é o registro de imagens de visão da peça, com papel e `derived_from_id`. Para não
espalhar o conceito de versão por três tabelas (peça, foto e esquema), a proposta é uma tabela genérica de versões
editadas que aponta para o dono:

```sql
CREATE TABLE image_edit_versions (
  id                CHAR(36)    PRIMARY KEY,
  owner_type        VARCHAR(16) NOT NULL,           -- PIECE | SCHEME | PHOTO
  owner_id          CHAR(36)    NOT NULL,
  user_id           CHAR(36)    NOT NULL,
  source_image_url  VARCHAR(512) NOT NULL,          -- a original (F0), nunca regravada
  parent_version_id CHAR(36)    NULL,
  rev               INT         NOT NULL,           -- revisão por dono (baseRev)
  status            VARCHAR(16) NOT NULL,           -- DRAFT | PENDING_REVIEW | ACTIVE | INACTIVE | ARCHIVED
  recipe_json       JSON        NOT NULL,           -- fai-photo-edit/1
  fidelity_class    VARCHAR(8)  NOT NULL,           -- F1 | F2 | F3
  color_drift       DECIMAL(5,2) NULL,              -- ΔE00 medido no servidor
  color_confirmed   BOOLEAN     NOT NULL DEFAULT FALSE,
  calibrated        BOOLEAN     NOT NULL DEFAULT FALSE,
  quality_json      JSON        NULL,               -- QualityMetrics da versão
  rendered_url      VARCHAR(512) NOT NULL,
  renditions_json   JSON        NULL,               -- {"card-1x1": url, "sale-2000": url, ...}
  origin            VARCHAR(16) NOT NULL,           -- USER | AUTO_STUDIO | BATCH_PRESET | AI_CREATIVE
  ai_inference_id   CHAR(36)    NULL,
  created_at        DATETIME(6) NOT NULL,
  updated_at        DATETIME(6) NOT NULL,
  UNIQUE KEY uk_owner_rev (owner_type, owner_id, rev),
  KEY ix_owner_status (owner_type, owner_id, status)
);

CREATE TABLE image_edit_presets (                 -- Fase 3
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(80) NOT NULL,
  recipe_json JSON NOT NULL, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL
);

ALTER TABLE wardrobe_items ADD COLUMN active_edit_version_id CHAR(36) NULL;
ALTER TABLE schemes        ADD COLUMN cover_edit_version_id  CHAR(36) NULL;
```

- A coluna `wardrobe_items.image_url` continua sendo a imagem exibida. Ela passa a ser **derivada** da versão ativa,
  e quem lê não muda.
- O estúdio (`studio_image_url`, `flatLayMetadata.studio.pending`) migra aos poucos para versões com
  `origin = AUTO_STUDIO`. Até lá, os dois convivem e a interface mostra os dois na mesma tira de versões.
- **Lembrete do Hibernate 6.6**: as entidades novas usam `@GeneratedValue` sem id atribuído à mão (a armadilha que
  derrubou o `AiInferenceLog` e o `ProcessingJobLog`).

### 10.2 Endpoints

| Método e rota | Função |
|---|---|
| `GET /api/edit/{ownerType}/{ownerId}/versions` | versões do dono (só o dono vê `DRAFT`/`PENDING_REVIEW`) |
| `POST /api/edit/{ownerType}/{ownerId}/versions` | multipart: `file` (render final) + `recipe` (JSON) + `baseRev` + `activate?` → mede classe, drift e qualidade, modera, grava e devolve a versão. `409` se `baseRev` estiver desatualizado |
| `POST /api/edit/versions/{id}/activate` | torna a versão ativa (recusa F3 quando a peça está à venda ou para doar) |
| `POST /api/edit/versions/{id}/approve` · `/discard` | decisão sobre versão pendente |
| `POST /api/edit/versions/{id}/confirm-color` | "É assim ao vivo" (seção 4.2) |
| `DELETE /api/edit/versions/{id}` | arquiva (a original nunca) |
| `POST /api/edit/assist/background` | reuso de `/api/photos/background-removal` |
| `POST /api/edit/assist/segment` | pontos → máscara (fallback do navegador) |
| `POST /api/edit/assist/auto` | sugere a receita do "Ajuste automático fiel" |
| `GET/POST /api/edit/presets` · `POST /api/edit/presets/{id}/apply` | presets do closet e lote (`PipelineJob`) — Fase 3 |

As rotas atuais (`/api/photos/{id}/edits`, `PUT /api/pieces/{id}/image`) continuam funcionando e passam a criar uma
versão `ACTIVE` com receita mínima `{ "schema": "fai-photo-edit/0", "legacy": true }`.

---

## 11. Integração com o resto do FashionAI

| Módulo | Regra |
|---|---|
| **HypeScore (RF46/RF53)** | editar não gera sinal de hype nem evento de engajamento. As métricas de produto (seção 15) ficam fora do cálculo |
| **Selos (RF25/RF50)** | a política (cor, marca, subcategoria) é avaliada sobre a **ficha** da peça. Uma foto F3 com cor trocada não faz a peça "virar preta" para um selo "Preto Estrela". O `InstitutionalService` mostra só F1/F2 nos perfis de marca e celebridade |
| **Lens (RF45/RF54)** | o índice visual usa o canônico ou a versão F1 mais recente; nunca F2/F3 |
| **Catálogo (RF47)** | a foto do usuário não substitui a oficial; uma contribuição futura ao catálogo exige F1 e consentimento |
| **Estúdio (RF4 Estúdio)** | vira o estágio 9 do editor (fundos e sombra = F2); "Levar ao estúdio" continua como atalho que cria versão pendente |
| **Canônico (RF04 capture)** | o `CanonicalPhotographer` continua determinístico e fora do editor. O editor pode **partir** do canônico (enquadramento da categoria), mas o canônico não é editável |
| **Arte do card (RF11)** | a arte é a moldura do card; o editor é a foto. Os dois mantêm revisão própria |
| **Venda e doação (RF31, V38)** | ao marcar "à venda" ou "para doar", a 1ª imagem tem de ser F1/F2; se a ativa for F3, a interface pede outra |
| **Moderação** | toda versão salva passa pelo `CONTENT_MODERATOR`, com atenção a F3 e a fotos com pessoa |
| **FAI Points (RF41)** | sem pontos por editar (evita incentivo a editar demais). Se o time quiser, um ponto único por peça que ganha a primeira foto própria F1 |

---

## 12. Segurança e privacidade

- **Upload**: tipo real pelo conteúdo (`ImageOps.requireAcceptedImage`), limites de decodificação contra bomba de
  descompressão (`ImageDecodeLimits`), tamanho máximo e `UploadSafetyInterceptor`.
- **Metadados**: EXIF, GPS e número de série da câmera removidos na entrada e na saída. A receita guarda só
  dimensões e hash.
- **Pessoas**: detecção de rosto no modo Look, com sugestão de borrar. Borrar é irreversível na **versão**, mas a
  original continua privada para o dono.
- **Armazenamento**: chave única por versão (`users/{u}/edits/{owner}/{rev}-{hash}.png`); nada sobrescreve a
  original. Os rascunhos `DRAFT` sem atividade há 30 dias são apagados (minimização, LGPD).
- **Exclusão**: excluir a peça ou a foto apaga as versões e as renditions (cascata no serviço, como a exclusão de
  fotos de hoje).
- **Proveniência (Fase 3)**: manifesto **C2PA** (*Content Credentials*) na exportação, com "editada no FashionAI",
  classe e uso de IA. É opcional para a pessoa e obrigatório quando houve IA generativa (F3).

---

## 13. Desempenho

| Orçamento | Meta | Como |
|---|---|---|
| Abrir o editor com foto de 12 MP | ≤ 1,5 s num celular intermediário | `createImageBitmap` fora da thread principal; proxy ≤ 2048 px na prévia |
| Arrastar um controle | ≥ 30 fps (≤ 33 ms por quadro) | WebGL2 no worker; métricas do coach com *debounce* de 250 ms |
| Exportar 12 MP | ≤ 3 s | tiles; JPEG/WebP para renditions, PNG só com transparência |
| Memória | sem estourar o Safari iOS | área de trabalho ≤ 16.777.216 px (limite de área do canvas no Safari), por isso o proxy de trabalho tem até 4096 px no lado maior; fotos de 48 MP são reduzidas na entrada |
| Rede | 1 envio por salvamento | só a receita e o render final sobem; os assistentes enviam o proxy, não a original |

---

## 14. Critérios de aceitação propostos

Propostos para o HU-RF15 (o card no Trello está sem descrição). Os CA01–CA05 do editor atual (comentário de
`photo-editor.tsx`) continuam válidos e foram incorporados.

| CA | Critério |
|---|---|
| CA01 | Dado que enviei uma foto opcional no cadastro (RF4) ou abri "Editar imagem", o editor abre com a foto e as ferramentas Enquadrar, Luz e cor, Fundo e Revisar; cada passo do modo guiado pode ser pulado |
| CA02 | Ao salvar, a foto original continua guardada e intacta; a versão salva tem receita, classe de fidelidade e data, e pode ser reaberta e ajustada depois |
| CA03 | Desfazer, refazer, histórico nomeado e "Voltar à original" funcionam durante a sessão; em sessão posterior, qualquer versão anterior pode ser reativada |
| CA04 | A falha de um assistente (fundo, segmentação, automático) é avisada e não trava as outras ferramentas |
| CA05 | Sair com alterações não salvas pede confirmação; o rascunho é recuperado se o navegador fechar |
| CA06 | O recorte oferece os presets da seção 3.4 e o enquadramento da categoria, com zonas seguras do card visíveis |
| CA07 | Endireitar aceita ±15° com precisão de 0,1° por gesto, controle e teclado; a perspectiva de 4 pontos corrige flat lay |
| CA08 | O balanço de branco tem automático, temperatura/matiz e conta-gotas neutro; a correção por conta-gotas marca a versão como "calibrada" |
| CA09 | O servidor mede a classe e o `colorDrift`; uma versão com drift > 8 ou família de cor diferente (sem calibração) é F3 mesmo que o cliente declare F1 |
| CA10 | Uma versão F3 não pode ser ativada numa peça à venda ou para doar, não aparece em perfil de marca/celebridade, nem entra em busca, Lens ou selos |
| CA11 | O coach mostra até três orientações com correção de um toque e nunca impede salvar por qualidade |
| CA12 | Uma edição salva sobre uma revisão mais nova é recusada (409) com opção de ver a mais nova ou salvar como outra versão |
| CA13 | No modo Look, borrar rosto está disponível; não existe ferramenta que altere a silhueta |
| CA14 | Todas as ações têm alternativa por teclado ou campo numérico; classe, coach e resultado são anunciados por leitor de tela; textos em pt-BR, en e es |
| CA15 | Editar uma foto não altera HypeScore, posição em rankings, nem a elegibilidade de selos da peça |

---

## 15. Métricas de sucesso

| Dimensão | Métrica | Meta inicial |
|---|---|---|
| Adoção | % de peças com foto própria que passam pelo editor | ≥ 60% (o editor não é obrigatório) |
| Eficiência | tempo mediano até "Usar esta foto" no modo guiado | ≤ 60 s |
| Qualidade | variação da nota do coach (antes → depois) | +15 pontos na mediana |
| Satisfação | SUS (Brooke, 1996) no teste de usabilidade | ≥ 80 |
| Controle | % de sessões com "Voltar à original" ou versão anterior reativada | acompanhar (alto = automático ruim) |
| Fidelidade | `colorDrift` médio das versões F1 | ≤ 2 |
| Honestidade | versões F3 ativas em peças à venda/doação | 0 (garantido por regra; o monitor confere) |
| Efeito no produto | CTR e salvamentos de cards com foto própria editada × sem edição, em teste A/B | medido fora do HypeScore (P7) |
| Acessibilidade | auditoria WCAG 2.2 AA do editor (axe + teclado + leitor de tela) | 0 erros críticos |
| Desempenho | p95 de quadro ao arrastar; p95 de exportação | ≤ 33 ms; ≤ 3 s |

---

## 16. Estratégia de testes

| Camada | O que prova |
|---|---|
| Unitário (TS) | o redutor da receita (cada comando e seu desfazer); a matemática de geometria (o `rotateRect` atual, homografia, recorte dentro dos limites); presets e zonas seguras |
| Unitário (Java) | ΔE₀₀ conferido com os **dados de teste publicados por Sharma, Wu & Dalal (2005)**; classificação de fidelidade monotônica (somar uma operação nunca baixa a classe); drift e família de cor; `baseRev` |
| Propriedade | receita vazia devolve a imagem idêntica; a classe F1 nunca inventa pixel dentro da peça (a mesma ideia do `CanonicalPhotographerTest`); ampliação ≤ 2× |
| Imagens de referência (*golden*) | cartão de cores sintético de 24 patches com luz amarela → conta-gotas → ΔE₀₀ médio < 3 para os patches; paridade cliente × servidor < 1 (Fase 3) |
| Integração (API) | salvar, ativar, recusar F3 em peça à venda, 409 por revisão, rascunho expirado, exclusão em cascata, moderação |
| E2E (Playwright) | E1 cadastro com foto opcional, E2 edição posterior, E3 look com rosto borrado; em viewport de celular e só no teclado |
| Desempenho | fotos de 12 e 48 MP; Chrome Android intermediário e Safari iOS (limite de canvas) |
| Usabilidade | 5 a 8 participantes por rodada (Nielsen & Landauer, 1993), tarefas roteirizadas (corrigir luz amarela, endireitar, fundo branco para venda, borrar rosto no look), SUS e observação; os limiares de drift são calibrados aqui |

---

## 17. Roteiro por fases

| Fase | Entrega | Depende de |
|---|---|---|
| **0 · Entrada (RF4)** | passo "Adicionar minha foto (opcional)" no criador; escolha de capa (minha foto × oficial); upload seguro | — |
| **1 · MVP (sprint 4)** | receita não destrutiva + `image_edit_versions`; enquadramento com presets, zonas seguras e template da categoria; endireitar fino; WB (automático, temperatura/matiz, conta-gotas); tom (exposição, contraste, realces, sombras, brancos, pretos); fundo (manter, remover, branco); classes F1/F2 + drift no servidor; versões (ativar, comparar, voltar); coach com 6 métricas; modo guiado; acessibilidade e i18n; o `PhotoEditor` atual migra para essa base | Fase 0 |
| **2 · Precisão** | máscaras (peça/fundo, pincel, cliques), ajustes locais, retoque de fiapo (F2), perspectiva de 4 pontos, fundos do estúdio dentro do editor, modo Look (rosto, marcação de peças) | Fase 1 |
| **3 · Escala e confiança** | presets do closet + lote no servidor (renderizador Java de F1 com teste de paridade), renditions por destino e exportação "à venda", cartão de cores, C2PA | Fase 2 |
| **4 · Criativo (RF44)** | cenário, reiluminação e upscale generativos como F3, com consentimento, cota e rótulo | RF44 |

---

## 18. Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| Duas implementações de render (TS e Java) divergem | versões em lote diferentes da prévia | só uma (cliente) até a Fase 3; depois, teste de paridade com ΔE₀₀ < 1 |
| WB automático erra em peça de cor única | a pessoa "corrige" a cor real para errada | estimar no fundo; drift visível; conta-gotas sugerido; "É assim ao vivo?" |
| Limiares de drift mal calibrados | muitos falsos F3 ou F1 permissivo | começar com aviso (não bloqueio) entre 3 e 8; calibrar no teste de usabilidade e com dados |
| Memória no Safari iOS | aba recarrega e a edição se perde | proxy ≤ 4096 px, tiles, rascunho no IndexedDB |
| Excesso de controles para leigo | abandono | modo guiado em 4 passos, avançado por divulgação progressiva, automático fiel em um toque |
| Abuso (foto enganosa na venda) | dano ao comprador e à confiança | F3 vetada na venda, 1ª imagem F1/F2, moderação, C2PA |
| Custo de provedores (fundo, criativo) | gasto sem controle | `AiEngine`: cota, orçamento e fallback local, que já existem |
| Pessoa e rosto em foto de look | exposição de terceiros | detecção e sugestão de borrar; moderação |

---

## 19. Decisões em aberto para o time

1. **Limiares de drift (3 / 8 ΔE₀₀)**: aceitar como ponto de partida e calibrar no teste de usabilidade?
2. **F3 como capa no guarda-roupa pessoal**: permitir com rótulo (proposta) ou exigir sempre F1/F2 como capa?
3. **Tabela genérica `image_edit_versions`** (proposta) ou extensão de `piece_images` só para peças, com o esquema
   separado?
4. **FAI Points pela primeira foto própria F1**: sim (um ponto por peça) ou nenhum ponto ligado ao editor?
5. **Renumeração** dos `@Operation` "RF15" antigos (peça pública → meu guarda-roupa) para o número atual do Trello.

---

## 20. Referências

### Acadêmicas

- Barnes, C.; Shechtman, E.; Finkelstein, A.; Goldman, D. B. *PatchMatch: a randomized correspondence algorithm for
  structural image editing*. ACM SIGGRAPH, 2009.
- Brooke, J. *SUS: a "quick and dirty" usability scale*. In: Usability Evaluation in Industry, 1996.
- Buchsbaum, G. *A spatial processor model for object colour perception*. Journal of the Franklin Institute, 1980
  (gray-world).
- Di, W.; Sundaresan, N.; Piramuthu, R.; Bhardwaj, A. *Is a picture really worth a thousand words? On the role of
  images in e-commerce*. WSDM, 2014.
- Afifi, M.; Price, B.; Cohen, S.; Brown, M. S. *When Color Constancy Goes Wrong: Correcting Improperly
  White-Balanced Images*. CVPR, 2019 — [CVF](https://openaccess.thecvf.com/content_CVPR_2019/html/Afifi_When_Color_Constancy_Goes_Wrong_Correcting_Improperly_White-Balanced_Images_CVPR_2019_paper.html).
- Afifi, M.; Brown, M. S. *Deep White-Balance Editing*. CVPR, 2020 — [CVF](https://openaccess.thecvf.com/content_CVPR_2020/html/Afifi_Deep_White-Balance_Editing_CVPR_2020_paper.html).
- Finlayson, G.; Trezzi, E. *Shades of Gray and Colour Constancy*. Color and Imaging Conference, 2004.
- Fitts, P. M. *The information capacity of the human motor system in controlling the amplitude of movement*.
  Journal of Experimental Psychology, 1954.
- Gamma, E.; Helm, R.; Johnson, R.; Vlissides, J. *Design Patterns* (Command). Addison-Wesley, 1994.
- Hartley, R.; Zisserman, A. *Multiple View Geometry in Computer Vision*. 2ª ed., Cambridge, 2004 (homografia).
- He, K.; Sun, J.; Tang, X. *Guided Image Filtering*. ECCV 2010 / IEEE TPAMI 2013.
- Immerkær, J. *Fast Noise Variance Estimation*. Computer Vision and Image Understanding, 1996.
- Kirillov, A. et al. *Segment Anything*. ICCV, 2023.
- Liu, L.; Chen, R.; Wolf, L.; Cohen-Or, D. *Optimizing Photo Composition*. Computer Graphics Forum
  (Eurographics), 2010.
- McCamy, C. S.; Marcus, H.; Davidson, J. G. *A Color-Rendition Chart*. Journal of Applied Photographic Engineering,
  1976 (ColorChecker).
- Nielsen, J. *Enhancing the explanatory power of usability heuristics*. CHI, 1994.
- Nielsen, J.; Landauer, T. K. *A mathematical model of the finding of usability problems*. INTERCHI, 1993.
- Peck, J.; Childers, T. L. *To Have and To Hold: The Influence of Haptic Information on Product Judgments*.
  Journal of Marketing, 2003.
- Pech-Pacheco, J. L. et al. *Diatom autofocusing in brightfield microscopy: a comparative study*. ICPR, 2000
  (variância do Laplaciano).
- Qin, X. et al. *U²-Net: Going Deeper with Nested U-Structure for Salient Object Detection*. Pattern Recognition,
  2020.
- Reber, R.; Schwarz, N.; Winkielman, P. *Processing Fluency and Aesthetic Pleasure*. Personality and Social
  Psychology Review, 2004.
- Sharma, G.; Wu, W.; Dalal, E. N. *The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test
  Data, and Mathematical Observations*. Color Research & Application, 2005.
- Shneiderman, B. *Direct Manipulation: A Step Beyond Programming Languages*. IEEE Computer, 1983.
- Suvorov, R. et al. *Resolution-robust Large Mask Inpainting with Fourier Convolutions (LaMa)*. WACV, 2022.
- Tomasi, C.; Manduchi, R. *Bilateral Filtering for Gray and Color Images*. ICCV, 1998.
- Zhang, S.; Lee, D.; Singh, P. V.; Srinivasan, K. *What Makes a Good Image? Airbnb Demand Analytics Leveraging
  Interpretable Image Features*. Management Science 68(8), 2022 — [ACM](https://dl.acm.org/doi/abs/10.1287/mnsc.2021.4175).

### Profissionais, normas e mercado

- Hunter, F.; Biver, S.; Fuqua, P. *Light: Science and Magic — An Introduction to Photographic Lighting*. 5ª ed.,
  Focal Press, 2015 (superfícies brilhantes, família de ângulos, luz de produto).
- ISO 3664:2009 — condições de observação para tecnologia gráfica e fotografia (D50).
- IEC 61966-2-1:1999 — espaço de cor sRGB.
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.2*, 2023.
- C2PA — Coalition for Content Provenance and Authenticity, especificação de *Content Credentials*.
- Baymard Institute. [*Ensure Sufficient Image Resolution and Zoom*](https://baymard.com/blog/ensure-sufficient-image-resolution-and-zoom)
  (56% exploram as imagens primeiro) e [*Provide at Least One "In Scale" Image*](https://baymard.com/blog/in-scale-product-images) (42%).
- Requisitos de imagem da Amazon (fundo branco 255, ≥ 85% do quadro, ≥ 1000 px para zoom; vestuário em modelo em pé):
  resumo em [Seller Labs](https://www.sellerlabs.com/blog/amazon-product-image-requirements-2026/) e
  [CatalogX](https://catalogx.app/blog/amazon-apparel-photo-requirements-model).
- Google Merchant Center: [*Image too small*](https://support.google.com/merchants/answer/12159030?hl=en) e política
  de imagens (sem marca d'água ou texto promocional; mínimo de vestuário 250 × 250, 500 × 500 a partir de
  31/01/2027) — resumo em [Nightjar](https://nightjar.so/blog/google-shopping-image-requirements).
- França. [Décret n° 2017-738, de 4 de maio de 2017](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000034580217)
  (menção "Photographie retouchée" quando a silhueta é alterada; vigência a partir de 01/10/2017).
- Brasil. Código de Defesa do Consumidor (Lei 8.078/1990), art. 31 (informação correta, clara e precisa sobre as
  características) e art. 37 (publicidade enganosa, inclusive por omissão); LGPD (Lei 13.709/2018).
- Pqina. [*Canvas Area Exceeds The Maximum Limit*](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/)
  (limite de 16.777.216 px no Safari iOS).

### Internas (FashionAI)

- [`RF04_ADAPTIVE_GARMENT_CAPTURE.md`](../visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md): captura adaptativa,
  `PhotographySpecs`, asset canônico, `piece_images`.
- [`docs/rf16-estudio/README.md`](../rf16-estudio/README.md): Estúdio, enquadramento, manequim invisível, logo.
- [`RF50_Criador_de_Selos.md`](RF50_Criador_de_Selos.md) e [`RF53_HypeScore_v2.md`](RF53_HypeScore_v2.md): regras de
  selos e de hype que o editor não pode afetar.
- Trello: RF44 (FAI Creative Engine, canônico × criativo, RN46.01–RN46.10), RF4 (foto opcional) e RF15/HU-RF15.
