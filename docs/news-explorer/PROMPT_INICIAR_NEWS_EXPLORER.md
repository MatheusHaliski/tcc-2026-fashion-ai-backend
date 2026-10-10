# PROMPT — Iniciar o NEWS EXPLORER em um novo repositório

> Copie **tudo** a partir de "INÍCIO DO PROMPT" e cole na primeira mensagem da nova sessão, já dentro do repositório novo (vazio).
> Origem: aulas *Velion · Sistema de Identificação Visual*, *Orange Social · Categorias e Feeds*, *DECIA · Objetivos* e *DECIA · Rede Social / Perfil Vivo*, mais o esqueleto de RF1/RF2/RF3/RF23 do Fashion AI.

---

## INÍCIO DO PROMPT

Você vai iniciar do zero o **NEWS EXPLORER**: uma rede social jornalística que organiza notícias em **janelas segmentadas** (não uma timeline única), com **cards classificados visualmente** (bolinha = quem publica, borda = tipo de peça, selo = classificação/estado de verificação), **interações próprias do jornalismo** e uma camada de **deliberação editorial com IA** inspirada no DECIA. O objetivo é agilizar **pesquisa, leitura e engajamento** do público.

Trabalhe em português do Brasil em toda a documentação, nomes de RF e cards do Trello. Código em inglês (classes, pacotes, endpoints), comentários em português.

### 0. Ordem de execução (siga nesta ordem e faça commit ao fim de cada etapa)

1. **Trello** — criar e preencher o board pelo conector Trello em nuvem (seção 9).
2. **Esqueleto do backend** Spring Boot + Java (seção 7) com `README.md`, `CLAUDE.md` e build verde.
3. **Documento de requisitos** `docs/requisitos/RF.md` com todos os RFs da seção 4 (descrição, telas, regras, critérios de aceite).
4. **Planilha** `docs/planilhas/NewsExplorer_Entidades_por_RF.xlsx` (seção 6).
5. **Diagramas** `docs/diagramas/RF1` … `docs/diagramas/RFN` (seção 8), onde **N = último RF da lista** (hoje N = 28).
6. **Índice** `docs/diagramas/INDICE.md` com tabela RF × 5 diagramas (links para os PNG).
7. Só depois: implementar RF1, RF2, RF3, RF23 (esqueleto de conta) e a seguir os demais, em PRs pequenos.

Ao terminar cada etapa, atualize o card correspondente no Trello (mova de lista, marque checklist, comente o link do commit).

---

### 1. Conceito de produto

- **Gramática Velion aplicada ao jornalismo:** o feed nunca mostra texto corrido. Todo card exibe **título (manchete, 5–12 palavras)** + **linha fina (sutiã)** opcional; o corpo só aparece ao abrir a peça (PostView/Leitor).
- **Feeds segmentados (Orange Social):** a home é um **seletor de janelas**. Cada janela é um feed próprio com seus filtros na top bar. O usuário pode abrir janelas lado a lado (desktop: até 3 colunas tipo TweetDeck; mobile: abas deslizantes).
- **DECIA dentro da redação:** a decisão editorial (o que vira pauta, qual o enquadramento, se uma contribuição do público entra na matéria, se uma checagem é publicada) é uma **deliberação registrada em log imutável de eventos**, com síntese de IA e voto/consenso da equipe. O perfil do jornalista é um **perfil vivo**, derivado da participação (projeção do log), com evidência rastreável.
- **Esquemas jornalísticos (equivalente aos esquemas de vestimenta do Fashion AI):**
  - **Esquema de Peça de Notícia** ≈ peça de roupa (unidade mínima publicável).
  - **Esquema de Assunto de Notícia** ≈ esquema/look: agrupa **múltiplas peças** sobre um mesmo acontecimento/tema (1 assunto → N peças).
  - **Esquema de Canal Noticiário** ≈ perfil de marca: o veículo/canal/coletivo que publica (1 canal → N assuntos → N peças).
  - Os três usam o **mesmo card** com a **mesma linha de ações** do card de moda do Fashion AI (curtir, comentar, compartilhar, salvar), **mais** a linha de **interações jornalísticas** (seção 3).

### 2. Sistema de identificação visual (adaptado)

**Bolinha — quem publica**

| Cor | Tipo de autor | Exemplos |
|---|---|---|
| Azul | Leitor / pessoa física | cidadão, contribuinte |
| Laranja | Jornalista profissional | repórter, colunista, fotojornalista, freelancer com registro |
| Verde | Veículo / empresa de mídia | jornal, TV, rádio, portal, agência |
| Roxo | Coletivo / mídia comunitária / independente | mídia de bairro, newsletter, podcast independente |
| Dourado | Verificado / agência de checagem (IFCN) | agências de fact-checking signatárias |
| Grafite | Instituição / fonte oficial | governo, Defesa Civil, universidade, tribunal |

**Borda — gênero/tipo da peça** (gêneros jornalísticos da graduação, segundo Marques de Melo / Chaparro)

| Cor de borda | Categoria | Gêneros |
|---|---|---|
| Azul | Informativo | nota, notícia, reportagem, entrevista |
| Laranja | Opinativo | editorial, artigo, coluna, crônica, comentário, resenha/crítica, carta do leitor, charge/cartum |
| Verde | Interpretativo | análise, perfil, enquete, cronologia, dossiê, explainer |
| Roxo | Diversional / utilitário | serviço, roteiro, guia, história de interesse humano |
| Vermelho | Alerta / plantão / última hora | breaking news, alerta oficial |
| Dourado | Especial / investigativo / checagem | grande reportagem, série investigativa, fact-check |

**Selo (canto superior) — classificação + estado**

- Classificação indicativa: `LIVRE`, `10+`, `12+`, `14+`, `16+`, `18+`, `SENSÍVEL` (conteúdo com violência/trauma exige aviso e desfoque).
- Estado editorial: `RASCUNHO`, `EM APURAÇÃO`, `PUBLICADA`, `ATUALIZADA`, `CORRIGIDA (errata)`, `CONTESTADA`, `ARQUIVADA`.
- Selo de verificação: `VERIFICADO`, `PARCIALMENTE VERDADEIRO`, `ENGANOSO`, `FALSO`, `SEM CONTEXTO`, `NÃO VERIFICÁVEL` (escala alinhada ao ClaimReview / IFCN).
- **Trending Score** exibido por símbolo (🔥 em alta · 📈 subindo · ➖ estável · 📉 em queda), nunca número cru.

**Ontologia geométrica VSL** (ícones): losango = pessoa/identidade; hexágono = canal/comunidade; retângulo = instituição/fonte oficial; estrela = especial/investigação; círculo = reservado (futuro: eventos ao vivo).

### 3. Interações

**Linha social (igual ao card do Fashion AI):** ♡ curtir · 💬 comentar · ↗ compartilhar · 🔖 salvar · 👁 visualizações.

**Linha jornalística (exclusiva do News Explorer) — cada uma é um RF próprio:**

1. **Verificar Fatos (Fact-Check)** — o usuário abre um painel com as **fontes, evidências e documentos** que comprovam ou contestam cada afirmação marcada na peça (claim → evidência → veredito, com links, PDFs, dados, prints com hash e Content Credentials C2PA quando houver). Pode pedir checagem de um trecho.
2. **Acompanhar Desdobramentos** — seguir uma notícia/assunto e ver uma **linha do tempo interativa** com atualizações, acontecimentos relacionados, novas descobertas e erratas; notificações push/e-mail opt-in.
3. **Questionar o Jornalista** — enviar pergunta ao autor; o autor responde **publicamente** e pode anexar a resposta como **complemento** da matéria (versão nova da peça, com diff visível).
4. **Confrontar Versões** — comparar coberturas diferentes do mesmo acontecimento (mesmo Assunto, canais distintos): divergências factuais, enquadramento/perspectiva editorial, fontes citadas por cada um, informações ainda **não confirmadas**. Exibir "mapa de cobertura" (quem cobriu, quem não cobriu — referência Ground News/Google Full Coverage).
5. **Contribuir com a Investigação** — enviar pistas, documentos, fotos, áudios ou relatos para a redação; tudo entra em **quarentena de verificação** (deliberação DECIA) antes de ser incorporado; opção de envio **anônimo protegido** (remoção de metadados EXIF, sem log de IP no conteúdo, canal tipo SecureDrop).

**Reações qualitativas (DECIA):** 🎯 Relevante · 🧩 Bem apurado · 🙋 Quero saber mais — alimentam a reputação contextual do jornalista/canal, nunca um ranking público punitivo.

### 4. Lista de Requisitos Funcionais (N = 28)

Use exatamente esta numeração. RF1, RF2, RF3 e RF23 seguem **o mesmo esqueleto do Fashion AI** (mesmas telas, mesmos fluxos, mesma máquina de estados), trocando apenas o domínio.

| RF | Nome | Resumo |
|---|---|---|
| **RF1** | Tela de Cadastro | Cadastro com tipo de perfil: **Leitor**, **Jornalista** (registro profissional/MTB opcional, portfólio), **Canal Noticiário** (CNPJ/registro, expediente), **Instituição/Fonte oficial**. E-mail + senha forte, passkey (WebAuthn), OAuth Google/Apple; verificação de e-mail por código; aceite de Termos e Política de Privacidade (versões registradas); data de nascimento (classificação indicativa); escolha inicial de editorias de interesse. Máquinas de estado: `Conta` (PENDENTE_VERIFICACAO → ATIVA → SUSPENSA → EXCLUSAO_SOLICITADA → EXCLUIDA) e `Verificacao` (de jornalista/canal: SOLICITADA → EM_ANALISE → APROVADA/REJEITADA). |
| **RF2** | Tela de Login | E-mail+senha, passkey, OAuth; MFA (TOTP); "lembrar dispositivo"; recuperação de senha; bloqueio progressivo (rate limit em Redis); JWT de acesso curto + refresh token rotativo; máquina de estados `Sessao`. |
| **RF3** | Gerenciar a conta: dados pessoais, sessão, segurança, privacidade (LGPD) e notificações | Editar perfil; trocar e-mail/senha; listar e encerrar sessões/dispositivos; MFA; consentimentos granulares (LGPD art. 7º/8º); exportar meus dados (portabilidade, art. 18); excluir conta (com período de carência); preferências de notificação (desdobramentos, respostas do jornalista, alertas, newsletter). Máquinas: `Consentimento`, `Exportacao`, `Exclusao`, `Notificacao`. |
| **RF4** | Criar Esquema de Peça de Notícia | Editor da peça: manchete, linha fina (sutiã), lead (5W2H), corpo, olho/intertítulos, retranca/chapéu, gênero, editoria, dateline, byline/coautores, fontes citadas (on/off), mídias (com legenda, crédito, C2PA), classificação indicativa, embargo, licença, idioma, geolocalização, tags. Validação de pirâmide invertida e tamanho do título. |
| **RF5** | Criar Esquema de Assunto de Notícia | Agrupar N peças sobre um acontecimento/tema: título do assunto, resumo, linha do tempo, entidades (pessoas, lugares, organizações), status (EM DESENVOLVIMENTO, CONSOLIDADO, ENCERRADO), canais que cobrem. 1 Assunto → N Peças (de canais diferentes inclusive). |
| **RF6** | Criar e gerenciar Esquema de Canal Noticiário | Perfil do veículo: nome, logo, tipo (impresso, TV, rádio, portal, agência, podcast, newsletter, coletivo), país/cidade/idiomas, expediente, linha editorial declarada, política de correções, propriedade/financiamento (transparência), selos (IFCN, Trust Project, JTI), editorias, jornalistas vinculados. |
| **RF7** | Feed em janelas segmentadas | Home como seletor de janelas: **Agora** (última hora) · **Para você** · **Seguindo** · **Assuntos** · **Canais** · **Checagens** · **Áudio** (podcasts/briefings) · **Alertas** (oficial/Defesa Civil) · **Local**. Abrir até 3 janelas lado a lado; cada janela com filtros na top bar (editoria, gênero, tipo de autor/bolinha, país, cidade, idioma, período, verificação, classificação). Ordem das janelas personalizável. |
| **RF8** | Leitor da peça (detalhe) | Modo leitura limpa, tempo estimado, ajuste de fonte/tema, áudio TTS, resumo por IA em estilos (5W, "explique simples", "lados opostos"), tradução, notas de rodapé de fontes, histórico de versões/erratas, peças relacionadas do mesmo Assunto. |
| **RF9** | Interações sociais | Curtir, comentar (fio, moderação, denúncia), compartilhar (link com prévia OG, imagem do card), salvar em coleções ("Ler depois", pastas), reações qualitativas. Máquina de estados `Comentario`. |
| **RF10** | Verificar Fatos (Fact-Check) | Ver interação 1 da seção 3. Entidades `Afirmacao`, `Evidencia`, `Veredito`, `PedidoChecagem`; export ClaimReview (schema.org). |
| **RF11** | Acompanhar Desdobramentos | Interação 2. `Acompanhamento`, `EventoLinhaDoTempo`; timeline interativa; notificação a cada novo evento. |
| **RF12** | Questionar o Jornalista | Interação 3. `Pergunta`, `Resposta`, `ComplementoMateria`; fila do jornalista; limite por usuário; moderação. Máquina `Pergunta` (ENVIADA → EM_MODERACAO → ACEITA → RESPONDIDA → INCORPORADA / RECUSADA). |
| **RF13** | Confrontar Versões | Interação 4. Comparação lado a lado por Assunto; IA extrai afirmações por canal e marca convergência/divergência/não confirmado; mapa de cobertura por espectro e região. |
| **RF14** | Contribuir com a Investigação | Interação 5. `Contribuicao`, `Anexo`; quarentena; deliberação DECIA; anonimato protegido; crédito opcional ao contribuinte. Máquina `Contribuicao` (RECEBIDA → EM_TRIAGEM → EM_VERIFICACAO → INCORPORADA / ARQUIVADA / DESCARTADA). |
| **RF15** | **Diretrizes de Esquemas** (Assunto, Peça e Canal) | RF **obrigatório** de regras: campos obrigatórios por gênero, limites de título/sutiã, regra 1 Assunto → N Peças, quando uma peça pode existir sem Assunto, herança de editoria/classificação do Assunto para as Peças, vinculação Peça↔Canal↔Jornalista, versionamento e errata, política de títulos (anti-clickbait: título não pode prometer o que o lead não entrega — validação por IA), padrões de crédito de imagem, embargo, direito de resposta. Gera `docs/diretrizes/ESQUEMAS.md` + validadores no backend (`SchemaGuidelineValidator`). |
| **RF16** | **Métricas de Rede Social** | RF **obrigatório**: visualizações, leitores únicos, tempo de leitura, taxa de leitura completa (scroll depth), curtidas, comentários, compartilhamentos, salvamentos, acompanhamentos, perguntas, contribuições, checagens solicitadas; **Trending Score** = curtidas×1.0 + views×0.2 + compart.×2.0 + coment.×1.5 + salvos×1.2 + acompanhamentos×2.5 + frescor (100/(h+1)), com antifraude (usuários únicos, detecção de bots, peso para verificados); **Índice de Confiança** do canal (correções publicadas, checagens, transparência) — nunca ranking punitivo de pessoas; painéis por peça, assunto, canal e jornalista; série temporal em Cassandra, contadores quentes em Redis. Também alimenta os rankings de restaurantes/locais do RF17. |
| **RF17** | **Aba Explorador — Globo** | RF **obrigatório** (ver seção 5). Globo 3D com desenhos ilustrativos e animados e camadas de mapa de calor. |
| **RF18** | **Explorador › Sub-aba Visualizador de Canais, Assuntos e Peças** | Sub-aba com **filtros na top bar** (mesmo padrão da sub-aba **Marcas** do Fashion AI): região/continente, país, cidade, idioma, tipo de canal, bolinha, editoria, gênero, verificação, espectro editorial declarado, período, ordenação (trending, mais recentes, mais acompanhados, mais confiáveis). Grade de cards dos três esquemas. **Seed** com o maior número possível de canais de todas as regiões do mundo (seção 5.3). |
| **RF19** | Perfil vivo do Jornalista e do Canal | Perfil derivado do log (DECIA aula 2): competências por editoria com evidências (`eventId`), temas, selos por marco ("Apuração exemplar", "50 correções transparentes"), resumo gerado por IA, versionado e contestável pelo próprio dono. |
| **RF20** | Redação Deliberativa (DECIA Jornalístico) | Deliberação editorial coletiva: pauta proposta → opções de enquadramento → argumentos → **síntese da IA** (convergências/divergências) → voto (maioria, consenso, ponderado por papel) → decisão fechada. Máquina `Deliberacao` (ABERTA → COLETANDO_OPCOES → VOTACAO → EM_SINTESE → FECHADA). Log imutável de eventos; usado para pauta, incorporação de contribuições (RF14), publicação de checagens (RF10) e erratas. |
| **RF21** | Busca global | Busca full-text e semântica (OpenSearch + embeddings k-NN) em peças, assuntos, canais, jornalistas e checagens; filtros facetados; sugestões; busca por entidade (pessoa/lugar/organização) e por data. |
| **RF22** | Janela de Alertas e Plantão | Feed institucional (whitelist: Defesa Civil, clima, saúde pública, infraestrutura, comunicados oficiais) separado do feed de denúncias; geofence por cidade; nunca violência gráfica no feed de alertas. |
| **RF23** | Telas de configuração (Conta, Privacidade/LGPD, Aparência, Idioma, Seus dados) | **Mesmo esqueleto do RF23 do Fashion AI**: Conta; Privacidade e LGPD (consentimentos, cookies, base legal, DPO, solicitações do titular); **Aparência** (tema claro/escuro/sistema, tamanho de fonte, densidade do card, alto contraste, reduzir animações do globo); Idioma e região; Seus dados (exportar, histórico de leitura, limpar recomendações). Máquina `Exportacao`. |
| **RF24** | IA do sistema (motor transversal) | Resumos, tradução, extração de afirmações, detecção de título enganoso, clusterização de peças em Assuntos, síntese de deliberação, perfil vivo, embeddings para busca/recomendação. Provedor via Spring AI (Claude como padrão); toda saída estruturada (JSON) e com evidência; registro de cada inferência como evento (transparência algorítmica). Rótulo "gerado por IA" visível. |
| **RF25** | Moderação, classificação e denúncias | Fila de moderação humana + automática; classificação indicativa; conteúdo sensível com desfoque; direito de resposta; denúncia de desinformação; transparência de moderação. |
| **RF26** | Janela de Áudio e Briefings | Podcasts, boletins de rádio, **briefing diário personalizado** em áudio (TTS) com capítulos por Assunto; player com forma de onda no card. |
| **RF27** | Proveniência e autenticidade (C2PA) | Leitura e exibição de Content Credentials (C2PA) em imagens/vídeos; assinatura das mídias publicadas; hash de anexos de contribuições; selo "origem verificada". |
| **RF28** | Newsletters e Coleções editoriais | Canal publica newsletter a partir de Assuntos/Peças; usuário assina por editoria/canal/assunto; coleções curadas ("Entenda o caso"). |

### 5. Aba EXPLORADOR (RF17 + RF18) — obrigatória

#### 5.1 Globo (RF17)
Globo 3D interativo (frontend: `react-globe.gl`/three.js ou deck.gl `GlobeView`), com **desenhos ilustrativos e animados** (ícones SVG/Lottie flutuando sobre cada região) e **camadas alternáveis** num painel lateral:

1. **Notícias agora** — pontos pulsantes por volume de peças publicadas na última hora; clique abre o Assunto.
2. **Comidas de cada região do mundo** — ilustrações animadas dos pratos típicos por país/região (ex.: feijoada BR, ramen JP, tacos MX, pizza IT, jollof rice NG, pho VN, paella ES, kimchi KR, poutine CA, biryani IN…), com card do prato, origem e peças jornalísticas de gastronomia relacionadas.
3. **Mapa de calor — prevalência de obesidade** por país (fonte pública e citada: OMS Global Health Observatory / NCD-RisC; ano exibido na legenda; dado agregado por país, nunca individual).
4. **Mapa de calor — restaurantes mais caros** (preço médio por região).
5. **Mapa de calor — restaurantes mais populares** (calculado pelas **métricas da rede social do sistema — RF16**: menções, curtidas, salvamentos e compartilhamentos de peças que citam o restaurante).
6. **Destaques de comidas típicas** por região (ranking de pratos mais citados/curtidos).
7. **Top 20 restaurantes mais populares da região** selecionada (lista lateral + pinos animados).
8. **Top 10 restaurantes mais populares do mundo** (mesma métrica RF16, janela de 30 dias).
9. **Mapas de calor de atributos variados** (extensível): liberdade de imprensa (índice RSF), densidade de canais, cobertura por editoria, alertas ativos, temas em alta, checagens por país, "desertos de notícia" (regiões sem cobertura local).

Entidades novas: `Regiao`, `Pais`, `Cidade`, `PratoTipico`, `Restaurante`, `IndicadorRegional` (tipo, valor, ano, fonte), `CamadaMapaCalor`, `RankingRestaurante` (escopo REGIAO/MUNDO, posição, score, período). Ilustrações em S3; tiles/agregados em Redis; geobusca em OpenSearch (`geo_point`/`geo_shape`).

Acessibilidade: alternativa em lista/tabela para cada camada; respeitar `prefers-reduced-motion`; paleta de calor perceptualmente uniforme e legível para daltônicos.

#### 5.2 Sub-aba Visualizador (RF18)
Mesmo padrão da sub-aba **Marcas** do Fashion AI: top bar fixa com chips de filtro (região, país, cidade, idioma, tipo de canal, bolinha, editoria, gênero, verificação, período, ordenação) + busca; abaixo, segment control **Canais · Assuntos · Peças**, grade de cards com paginação infinita (cursor). Clicar no globo aplica o filtro de país automaticamente.

#### 5.3 Seed de dados (o maior número possível, todas as regiões)
Crie `src/main/resources/seed/canais.json` (e `assuntos.json`, `pecas.json` de exemplo) com **no mínimo 150 canais reais**, cobrindo todos os continentes, com nome, país, cidade, idioma, tipo, site e logo-placeholder. Pontos de partida (amplie):
- **Brasil:** Folha de S.Paulo, O Globo, Estadão, Valor Econômico, g1, UOL, CNN Brasil, BBC News Brasil, Agência Brasil, Agência Pública, The Intercept Brasil, Piauí, Nexo, Poder360, Metrópoles, Aos Fatos, Lupa, Projeto Comprova, Correio Braziliense, Zero Hora/GZH, Gazeta do Povo, Jornal do Commercio, A Tarde, O Povo, Band, Record, SBT, Rádio CBN, Jovem Pan, Brasil de Fato, Marco Zero, Ponte Jornalismo, Amazônia Real.
- **América Latina:** Clarín, La Nación (AR), El Mercurio, Ciper (CL), El Tiempo (CO), El Universal, Animal Político (MX), El Comercio, Ojo Público (PE), El País Uruguay, Efecto Cocuyo (VE), El Faro (SV), Confidencial (NI), Chequeado (AR).
- **América do Norte:** The New York Times, The Washington Post, AP, Reuters, NPR, PBS, ProPublica, The Wall Street Journal, Los Angeles Times, CBC, The Globe and Mail, La Presse.
- **Europa:** BBC, The Guardian, Financial Times, The Economist, Le Monde, Le Figaro, AFP, El País, ABC, Der Spiegel, Die Zeit, FAZ, Süddeutsche Zeitung, DW, Corriere della Sera, la Repubblica, ANSA, Público, Expresso, RTP, NRC, De Volkskrant, Dagens Nyheter, Yle, Gazeta Wyborcza, Kyiv Independent, Meduza, Novaya Gazeta Europe, Bellingcat, OCCRP, Euronews.
- **África:** Daily Maverick, News24, Mail & Guardian (ZA), Premium Times, The Punch (NG), Nation (KE), The East African, Al-Ahram, Mada Masr (EG), Jeune Afrique, Africa Check, The Continent, Rádio Moçambique, Jornal de Angola.
- **Oriente Médio:** Al Jazeera, Haaretz, The Times of Israel, Al-Monitor, The National (EAU), Arab News, L'Orient-Le Jour, Daraj.
- **Ásia:** NHK, Asahi Shimbun, Nikkei, Yonhap, The Korea Herald, Caixin, South China Morning Post, The Hindu, The Indian Express, Scroll.in, The Wire, Dawn, The Daily Star (BD), Rappler, Inquirer, Straits Times, CNA, Kompas, Tempo, Malaysiakini, VnExpress, Bangkok Post, Kathmandu Post.
- **Oceania:** ABC Australia, The Sydney Morning Herald, The Guardian Australia, RNZ, Stuff, The Spinoff, ABC Pacific.
Para cada canal, gerar ao menos 1 Assunto e 3 Peças fictícias marcadas `seed=true`, deixando claro na UI que são exemplos (nunca atribuir texto inventado a veículo real sem o rótulo "exemplo").

### 6. Planilha `docs/planilhas/NewsExplorer_Entidades_por_RF.xlsx`

Gerar com Apache POI (classe utilitária em `tools/`) ou script Python/openpyxl. Abas:

1. **RF_Entidade_Atributo** — colunas: `RF` · `Nome do RF` · `Entidade` · `Atributo` · `Tipo` · `Obrigatório` · `Descrição (conceito jornalístico)` · `Banco em produção` (MySQL | Cassandra | Redis | OpenSearch | S3) · `Justificativa do banco` · `Índice/chave` · `LGPD (dado pessoal? base legal)` · `Retenção`.
2. **Entidades** — uma linha por entidade com banco principal e réplicas (ex.: Peça → MySQL fonte da verdade + OpenSearch índice + S3 mídias + Redis cache).
3. **Bancos** — papel de cada banco:
   - **MySQL 8.4** (fonte da verdade transacional): contas, perfis, canais, peças, assuntos, versões, fontes, diretrizes, deliberações (projeção), consentimentos.
   - **Cassandra 5** (alto volume, escrita contínua, séries temporais): eventos de interação, log imutável de deliberação, leituras/scroll depth, métricas por hora, feed materializado por usuário, timeline de desdobramentos, notificações.
   - **Redis 8** (memória): sessões/refresh tokens, rate limit, contadores quentes, trending sorted sets, cache de feed e de camadas do globo, filas leves (Streams).
   - **OpenSearch 3** (busca): índice de peças/assuntos/canais/checagens, busca semântica k-NN, agregações de facetas, geobusca do globo.
   - **S3** (objetos): mídias, anexos de contribuições (bucket isolado e criptografado), ilustrações do globo, exports LGPD, áudio TTS, manifestos C2PA.
4. **Matriz_RF_x_Banco** — RF nas linhas, bancos nas colunas, X onde usa.

**Catálogo mínimo de entidades e atributos jornalísticos** (complete com tipos e todos os RFs):

- `Usuario` (id, email, senhaHash, tipoPerfil[LEITOR, JORNALISTA, CANAL, INSTITUICAO], nomeExibicao, handle, dataNascimento, pais, cidade, idioma, editoriasInteresse[], verificado, statusConta, criadoEm)
- `Jornalista` (usuarioId, nomeProfissional, registroProfissional(MTB/DRT), funcao[REPORTER, EDITOR, EDITOR_CHEFE, COLUNISTA, FOTOJORNALISTA, CINEGRAFISTA, PRODUTOR, CHECADOR, CORRESPONDENTE, FREELANCER, INFOGRAFISTA, APRESENTADOR], editoriasAtuacao[], canaisVinculados[], portfolioUrl, chavePGP, declaracaoConflitoInteresse)
- `CanalNoticiario` (id, nome, slug, tipo[IMPRESSO, TV, RADIO, PORTAL, AGENCIA, PODCAST, NEWSLETTER, COLETIVO, REVISTA], pais, cidade, idiomas[], fundadoEm, expediente, linhaEditorialDeclarada, politicaCorrecoes, politicaEtica, propriedade, financiamento, selosConfianca[IFCN, TRUST_PROJECT, JTI], editorias[], site, redesSociais, indiceConfianca)
- `EsquemaAssunto` (id, titulo, resumo, editoria, statusAssunto[EM_DESENVOLVIMENTO, CONSOLIDADO, ENCERRADO], entidadesCitadas[pessoa/lugar/organização], geolocalizacao, periodoInicio, periodoFim, classificacaoIndicativa, canaisCobrindo[], trendingScore)
- `EsquemaPeca` (id, assuntoId?, canalId, autores[], tipoAutor(bolinha), genero[NOTA, NOTICIA, REPORTAGEM, GRANDE_REPORTAGEM, ENTREVISTA, EDITORIAL, ARTIGO, COLUNA, CRONICA, COMENTARIO, RESENHA, CARTA_LEITOR, CHARGE, ANALISE, PERFIL, EXPLAINER, CRONOLOGIA, INFOGRAFICO, SERVICO, FACT_CHECK, ALERTA], categoriaBorda, chapeu/retranca, manchete, linhaFina, lead, corpo, intertitulos[], olho, dateline(local+data), dataPublicacao, dataAtualizacao, embargoAte, idioma, editoria, tags[], classificacaoIndicativa, avisoConteudoSensivel, valoresNoticia[ATUALIDADE, PROXIMIDADE, PROEMINENCIA, IMPACTO, CONFLITO, RARIDADE, INTERESSE_HUMANO, UTILIDADE], fontes[], midias[], licenca, statusEditorial, versao, tempoLeituraMin, geolocalizacao, urlCanonica)
- `Fonte` (id, nome, tipo[PRIMARIA, SECUNDARIA, DOCUMENTAL, OFICIAL, ESPECIALISTA, TESTEMUNHA, ANONIMA], condicao[ON, OFF, BACKGROUND, EMBARGO], cargo, organizacao, contatoProtegido)
- `Midia` (id, tipo[FOTO, VIDEO, AUDIO, INFOGRAFICO, DOCUMENTO], s3Key, legenda, credito, textoAlternativo, c2paManifest, hash, sensivel)
- `VersaoPeca` / `Errata` (pecaId, versao, diff, motivo, tipo[ATUALIZACAO, CORRECAO, ERRATA, COMPLEMENTO], publicadoEm)
- `Afirmacao`, `Evidencia` (tipo, url, s3Key, hash, descricao, fonteId), `Veredito` (escala, justificativa, checadorId, claimReviewJson), `PedidoChecagem`
- `Acompanhamento`, `EventoLinhaDoTempo` (assuntoId, tipo[ATUALIZACAO, NOVA_DESCOBERTA, RELACIONADO, ERRATA, DESMENTIDO], ocorridoEm, pecaId?)
- `Pergunta`, `Resposta`, `ComplementoMateria`
- `ComparacaoVersoes` (assuntoId, canais[], afirmacoesPorCanal, divergencias, naoConfirmadas, geradoPorIA, modelo, evidencias)
- `Contribuicao` (id, assuntoId?, tipo[PISTA, DOCUMENTO, FOTO, VIDEO, AUDIO, RELATO], anonima, contatoCifrado, anexos[], status, deliberacaoId, creditoAutorizado)
- `Deliberacao`, `OpcaoDeliberacao`, `EventoDeliberacao` (tipo[PROPOSTA, OPCAO, ARGUMENTO, VOTO, SINTESE_IA, FECHAMENTO], payload, em) — log imutável
- `PerfilVivo` (usuarioId, competencias[{editoria, nivel, fontes(eventIds)}], temas[], selos[], resumoIA, versao, contestado)
- `Interacao` (tipo[CURTIDA, COMENTARIO, COMPARTILHAMENTO, SALVAR, REACAO_QUALITATIVA, VIEW, LEITURA_COMPLETA], alvoTipo, alvoId, usuarioId, em)
- `Comentario`, `Colecao`, `Denuncia`, `DecisaoModeracao`
- `MetricaAgregada` (alvoTipo, alvoId, janela[HORA, DIA], views, leitoresUnicos, tempoMedioLeitura, scrollDepthMedio, curtidas, comentarios, compartilhamentos, salvamentos, acompanhamentos, perguntas, contribuicoes, trendingScore), `IndiceConfiancaCanal`
- `JanelaFeed` (usuarioId, tipo, ordem, filtros json), `PreferenciaAparencia`, `Consentimento`, `SolicitacaoTitular`, `Sessao`, `Dispositivo`, `Notificacao`
- Explorador: `Regiao`, `Pais`, `Cidade`, `PratoTipico`, `Restaurante`, `IndicadorRegional`, `CamadaMapaCalor`, `RankingRestaurante`
- IA: `InferenciaIA` (tipo, modelo, promptHash, saidaJson, evidencias, custoTokens, em)
- Diretrizes: `DiretrizEsquema` (alvo[PECA, ASSUNTO, CANAL], genero?, regra, severidade, versao)

### 7. Arquitetura — Spring Boot + Java (versões estáveis mais recentes)

Antes de fixar versões, **confirme no Maven Central / spring.io** a última GA (em out/2026 a referência é **Spring Boot 4.1.x** sobre **Java 25 LTS**). Use:

- **Java 25 LTS**, **Spring Boot 4.1.x** (Spring Framework 7), Gradle Kotlin DSL (ou Maven), **virtual threads** ligadas (`spring.threads.virtual.enabled=true`).
- **Spring Modulith** — monólito modular com módulos = bounded contexts: `identity` (RF1–3, 23), `newsroom` (RF4–6, 15, 20), `feed` (RF7–9), `journalism` (RF10–14), `metrics` (RF16), `explorer` (RF17–18), `search` (RF21), `alerts` (RF22), `ai` (RF24), `moderation` (RF25), `audio` (RF26), `provenance` (RF27), `newsletter` (RF28). Eventos entre módulos via `ApplicationEvents` + Event Publication Registry; testes `@ApplicationModuleTest`; documentação gerada (C4/PlantUML) pelo Modulith.
- **Spring Web MVC** (REST + `ProblemDetail`), **springdoc-openapi**, **API versioning** nativo do Framework 7.
- **Spring Security 7**: JWT (resource server), OAuth2 login (Google/Apple), **passkeys/WebAuthn**, MFA TOTP, método `@PreAuthorize` por papel (LEITOR, JORNALISTA, EDITOR, CHECADOR, MODERADOR, ADMIN, DPO).
- **Spring Data JPA + MySQL 8.4** com **Flyway**; **Spring Data Cassandra**; **Spring Data Redis** (Lettuce); **OpenSearch Java Client** (ou `spring-data-opensearch`); **AWS SDK v2** para S3 (presigned URLs).
- **Spring AI** para LLM (Claude como provedor padrão, saída estruturada com `BeanOutputConverter`) e embeddings para OpenSearch k-NN.
- Mensageria assíncrona: Redis Streams no MVP (Kafka opcional depois) com idempotência, retry com backoff e DLQ (padrões da aula DECIA 01).
- Observabilidade: Micrometer + OpenTelemetry, Actuator, logs JSON.
- Testes: JUnit 5, **Testcontainers** (MySQL, Cassandra, Redis, OpenSearch, LocalStack S3), ArchUnit/Modulith verify.
- `docker-compose.yml` com todos os bancos para desenvolvimento; `Dockerfile` com camadas; opção de imagem nativa GraalVM.
- Frontend (repositório ou pasta `web/` separado, depois): Next.js + TypeScript, `react-globe.gl` para o globo, design tokens dos cards Velion.

### 8. Diagramas — `docs/diagramas/RF1` … `docs/diagramas/RF28`

Para **cada RF** (sem exceção, de 1 até N=28) criar em PlantUML (`.puml`) e renderizar PNG lado a lado, mesmo padrão de nomes do Fashion AI:

```
docs/diagramas/RF{n}/RF{n}-atividades.puml        → RF{n}_Atividades.png
docs/diagramas/RF{n}/RF{n}-sequencia.puml         → RF{n}_Sequencia.png
docs/diagramas/RF{n}/RF{n}-componentes.puml       → RF{n}_Componentes.png
docs/diagramas/RF{n}/RF{n}-maquinadeestados-<entidade>.puml → RF{n}_MaquinaDeEstados_<Entidade>.png
docs/diagramas/RF{n}/RF{n}-classes.puml           → RF{n}_Classes.png
```

- **Atividades:** fluxo de tela do usuário com swimlanes (Usuário · Frontend · API · Banco/IA), incluindo caminhos de erro.
- **Sequência:** Controller → Service → Repository → (MySQL/Cassandra/Redis/OpenSearch/S3/IA), com eventos de módulo.
- **Componentes:** módulo Spring Modulith do RF, suas portas, bancos e serviços externos.
- **Máquina de estados:** a entidade principal do RF (RF1: Conta e Verificacao; RF2: Sessao; RF3: Consentimento, Exportacao, Exclusao, Notificacao; RF4: Peca; RF5: Assunto; RF6: Canal; RF9: Comentario; RF12: Pergunta; RF14: Contribuicao; RF20: Deliberacao; RF23: Exportacao; demais: escolher a entidade com ciclo de vida).
- **Classes:** entidades, enums e relacionamentos do RF, com o banco anotado em estereótipo (`<<MySQL>>`, `<<Cassandra>>`, `<<Redis>>`, `<<OpenSearch>>`, `<<S3>>`).
- Script `scripts/diagramas/render.sh` (PlantUML jar + Java) para regerar os PNG; `docs/diagramas/INDICE.md` com a tabela RF × diagramas.
- Diagramas gerais adicionais: `docs/diagramas/geral/Classes_Geral`, `Componentes_Geral` (C4 nível 2), `Implantacao`.

### 9. Trello — criar o board e editar via conector em nuvem

Use o **conector Trello (MCP em nuvem)** desta sessão. Se as ferramentas `mcp__Trello__*` não estiverem disponíveis, **pare e me peça** para conectar o Trello em *claude.ai → Settings → Connectors* e reabrir a sessão — não use API key colada em chat.

1. `trelloReadMember` (`get_me`) para identificar o usuário, o fuso horário e o workspace.
2. Criar o board **"News Explorer — TCC"** (ou reutilizar se já existir; procure antes com `trelloSearch`).
3. Listas, com `pos` sequencial: `Backlog de RFs` · `Diretrizes & Diagramas` · `Em andamento` · `Em revisão` · `Concluído` · `Referências & Aulas`.
4. Etiquetas: uma por módulo (identity, newsroom, feed, journalism, metrics, explorer, search, alerts, ai, moderation, audio, provenance, newsletter) + `LGPD`, `IA`, `Obrigatório`.
5. **Um card por RF (RF1 … RF28)** em `Backlog de RFs`, título `RF{n} — {nome}`, `pos = n`. Descrição com: resumo, telas, regras de negócio, entidades e bancos (da planilha), critérios de aceite (Given/When/Then). Checklists em cada card:
   - **Diagramas**: Atividades · Sequência · Componentes · Máquina de estados · Classes.
   - **Implementação**: migração Flyway · entidades · repositórios · serviço · controller · testes · OpenAPI.
   - **Telas** (RF1, RF2, RF3, RF23 com o mesmo esqueleto do Fashion AI): RF1 → Cadastro (escolha de perfil, dados, verificação de e-mail, interesses); RF2 → Login (credenciais, MFA, recuperação); RF3 → Dados pessoais, Sessões e dispositivos, Segurança, Privacidade (LGPD), Notificações; RF23 → Conta, Privacidade/LGPD, Aparência, Idioma, Seus dados.
6. Cards extras em `Diretrizes & Diagramas`: "Planilha Entidades × Bancos", "Índice de diagramas", "Seed de canais (150+)", "Diretrizes de Esquemas (RF15)". Em `Referências & Aulas`: um card por aula (Velion, Orange Social, DECIA 01, DECIA 02) e um card de benchmark (seção 10).
7. Marque com etiqueta `Obrigatório` os RF1, RF2, RF3, RF15, RF16, RF17, RF18, RF23.
8. Ao longo do trabalho: mova cards, marque checklists e comente o hash do commit/PR. No fim, me envie o link do board.

### 10. Benchmark — o melhor da indústria a incorporar

- **Ground News / Google News "Full Coverage"**: agrupar a mesma história de muitos veículos e mostrar perspectivas → base do **Confrontar Versões** e do mapa de cobertura.
- **Particle**: resumos por IA em estilos (5W, "explique simples", "lados opostos") e perguntas sobre a história → **RF8/RF24**.
- **Apple News / The Economist Espresso / NYT The Morning**: briefing curto diário e áudio → **RF26**.
- **Reuters Institute — Trends and Predictions 2026**: aposta em áudio, vídeo e vozes individuais, queda de tráfego de busca ("zero-click") e foco em comunidade, apuração de campo e análise → janelas por editoria, perfil vivo do jornalista, newsletters (RF28).
- **C2PA / Content Credentials**: verificação de origem de imagens e vídeos contra deepfakes → **RF27**.
- **ClaimReview (schema.org) + rede IFCN** (Aos Fatos, Lupa, Chequeado, Africa Check): formato padronizado de checagem → **RF10**.
- **SecureDrop**: envio anônimo seguro para redações → **RF14**.
- **Trust Project / Journalism Trust Initiative**: indicadores de transparência do veículo → **RF6** e Índice de Confiança (RF16).

### 11. Fundamentos de bacharelado em Jornalismo a refletir no modelo

Gêneros jornalísticos (Marques de Melo); critérios de noticiabilidade e valores-notícia (Traquina, Wolf); pirâmide invertida e lead 5W2H; apuração, checagem e cruzamento de fontes; condições de fonte (on, off, background, embargo); Código de Ética dos Jornalistas Brasileiros (FENAJ) — direito de resposta, correção pública de erros, sigilo da fonte; ética e deontologia; jornalismo de dados; jornalismo investigativo; webjornalismo (hipertextualidade, multimidialidade, interatividade, memória, atualização contínua, personalização — Palacios/Canavilhas); classificação indicativa (ECA/Ministério da Justiça); LGPD aplicada à atividade jornalística (art. 4º, II, "a" — tratamento para fins exclusivamente jornalísticos, sem afastar a proteção de dados do usuário da plataforma).

### 12. Regras de qualidade

- Nunca atribuir conteúdo inventado a pessoa ou veículo real sem rótulo `exemplo/seed`.
- Toda saída de IA visível ao usuário tem selo "gerado por IA" e link para as evidências.
- Métricas servem à pessoa, não à vigilância (pergunta-critério da aula DECIA 02): sem ranking público punitivo de jornalistas.
- Build verde (`./gradlew check`) antes de cada push; commits pequenos em português, convencionais (`feat:`, `docs:`, `test:`).
- Ao final, me entregue: link do board Trello, lista de RFs criados, caminho da planilha, índice de diagramas e o que ficou pendente.

## FIM DO PROMPT
