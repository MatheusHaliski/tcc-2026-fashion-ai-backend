# Prompt: como criar o conceito do Dine Explorer (app de varejo culinário)

O Dine Explorer é um app de varejo culinário, gastronomia, restaurantes e comida. Ele usa o mesmo esqueleto do **Fashion AI**:
a peça de roupa vira **peça de alimento**, o look vira **esquema de alimentação**, a marca vira **restaurante / marca de alimentos**
e a celebridade vira **chef**.

Este arquivo tem três partes:
1. o prompt pronto para colar em uma IA (ou entregar a um time) e gerar o conceito completo;
2. a lista de requisitos funcionais (RF1–RF29);
3. onde ficam os artefatos gerados.

---

## 1. Prompt

> **Papel.** Você é arquiteto(a) de software sênior e product designer de um time de produto de alto nível.
> Vai conceber o **Dine Explorer**, um app de varejo culinário, gastronomia, restaurantes e comida, com rede social e IA.
> Reaproveite o esqueleto de produto do **Fashion AI**, que já está validado no TCC:
> - peça de roupa → **peça de alimento** (prato, ingrediente, bebida, sobremesa);
> - esquema de vestimenta (look) → **esquema de alimentação** (refeição ou prato composto);
> - marca → **restaurante** e **marca de alimentos**;
> - celebridade → **chef**;
> - DNA de Estilo → **DNA de Alimentação**;
> - Provador / Meu Quarto → **Criador de Prato 2D** e **BioDine™** (IoT).
>
> **Stack obrigatória (o melhor do mercado em 2026):**
> - **Backend:** Spring Boot 4.0 + Java 25 LTS.
>   - Virtual threads ligadas.
>   - Spring Modulith (monólito modular com fronteiras verificadas, pronto para virar microsserviço).
>   - Arquitetura hexagonal: `web` → `application` → `domain`, com portas e adaptadores.
>   - Spring Security 7: OAuth2/OIDC, passkeys (WebAuthn), JWT ES256 e refresh token rotativo.
>   - Bean Validation e ProblemDetail (RFC 9457).
>   - Flyway, Testcontainers, ArchUnit e GraalVM native-image opcional.
> - **Bancos de produção (persistência poliglota):**
>   - **MySQL 8.4**: fonte da verdade transacional (ACID).
>   - **Cassandra 5**: séries temporais, contadores, feed, auditoria e telemetria IoT.
>   - **Redis 7**: cache, sessão, rate limit, carrinho e rankings em sorted set.
>   - **OpenSearch 2**: busca full-text, k-NN semântico, geo e agregações de heatmap.
>   - **Amazon S3 + CloudFront**: mídia, modelos 3D, tiles do globo e exportações LGPD.
> - **Eventos:** Kafka (Spring Cloud Stream / Kafka Streams) com padrão outbox.
> - **IA:** Spring AI.
>   - Visão para reconhecer o prato pela foto.
>   - LLM com RAG sobre o OpenSearch k-NN para o Copilot.
>   - Classificador para moderar comentários.
> - **Observabilidade:** Micrometer + OpenTelemetry → Grafana, Tempo e Loki.
> - **Frontend:**
>   - Next.js 15 / React 19 com TanStack Query e cliente gerado do OpenAPI.
>   - React Native para mobile.
>   - React Three Fiber + three-globe + deck.gl (H3) para o globo.
>   - Lottie/Rive para as ilustrações animadas.
> - **Infra:** AWS (EKS ou ECS Fargate), CloudFront + WAF, Spring Cloud Gateway e AWS IoT Core (MQTT).
>
> **Entregue:**
> 1. Visão de produto com três objetivos, personas (Pessoal, Restaurante, Chef, Marca de alimentos) e proposta de valor de varejo.
> 2. Requisitos funcionais numerados, seguindo o mesmo esqueleto do Fashion AI:
>    - **RF1 — Tela de Cadastro:** wizard por tipo de perfil, Argon2id, verificação de e-mail, CNPJ para empresas, consentimentos LGPD não pré-marcados.
>    - **RF2 — Tela de Login:** senha, passkey, OIDC, 2FA TOTP, rate limit no Redis, bloqueio progressivo, recuperação de senha.
>    - **RF3 — Gerenciar a conta:** dados pessoais, sessões, segurança, privacidade (LGPD) e notificações.
>    - **RF23 — Telas de configuração:** Conta, Privacidade/LGPD, Aparência (tema, cor de destaque, fonte, contraste, reduzir animações, densidade), Idioma & Região e Seus dados.
>    - Os demais RFs vêm do board existente (RF4–RF22) e dos obrigatórios abaixo.
> 3. **RF obrigatório de métricas da rede social:**
>    - O DineHype Score é calculado a partir de eventos (view, tempo de permanência, reações, comentários, shares, salvos, check-ins, pedidos e reservas), com decaimento temporal.
>    - O **Índice de Sentimento Culinário** compara reações positivas e negativas.
>    - Os rankings Top 10 do mundo e Top 20 da região ficam em sorted sets no Redis.
> 4. **RF obrigatório de diretrizes de esquemas.** Anatomia versionada e validada no backend para:
>    - o **Esquema de Alimentação**;
>    - o **Esquema de Peça de Alimento**;
>    - o **Esquema de Restaurante**.
>
>    Os três usam o mesmo card do Fashion AI:
>    - mídia, título e selos;
>    - a linha de ações **curtir · comentar · compartilhar · salvar**;
>    - uma barra de **reações culinárias únicas**: 😋 Delicioso, 🤤 Saboroso, 🤢 Enjoei, 🤮 Eca, 🥗 Saudável, 🌶️ Apimentado, 👵 Comida de vó, 🍽️ Quero provar, 💸 Vale o preço, ✨ Gourmet, 🔥 Viciante, 🧂 Sem sal.
> 5. **Aba Explorador (obrigatória).** Um globo 3D com:
>    - desenhos ilustrativos animados das comidas típicas de cada região;
>    - mapas de calor em hexágonos H3:
>      - obesidade adulta por país (dado público agregado da OMS / NCD-RisC);
>      - restaurantes mais caros;
>      - restaurantes mais populares;
>      - destaques de comidas típicas;
>      - sentimento;
>      - opções saudáveis;
>    - **Top 20 restaurantes mais populares da região** focada e **Top 10 do mundo**, calculados pelas métricas da rede social.
>
>    Dentro do Explorador, a **sub-aba "Restaurantes do Mundo"** é um visualizador com **filtros na top bar** iguais aos da sub-aba Marcas:
>    - filtros: continente, país, cidade, cozinha, faixa de preço, dieta, aberto agora, delivery, reserva, DineHype e distância;
>    - deve reunir o maior número possível de restaurantes de todas as regiões: os cadastrados mais uma base aberta importada (Overture Maps / OpenStreetMap, com atribuição).
> 6. **Varejo:**
>    - cardápio vendável;
>    - carrinho no Redis;
>    - checkout Pix/cartão com gateway tokenizado (PCI);
>    - acompanhamento do pedido em tempo real (SSE);
>    - reservas de mesa;
>    - Idempotency-Key no pedido e no webhook de pagamento.
> 7. Para **cada RF**, gere os cinco diagramas UML em PlantUML: atividades com raias, sequência, componentes, máquina de estados e classes.
>    - Salve em `docs/dine-explorer/diagramas/RF<n>/`.
>    - Use a mesma convenção de nomes do Fashion AI: `RF<n>-atividades.puml`, `RF<n>_Atividades.png` etc.
> 8. Gere uma **planilha** com as colunas: RF · Entidade · Tabela/chave/índice/bucket · **Banco em produção (MySQL, Cassandra, Redis, OpenSearch, S3)** · Atributos · Observação.
>    - Inclua uma aba de entidades únicas e uma aba que justifique cada banco.
> 9. Crie no **Trello**:
>    - um card por RF, com descrição, endpoints, entidades × banco e caminho dos diagramas;
>    - um checklist "Telas" e um checklist "Critérios de aceite";
>    - etiquetas de sprint.
> 10. **LGPD em tudo:**
>     - Privacy by Default.
>     - Consentimento por finalidade.
>     - Dados de saúde e nutrição tratados como **dado sensível** (art. 11).
>     - Portabilidade em ZIP cifrado no S3.
>     - Exclusão com 30 dias de carência e anonimização em todos os bancos.
>     - Trilha de auditoria imutável no Cassandra.
>     - Nunca expor dado individual de saúde no globo: só indicadores públicos agregados por país.
>
> **Restrições de qualidade:**
> - Cada endpoint tem códigos de erro estáveis (por exemplo `VIOLA_DIRETRIZ`, `EMAIL_EM_USO`).
> - Cada entidade declara o seu banco e o motivo da escolha.
> - Cada máquina de estados cobre os caminhos de erro e de expiração.
> - A acessibilidade segue a WCAG 2.2 AA, e "reduzir animações" desliga a rotação do globo e o Lottie.
> - Use i18n em pt-BR, en e es.

---

## 2. Requisitos funcionais (RF1–RF29)

RF1–RF22 vêm do board **Dine Explorer** que já existe no Trello; os textos de RF3 e RF19 foram ajustados para o domínio culinário.
RF23–RF29 são novos.

| RF | Título | Sprint |
|---|---|---|
| RF1 | Cadastrar usuário na plataforma com dados de acesso (Pessoal, Restaurante, Chef, Marca de alimentos) | 1 |
| RF2 | Autenticar usuário na plataforma com credenciais de acesso | 1 |
| RF3 | Gerenciar a conta: dados pessoais, sessão, segurança, privacidade (LGPD) e notificações | 1 |
| RF4 | Adicionar peça de alimento ao inventário (formulário + fotografia) | 2 |
| RF5 | Criar esquema de alimentação na aba "Criar Prato" | 2 |
| RF6 | Inventário de Alimentação Virtual | 2 |
| RF7 | Acessar uma peça de alimento a partir de um esquema salvo | 2 |
| RF8 | Visualizar esquemas e peças de outros usuários (aba "Buscar") | 2 |
| RF9 | Editar esquema de alimentação e peças | 2 |
| RF10 | Recomendações pelo "Copilot" | 3 |
| RF11 | Background Studio dos cards | 2 |
| RF12 | "Minhas Fotos" e upload em lote | 3 |
| RF13 | DNA de Alimentação | 4 |
| RF14 | Aba "Marcas" de alimentos | 3 |
| RF15 | Editor Canvas 2D de foto | 4 |
| RF16 | Imagem 3D das peças (API externa) | 4 |
| RF17 | Perfil de outros usuários | 3 |
| RF18 | Criador de prato virtual 2D | 2 |
| RF19 | Interações sociais culinárias: curtir, comentar, compartilhar, salvar e reações Delicioso, Saboroso, Enjoei, Eca, Saudável… | 3 |
| RF20 | Esquema vinculado a marca de alimentos | 4 |
| RF21 | BioDine™ (sistema ciber-físico) | 4 |
| RF22 | BioDine™ Snapshot (sensor IoT do prato) | 4 |
| **RF23** | **Telas de configuração: Conta, Privacidade/LGPD, Aparência, Idioma, Seus dados** | 1 |
| **RF24** | **Métricas da rede social: DineHype, sentimento culinário, rankings** | 3 |
| **RF25** | **Diretrizes dos esquemas: Alimentação, Peça de Alimento e Restaurante** | 2 |
| **RF26** | **Esquema de Restaurante: card, cardápio, pratos assinatura, horários** | 3 |
| **RF27** | **Aba Explorador: globo 3D, comidas típicas animadas, mapas de calor, Top 20 da região e Top 10 do mundo** | 4 |
| **RF28** | **Explorador › Restaurantes do Mundo: visualizador com filtros na top bar** | 4 |
| **RF29** | **Varejo: pedidos (delivery/retirada) e reservas** | 4 |

A fonte única de todos os RFs (telas, endpoints, entidades, enums, erros e estados) é
[`scripts/dine-explorer/dados_rf.py`](../../scripts/dine-explorer/dados_rf.py).

## 3. Artefatos

| Artefato | Caminho |
|---|---|
| Diagramas UML (145 = 29 RFs × 5 tipos, `.puml` + `.png`) | [`docs/dine-explorer/diagramas/`](diagramas/README.md) |
| Planilha RF × Entidade × Atributos × Banco | [`docs/dine-explorer/planilhas/Dine_Explorer_RF_Entidades_BD.xlsx`](planilhas/Dine_Explorer_RF_Entidades_BD.xlsx) |
| Cards do Trello (JSON) | [`docs/dine-explorer/trello/cards.json`](trello/cards.json) |
| Gerador | `python3 scripts/dine-explorer/gerar.py --render plantuml.jar` |

Os diagramas ficam em `docs/dine-explorer/diagramas/RF<n>` e não em `docs/diagramas/RF<n>`, porque `docs/diagramas/RF1…RF54` já guarda
os diagramas do Fashion AI e seria sobrescrito.
