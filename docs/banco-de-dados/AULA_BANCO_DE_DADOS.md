# Aula de Banco de Dados — FashionAI

Atualizada em 13/10/2026 a partir do código desta edição. O mapa cobre 119 entidades JPA, 2075 atributos (incluindo herdados) e 533 ligações entre rotas e métodos. As novas tabelas desta edição dependem da aplicação das migrations; a existência no código não comprova implantação no banco do site.

## 1. Objetivo e percurso da aula

Ao final, você deve conseguir seguir um dado da tela até sua coluna, alterar um modelo sem perder dados existentes, escrever uma migration compatível e testar leitura, gravação, autorização e evolução do schema. Reserve cerca de 3 horas: 40 minutos para arquitetura e entidades, 40 para rotas e transações, 40 para Flyway e integridade, e 60 para exercícios.

## 2. Como um campo chega ao banco

A tela React coleta dados e chama o cliente HTTP em `lib/api/client.ts`. Um controller de `fai-web` recebe a requisição e resolve `CurrentUser` a partir da sessão. O serviço em `fai-application` valida regras e autorização. Um repository em `fai-domain` carrega ou grava uma entidade JPA. A infraestrutura MySQL fornece a implementação Spring Data e o Flyway mantém as tabelas. O serviço devolve uma projeção/DTO; a tela atualiza o estado com os dados confirmados pela API.

Exemplo real de Trends desta edição: `CommunityTrends` chama `POST /api/challenges/trends`; `CommunityTrendController.create` chama `CommunityTrendService.create`; esse método valida tipo, título, descrição e duração, cria `CommunityTrend` e chama `CommunityTrendRepository.save`. Publicar é outra ação, `POST /api/challenges/trends/{id}/publish`, que define datas e lança FAI Points. Criar rascunho não concede Points.

## 3. Entidades, atributos e colunas

Uma classe com `@Entity` é persistida. `@Table(name=...)` indica a tabela real. Um atributo como `authorId` pode usar `@Column(name="author_id")`: o nome da API e o do SQL não precisam ser iguais. Atributos herdados de `AuditableEntity` incluem UUID, datas e identificação de quem criou/alterou. `VersionedAuditableEntity` acrescenta a versão usada para concorrência otimista. Confira sempre a annotation e a migration correspondente.

`@ManyToOne` referencia outro registro e usa `@JoinColumn`. A coluna contém o identificador, não a foto ou o objeto inteiro. Campos JSON armazenam configurações flexíveis, por exemplo políticas de selos, módulos do quarto e arte de fundo; ainda precisam ser validados pelo serviço. CSV e strings de enums também possuem regras explícitas: não aceite qualquer valor vindo da tela.

## 4. Principais grupos do modelo

| Domínio | Entidades de referência | Papel |
|---|---|---|
| Identidade | User, RefreshToken, VerificationCode, UserConsent, UserPreferences | Cadastro, sessões, códigos, consentimento e preferências. |
| Guarda-roupa | WardrobeItem, PieceImage, PieceUsageDiaryEntry | Peça pessoal, fotografia, disponibilidade e uso. |
| Looks | Scheme, SchemeItem, TipoLook | Look, ligação com peças e tipo escolhido no espelho. |
| Catálogo | Brand, CatalogSource, CatalogProduct, CatalogVariant, CatalogImage, CatalogIngestionRun | Marca, fontes oficiais, produtos, variantes, fotos e importações. |
| Selos | Seal, SealBond | Definição/política do emissor e vínculo com o item reconhecido. |
| Hype | HypeScoreCurrent, HypeScoreSnapshot, HypeSignalDaily, HypeMilestone | Métricas atuais, histórico, sinais reais e marcos. |
| Quarto | RoomLayout, RoomStorageEntry, RoomCatalogItem, RoomInventoryItem | Layout, endereços de armazenamento, itens oferecidos e itens possuídos. |
| Pontos | FaiPointsRule, FaiPointsLedgerEntry | Regra de ganho e livro de lançamentos de saldo. |
| FLAIR/CBC | FlairCardInstance, FlairChallenge, FlairChallengeSubmission, FlairCombination, FlairRedemption | Carta, desafio, entrega, combinação de loja e cupom. |
| Desafios | ChallengeTemplate, ChallengeInstance, ChallengeParticipant, ChallengeEvent, CommunityTrend | Modelo, partida, participantes, evidências e trends. |

Use o CSV para conferir todos os atributos e os nomes exatos das tabelas. A tabela acima é uma orientação de domínio, não um substituto do mapa completo.

## 5. Como usar o mapa do projeto

Abra `MAPA_ENTIDADES_ATRIBUTOS_ROTAS.csv` em Excel/LibreOffice e filtre por entidade, atributo, rota ou serviço. Cada linha informa entidade, tabela, atributo Java, coluna, tipo, verbo HTTP, rota, método, controller, service e arquivo de entidade.

O mapa é uma análise estática. “Getter/setter presente” significa que o nome do acesso aparece no método ou em helpers locais; não prova que todos os caminhos executam esse acesso. “Entidade acessada por repositório” identifica uma ligação de entidade, sem inventar acesso específico ao atributo. Linhas sem rota direta podem corresponder a jobs, eventos, conversores, campos técnicos ou serviços indiretos. Para confirmar uma linha, leia os arquivos indicados e siga a chamada. Um atributo boolean pode ter `isCampo()`; Lombok gera getters/setters que não aparecem escritos na classe.

## 6. Relações e leitura de uma peça/look

`WardrobeItem` é a peça do usuário. `CatalogProduct` é a referência do catálogo: importar um produto não significa que ele já pertence ao guarda-roupa de alguém. Um `SchemeItem` liga um look a uma peça; a marca vem da própria peça. `Seal` define o reconhecimento, enquanto `SealBond` registra o pedido/aprovação daquele reconhecimento. Essas separações evitam duplicar marcas, copiar um catálogo para cada usuário ou confundir a criação de uma política com a concessão de um selo.

No quarto, a posição de armazenamento pertence ao layout/entrada de armazenamento; deslocar uma representação 3D não deve apagar a peça. No Hype, leitura de snapshots e registro de interações são operações diferentes: uma recompensa ou um resgate não pode simular popularidade.

## 7. Validação em três camadas

A tela melhora o feedback, mas o serviço é a autoridade: ele valida campos, taxonomia, política, datas e dono. O banco reforça invariantes com NOT NULL, chaves estrangeiras, índices e restrições UNIQUE. Um checkbox de termos sem validação no backend é insuficiente. Uma relação de usuário sem autorização no serviço permite acesso indevido mesmo que a chave estrangeira seja válida.

Ao adicionar um campo, trate registros antigos: NULL pode representar “ainda não escolhido”. Um DEFAULT só é correto se aquele valor também for verdadeiro para dados históricos. Evite preencher automaticamente um gênero ou estilo que o usuário nunca informou.

## 8. Transações e concorrência

`@Transactional` agrupa operações que precisam confirmar juntas. Publicar uma trend e lançar sua recompensa devem terminar juntas ou ser desfeitas juntas. Uma operação externa lenta, como gerar uma imagem, exige cuidado para não manter locks longos. Separe rascunho/processamento/publicação quando necessário.

Idempotência usa uma referência única: o mesmo evento reenviado não concede uma segunda recompensa. No Trends, a publicação bloqueia o usuário e a trend antes de conferir o estado, e o ledger usa `user + action + ref`. Concorrência precisa ser testada com duas requisições, não apenas com um botão desabilitado na tela.

## 9. Flyway: versões do banco

As migrations ficam em `fai-infrastructure/persistence-mysql/src/main/resources/db/migration`. Um nome como `V63__community_trends.sql` contém versão, separador `__` e descrição. O Flyway registra versão, checksum, descrição, duração e sucesso em `flyway_schema_history`.

Na inicialização, versões pendentes são aplicadas em ordem. Versões SQL e Java compartilham o mesmo espaço: duas migrations V63 falham mesmo com nomes distintos. O teste `MigrationVersionsTest` detecta versões repetidas no classpath. A versão do Flyway não é a versão do produto nem o número do RF.

Não edite uma migration já aplicada. Crie a próxima versão livre e teste em um banco vazio e em um banco que já tenha a versão anterior. `validate` confere checksums; `repair` altera metadados e não resolve sozinho uma tabela faltante ou uma mudança incompatível. `baseline` diz que um schema existente já representa uma versão; não cria as tabelas anteriores. Nunca use `clean` em um banco com dados reais.

## 10. Fluxo seguro para uma alteração de schema

1. Ler entidade, serviço, repository e migration que criaram o campo/tabela.
2. Identificar a próxima versão livre em SQL e Java.
3. Definir o significado de NULL, DEFAULT e dos dados históricos.
4. Criar migration aditiva, mantendo compatibilidade com a versão anterior da aplicação.
5. Atualizar JPA, DTO, serviço, endpoint e formulário.
6. Testar o banco do zero, atualização da versão anterior, dados antigos e permissões.
7. Publicar código e migration juntos; conferir `flyway_schema_history` e a saúde da API.
8. Se houver falha, analisar o erro real e o estado dos objetos antes de retentar. MySQL pode confirmar DDL mesmo quando uma etapa posterior falha.

## 11. Exemplo completo: TipoLook no Espelho

A V60 cria `TipoLook` com `id`, `codigo` e `nome`, semeia FEMININO, MASCULINO e UNISEX e acrescenta `tipo_look_id` ao espelho e ao look. Registros antigos ficam sem tipo selecionado. O formulário deve buscar as opções pela API (`GET /api/tipos-look`), enviar o identificador escolhido e mostrar o valor em outra página após reler o look.

Não grave o texto livre “feminino” diretamente no campo de referência. Verifique se o ID existe, mantenha o vínculo correto e teste salvar, recarregar e visualizar. A migration também considera uma tabela legada de mesmo nome com outra estrutura: preservar dados vem antes de renomear ou excluir objetos.

## 12. Exemplo: SKU e cor

Código/SKU identifica produto ou variante. Uma variante com SKU A na cor azul e outra com SKU B na cor vermelha não pode satisfazer “SKU A + vermelho”. O filtro deve conferir SKU e cor na mesma variante, ou o código do produto com uma variante compatível. Buscas textuais e identificadores devem ser campos distintos; FULLTEXT do nome não garante que um SKU apareça.

## 13. Automação de registros inválidos

Proponho um job de qualidade com execução por lotes e modo relatório por padrão. Regras verificáveis: referências órfãs, códigos de taxonomia desconhecidos, datas finais anteriores às iniciais, URLs sem proveniência, mais de um resgate de evento, campos obrigatórios vazios e posições do quarto fora dos limites.

Cada ocorrência registra regra/versão, tabela, ID, motivo, primeira e última detecção e estado. Reparos determinísticos e reversíveis podem ser automatizados com trilha de auditoria, versão esperada e comparação do valor anterior. Exemplos: normalizar espaços de código, marcar foto inválida para reprocessamento, recalcular projeção derivada. Casos ambíguos entram em quarentena/revisão; não invente marcas, não atribua consentimento, não apague peças e não altere pontuação financeira por heurística.

A proposta pode usar tabelas futuras `data_quality_rules`, `data_quality_issues` e `data_quality_runs`, com status OPEN, REVIEWED, RESOLVED e IGNORED. São nomes de proposta, não tabelas existentes. Métricas: ocorrências abertas por regra, taxa de reparo, reincidência, duração e tamanho do lote. Ofereça relatório, prévia de reparo, autorização da operação e reversão quando possível.

## 14. Testes que comprovam persistência

Para cada exercício: envio válido grava; recarregar devolve o mesmo valor; outra tela mostra o dado; dado inválido é rejeitado; usuário alheio não altera; registros antigos continuam legíveis; a migration não duplica versões; falha de gravação não é apresentada como sucesso. Para eventos com prêmio, teste reenvio e concorrência.

## 15. Vinte exercícios práticos

Cada exercício exige: tabela de opções quando indicada, FK/migration nova, DTO, validação no serviço, rota de opções, campo na tela de origem e leitura em outra tela. Nomes de tabelas abaixo são propostas de exercício, não garantias de tabelas existentes.

| Nº | Alteração | Persistir | Exibir em outra tela |
|---|---|---|---|
| 1 | Espelho: tipo de look feminino/masculino/unisex | FK TipoLook já prevista na V60 | Detalhe do look. |
| 2 | Peça: estado de conservação | FK EstadoConservacao | Card do guarda-roupa. |
| 3 | Peça: instrução de lavagem | FK TipoLavagem | Detalhe da peça. |
| 4 | Look: intensidade térmica | FK NivelTermico | Recomendações do espelho. |
| 5 | Peça: origem adquirida/herdada/trocada | Opções e origem validada | Histórico de uso. |
| 6 | Look: estação preferida | Enum/tabela de estação | Lookbook. |
| 7 | Quarto: tipo de iluminação | FK TipoIluminacao + temperatura | Cena e painel do quarto. |
| 8 | Quarto: nome do módulo de armazenamento | RoomLayout/config validado | Localização no detalhe da peça. |
| 9 | Marca: categoria principal | FK CategoriaMarca | Célula da Busca. |
| 10 | Celebridade: área artística principal | FK AreaArtistica | Cabeçalho do perfil. |
| 11 | Selo: prazo de disponibilidade | Datas + validação de ordem | Mercado de selos. |
| 12 | Política de selo: quantidade mínima por cor | JSON estruturado validado | Prévia de elegibilidade. |
| 13 | Política de selo: marca exigida | Marca resolvida ou referência explícita | Detalhe do selo. |
| 14 | Cupom: canal de utilização | FK CanalCupom | Carteira de cupons. |
| 15 | Cupom: valor mínimo de compra | Decimal não negativo | Detalhe do cupom resgatado. |
| 16 | CBC: modalidade/cenário preferido | Opção validada ligada ao desafio | Central FLAIR. |
| 17 | Trend: tipo de dinâmica | Tipo validado de CommunityTrend | Lista da comunidade. |
| 18 | Perfil: Peça Assinatura | FK de peça própria + histórico | Perfil e álbum de conquistas. |
| 19 | AURA: modalidade da peça | Config de background validado | Fotografia no detalhe e Feed. |
| 20 | Catálogo: identificação de variante por SKU + cor | SKU e cor da mesma variante | Resultado selecionado e peça criada. |

Entrega de cada exercício: migration, arquivos alterados, exemplo de requisição/resposta, testes positivos/negativos e duas evidências visuais (origem e leitura após recarregar). O teste deve demonstrar o comportamento, não apenas espelhar uma função.

## 16. Inventário de migrations presentes

- `V1__baseline.sql`
- `V2__rf_interfaces_completas.sql`
- `V3__seed_brands.sql`
- `V4__criterios_completos_markdowns.sql`
- `V5__meu_guarda_roupa.sql`
- `V6__dashboard_analytics.sql`
- `V7__fai_points_ref_id.sql`
- `V8__content_container_color.sql`
- `V9__dna_narrative_optional.sql`
- `V10__dashboard_ia_por_pais.sql`
- `V11__tipologia_lego.sql`
- `V12__brand_logos.sql`
- `V13__ai_log_host_rf.sql`
- `V14__estudio_e_3d.sql`
- `V15__estudio_detalhe_logo.sql`
- `V16__passarela_eras_colecoes.sql`
- `V17__perfil_e_foto_no_manequim.sql`
- `V18__flair.sql`
- `V19__cupons_e_modos_flair.sql`
- `V20__loja_e_criador_guarda_roupa.sql`
- `V21__marca_da_peca_pela_busca_web.sql`
- `V22__contas_de_teste_fora_da_vitrine.sql`
- `V23__dashboard_admin.sql`
- `V24__core_aesthetic.sql`
- `V25__avatar_3d.sql`
- `V26__fai_points_games.sql`
- `V27__travas_loja_votos_e_moderacao_avatar.sql`
- `V28__selo_ia_na_foto_da_peca.sql`
- `V29__adaptive_garment_capture.sql`
- `V30__catalogo_global.sql`
- `V31__hype_score_v2.sql`
- `V32__remove_tutorial_de_captura.sql`
- `V33__politica_verificacao_emissor.sql`
- `V35__origem_da_conta_e_fixtures.sql`
- `V36__catalogo_design_da_peca.sql`
- `V37__extrato_fai_points_nas_notificacoes.sql`
- `V38__peca_para_doar.sql`
- `V39__hype_regiao_e_subcategorias.sql`
- `V40__fashionai_lens.sql`
- `V41__hype_milestones.sql`
- `V42__identidade_do_avatar_versionada.sql`
- `V43__pipeline_de_imagens_do_catalogo.sql`
- `V44__taxonomia_vocabulario.sql`
- `V45__taxonomia_seed_estrutura.sql`
- `V46__taxonomia_seed_valores.sql`
- `V47__taxonomia_seed_variacoes.sql`
- `V48__peca_variacao_e_atributos.sql`
- `V49__catalogo_variacao_atributos_preco.sql`
- `V50__taxonomia_proveniencia_e_enriquecimento.sql`
- `V51__remix_linhagem.sql`
- `V52__opt_out_criadores_em_alta.sql`
- `V53__fashionai_momentos.sql`
- `V54__extrato_fai_points_respeita_opt_out.sql`
- `V55__cartas_flair.sql`
- `V56__desafios_de_montagem.sql`
- `V57__orientacao_por_tutorial.sql`
- `V58__selos_hype_de_peca.sql`
- `V59__provador_multiplataforma.sql`
- `V60__tipo_look_no_espelho.sql`
- `V61__indices_importacao_catalogo.sql`
- `V62__aura_hype_preference.sql`
- `V63__community_trends.sql`

## Material complementar

- `MAPA_ENTIDADES_ATRIBUTOS_ROTAS.csv`: mapa completo, com indicação da força da evidência estática.
- Código de entidades em `fai-domain/.../model` e repositories em `fai-domain/.../repository`.
- Controllers em `fai-web/.../controller`, serviços em `fai-application/.../service` e `.../catalog`, `.../hype`, etc.
- `scripts/e2e/harness.py`: exemplo de observação das leituras/gravações reais no MySQL de teste.
