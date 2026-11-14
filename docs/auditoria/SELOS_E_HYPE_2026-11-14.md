# Selos e Hype: contas de demonstração, tipos de selo e variação do Hype

Relatório final, atualizado às 04:20 UTC de 14/11/2026.

Tudo foi feito no ambiente local (MySQL instalado na máquina de auditoria, backend em `localhost:8098`, frontend em `localhost:3000`), com IA remota desligada (`AI_REMOTE_ENABLED=false`). Nenhum ambiente publicado foi tocado, nenhuma conta ou pessoa real foi usada e nenhum código do aplicativo foi alterado. As imagens citadas estão em `docs/auditoria/evidencias/selos-hype/`.

## 1. Contas criadas

Todos os nomes são inventados. Senha única de teste; os e-mails usam o domínio reservado `example.com`.

| Conta | Tipo | Como foi criada | Como foi aprovada |
|---|---|---|---|
| @lia.demo (Lia Demo) | Pessoal | Pela tela `/register`, com confirmação do e-mail pelo código de 6 dígitos lido no log do backend | Não precisa de aprovação |
| @bia.demo, @caio.demo, @duda.demo | Pessoal | Pelo mesmo endpoint que a tela usa (`POST /api/auth/register`) e confirmação de e-mail | Não precisa. Servem de público para gerar atividade |
| @vento.norte (Vento Norte) | Marca | Pela tela `/register`, opção Marca, com logo e comprovante fictícios e CNPJ de teste válido | Pela tela `/admin/users` → Aprovações: o administrador confere a lista de critérios e clica em Aprovar ([imagem](evidencias/selos-hype/12-admin-aprovacao-vento-norte-d.jpg)) |
| @brisa.urbana (Brisa Urbana) | Marca | Pela API, sem comprovante de atividade | Primeiro foi recusada como esperado: sem o comprovante o botão Aprovar fica desligado e a API responde 409 `CRITERIOS_PENDENTES` ([imagem](evidencias/selos-hype/12-admin-aprovacao-brisa-urbana-d.jpg)). Depois: administrador pediu ajustes, a marca reenviou com o comprovante e foi aprovada pela tela |
| @maia.solano (Maia Solano) | Celebridade | Pela API, com documento e foto oficial desenhados (não são de pessoa real) | Pela tela `/admin/users`, com a lista de critérios de celebridade |
| @theo.varela (Theo Varela) | Celebridade | Idem | Idem |
| @admin_auditoria | Administração | Criada na subida do backend pelas variáveis `FAI_ADMIN_EMAIL` e `FAI_ADMIN_PASSWORD` (mecanismo do próprio app) | — |

Observações do cadastro e da aprovação:

- O limite de 10 cadastros por hora por rede funcionou (o 11º recebeu 429). Para seguir com a auditoria o backend local foi reiniciado com `AUTH_RATE_LIMIT_ENABLED=false`.
- Um usuário comum tentando aprovar uma marca recebe 403. Correto.
- Ao aprovar pela tela, não aparece nenhuma confirmação visível além de o cartão sumir da fila (detalhe).
- O botão "Verificar" da presença oficial só abre o site em outra aba e pede para o administrador conferir à mão; não há conferência automática do código `FAI-XXXXXX`.

## 2. Tipos de selo encontrados

No código e na tela (aba Selos da página da marca ou celebridade, botão "Novo selo") um selo tem um **nível** e um **modo de criação**:

- Níveis: **Peça**, **Look** e **Perfil** (`SealTier`: `PECA`, `LOOK`, `PERFIL`).
- Modos: **Manual** (regras montadas à mão: o "selo comum"), **Política com Copilot** (precisa de IA remota) e **Selo de Hype** (metas de Hype).
- Além deles existem os **selos padrão** criados sozinhos quando o perfil é aprovado ("Selo Vento Norte · Peça" e "· Look"; para celebridade, "Selo Premium ...") e os **medalhões automáticos de Hype** do próprio FashionAI (Viral, Em alta/Tendência, Emergente, Clássico, Raro), que não dependem de emissor.
- O selo de verificação do perfil (✓ ao lado do nome) aparece para marcas e celebridades aprovadas.

Arquivos: `fai-application/.../service/SealFormWriter.java` (regras de criação), `SealPolicies.java` (critérios), `hype/HypeSeals.java` (medalhões), `components/seal-wizard.tsx` e `components/manual-seal-policy.tsx` (tela).

### Tabela: tipo de selo × tipo de conta

| Tipo de selo | Marca (@vento.norte) | Celebridade (@maia.solano) | Usuário comum (@lia.demo) |
|---|---|---|---|
| Selo padrão de Peça e de Look (criado na aprovação) | Funciona: aparecem na aba Selos | Funciona, com acabamento Premium | Não se aplica |
| Manual · Peça ("Azul Vento Norte (peça)") | Funciona (201) | Não testado nesta combinação | Recusado como esperado: 403 "Selos e promoções são geridos por perfis de marca ou celebridade" |
| Manual · Look ("Dupla Azul Vento Norte (look)", "Look de palco da Maia (look)") | Funciona (201) | Funciona (201) | Recusado como esperado (403) |
| Manual · Perfil ("Vitrine Vento Norte (perfil)", "Vitrine da Maia (perfil)") | Funciona (201). Com ele, "Peças em destaque" do perfil passou a mostrar só peças azuis de looks com selo ([imagem](evidencias/selos-hype/s21-marca-pecas-em-destaque.jpg)) | Funciona (201) | Recusado como esperado (403) |
| Selo de Hype · Look ("Hype 60+ Vento Norte (look)") | Funciona (201) | Não testado nesta combinação | Recusado como esperado (403) |
| Selo de Hype · Peça ("Hype 70+ Vento Norte (peça)", "Hype em alta da Maia (peça)") | Funciona (201) | Funciona (201) | Recusado como esperado (403) |
| Selo de Hype · Perfil | Recusado como esperado: 400 "O Selo de Hype exige critérios válidos e nível PEÇA ou LOOK"; a tela nem oferece Perfil nesse modo | Idem | — |
| Política com Copilot (qualquer nível) | **Não exercitado (IA paga desligada)**: o rascunho responde 503 `IA_INDISPONIVEL` e salvar sem a política gerada responde 400 `POLITICA_IA_OBRIGATORIA` | Idem | — |
| Medalhões automáticos de Hype | — | — | Funciona: a peça "Jeans Hype Médio" e o look "Look Azul Hype Alto" ganharam o medalhão "Em alta/Tendência" quando o Hype passou de 60 em crescimento |
| ✓ de perfil verificado | Funciona depois da aprovação | Funciona | Não aparece (correto) |

A criação pela tela foi percorrida até o passo 3 de 4 (Arte) no modo Manual · Peça ([passo 1](evidencias/selos-hype/s05-Manual-Peca-passo1.jpg), [passo 3](evidencias/selos-hype/s05-Manual-Peca-passo3.jpg)); os selos da tabela foram gravados pelos mesmos endpoints que a tela chama (`POST /api/seals`), com o mesmo formato de dados.

### Aplicação dos selos (pedido, aprovação, recusa, revogação)

| Passo | Resultado |
|---|---|
| Lia pede o selo da Vento Norte para o "Look Azul Hype Alto" (`POST /api/schemes/{id}/seal-bonds`) | 201, **aprovado na hora**, com o selo "Hype 60+ Vento Norte (look)". Aparece no card do look e no perfil da marca ([imagem](evidencias/selos-hype/s10-look-alto-com-selos-dono.jpg), [imagem](evidencias/selos-hype/s20-marca-looks-em-destaque.jpg)) |
| Lia pede o selo da celebridade Maia sem marcar o consentimento de imagem | Recusado como esperado: 400 `CONSENTIMENTO_IMAGEM` |
| O mesmo pedido com consentimento | 201, fica "aguardando revisão"; Maia aprova pela fila e o selo Premium aparece no look |
| Lia pede o selo da Vento Norte para o "Look Hype Baixo" (camiseta vermelha + jeans, nenhuma peça da marca) | 201, **aprovado na hora** com o "Selo Vento Norte · Look". Ver defeito 1 |
| Pedido repetido para o mesmo look e a mesma marca | Recusado como esperado: 409 `VINCULO_EXISTENTE` |
| Outra pessoa (Bia) pede selo para o look da Lia | Recusado como esperado: 403 |
| Pedido de selo a um usuário comum | Recusado como esperado: 400 `PERFIL_INVALIDO` |
| Ofertas de selo de Hype para a peça "Jeans Hype Médio" (Hype 79) | As duas campanhas aparecem como elegíveis; o pedido à marca é aprovado na hora, o da celebridade vai para revisão |
| Ofertas de selo de Hype para "Camisa Hype Baixo" (57) e "Camiseta Zero" (sem Hype) | Recusado como esperado: 409 `POLITICA_NAO_ATENDIDA`; para a peça sem Hype a tela explica "As métricas de Hype não estão disponíveis" |
| Oferta de Hype para o look médio (56, meta 60) | Recusado como esperado |
| Maia recusa o pedido de selo de Hype da peça | 200; o selo não aparece na peça |
| Vento Norte revoga o selo do "Look Hype Baixo" | 200; o medalhão some do card ([imagem](evidencias/selos-hype/s11-look-baixo-selo-revogado-dono.jpg)) |
| Usuário comum tenta aprovar um vínculo ou abrir a fila do emissor | Recusado como esperado: 403 |
| Celebridade tenta revogar selo da marca | Recusado como esperado: 403 |

Onde o selo aparece: no card do look (medalhão sobre a foto e ao lado do preço), no feed, na aba "Looks em destaque" e "Peças em destaque" do emissor, na aba Selos do emissor com a contagem de emissões e o "Hype do selo", e na aba Métricas ([imagem](evidencias/selos-hype/s22-marca-selos.jpg), [imagem](evidencias/selos-hype/s24-marca-metricas.jpg), [imagem](evidencias/selos-hype/s17-feed-com-selos.jpg)). Um usuário comum que visita a marca não vê os botões "Novo selo", "Editar" ou "Desativar" ([imagem](evidencias/selos-hype/s14-selos-da-marca-vistos-por-comum.jpg)).

## 3. Fórmula do Hype como está no código

Arquivos: `fai-application/src/main/java/br/com/fashionai/application/hype/HypeScoreConfig.java` (pesos e limites), `HypeCalculator.java` (cálculo), `HypeIntegrityPolicy.java` (o que conta), `HypeLiveRecalc.java` e `HypeSnapshotService.java` (quando recalcula). Versão do algoritmo: `HYPE_V2_1`.

- O Hype (0 a 100) é uma **média ponderada de dimensões**, cada uma de 0 a 100. Pesos para peça: Popularidade 0,20; Engajamento 0,18; Trend 0,18; Velocidade 0,12; Originalidade 0,10; Raridade 0,08; Longevidade 0,08; Novidade 0,06. Para look, os mesmos mais Influência 0,08 (só entra quando existe remix). Dimensão ausente sai da conta e a média é refeita com os pesos restantes.
- Sinais lidos e peso de cada um na "atividade": curtida 1; comentário 2; salvar 2; compartilhar 3; favoritar 1,5; look remixado 4; peça remixada 3; visualização 0,1; peça usada 1; peça incluída num look 1,5; look usado como look do dia 1. **Seguir alguém não entra na fórmula.**
- Popularidade e Engajamento são posição (percentil) em relação aos outros itens públicos; com menos de 5 itens públicos usa uma curva fixa. Engajamento é interações divididas pelo alcance, com um "empréstimo" de 20 visualizações da média da comunidade para amostras pequenas.
- Trend compara os últimos 7 dias com os 7 anteriores, com meia-vida de 7 dias; Velocidade mede a aceleração semana a semana; Novidade cai pela metade a cada 30 dias de idade; Longevidade só cresce depois de 8 semanas de vida.
- Regras de integridade: interação do próprio dono não conta; cada pessoa conta uma vez por item, por tipo de sinal e por dia; contas com menos de 7 dias valem metade; visitante sem conta não conta.
- Com menos de 3 eventos o item fica em "Dados insuficientes" (sem número).
- Faixas: 0–19 Sinal baixo, 20–39 Nicho, 40–59 Relevante, 60–74 Em alta, 75–89 Tendência, 90–100 Viral.
- O recálculo não é imediato: roda a cada 6 horas, ou até 2 minutos depois de um sinal. Na auditoria foi disparado pelo atalho do administrador (`POST /api/admin/hype/recalibration`) depois de cada lote.

## 4. Hype antes e depois de cada lote de atividade

Toda a atividade foi feita pelas contas de demonstração nos endpoints do app (`/api/interactions/...` e abertura da peça ou do look). Os números vêm das respostas de `GET /api/hype/pieces/{id}` e `GET /api/hype/looks/{id}`. "—" = o look ainda não tinha sido medido naquele lote.

| Lote (o que foi feito) | Peça Zero | Peça Vermelha | Peça Baixo | Peça Médio | Peça Alto | Look Baixo | Look Médio | Look Alto |
|---|---|---|---|---|---|---|---|---|
| 0 · antes de qualquer atividade | dados insuficientes | dados insuficientes | dados insuficientes | dados insuficientes | dados insuficientes | — | — | — |
| 1 · 2 pessoas viram e curtiram baixo, médio, alto (peças) e o look alto | dados insuficientes | dados insuficientes | 56.6 (Relevante) | 64.5 (Em alta) | 52.2 (Relevante) | — | — | — |
| 2 · +3 pessoas: curtir, comentar e salvar em médio e alto (peças) e no look alto | dados insuficientes | dados insuficientes | 53.8 (Relevante) | 78.5 (Tendência) | 71.9 (Em alta) | — | — | — |
| 3 · 7 pessoas: ver, curtir, comentar, salvar, favoritar, compartilhar e remixar o alto (peça e look) | dados insuficientes | dados insuficientes | 65.3 (Em alta) | 80.2 (Tendência) | 73.4 (Em alta) | — | — | — |
| 4 · dona curte a própria peça zero; curtida desfeita e refeita no baixo (integridade) | dados insuficientes | dados insuficientes | 65.3 (Em alta) | 80.2 (Tendência) | 73.4 (Em alta) | — | — | — |
| 5 · 5 pessoas desfazem a curtida e 3 removem o salvo do médio (tentativa de queda) | dados insuficientes | dados insuficientes | 65.3 (Em alta) | 80.2 (Tendência) | 73.4 (Em alta) | — | — | — |
| 6 · looks antes de atividade (peças já movimentadas) | dados insuficientes | dados insuficientes | 65.3 (Em alta) | 80.2 (Tendência) | 73.4 (Em alta) | dados insuficientes | dados insuficientes | dados insuficientes |
| 7 · 2 pessoas: só veem o look baixo; veem e curtem os looks médio e alto | dados insuficientes | dados insuficientes | 65.3 (Em alta) | 80.2 (Tendência) | 73.4 (Em alta) | dados insuficientes | 39.9 (Relevante) | 40.6 (Relevante) |
| 8 · +3 pessoas: curtir e comentar o look médio; curtir, comentar, salvar e favoritar o look alto | dados insuficientes | dados insuficientes | 65.3 (Em alta) | 80.2 (Tendência) | 73.4 (Em alta) | dados insuficientes | 55.4 (Relevante) | 64.4 (Em alta) |
| 9 · 7 pessoas compartilham e remixam o look alto; +2 curtem, comentam, salvam e favoritam | dados insuficientes | dados insuficientes | 65.3 (Em alta) | 80.2 (Tendência) | 73.4 (Em alta) | dados insuficientes | 56 (Relevante) | 69.1 (Em alta) |
| 10 · 7 pessoas apenas visualizam a peça vermelha e o look baixo (sem interagir) | dados insuficientes | 52 (Relevante) | 57.2 (Relevante) | 78.9 (Tendência) | 74.3 (Em alta) | 37.6 (Nicho) | 56 (Relevante) | 69.1 (Em alta) |

Situação final, com as dimensões (Popularidade / Engajamento / Trend / Velocidade / Originalidade / Raridade / Longevidade / Novidade):

| Card | Hype final | Eventos contados | Dimensões |
|---|---|---|---|
| Peça "Camiseta Zero" | dados insuficientes | 1 | 67.9 / 50 / 50.6 / 50.8 / 71.4 / 51.7 / 0 / 100 |
| Peça "Camiseta Vermelha" | 52 (Relevante) | 8 | 75 / 10 / 56.2 / 56.4 / 82.1 / 51.7 / 0 / 100 |
| Peça "Camisa Hype Baixo" | 57.2 (Relevante) | 5 | 82.1 / 30 / 60.6 / 59.9 / 71.4 / 51.7 / 0 / 100 |
| Peça "Jeans Hype Médio" | 78.9 (Tendência) | 17 | 89.3 / 70 / 97.6 / 92.7 / 96.4 / 51.7 / 0 / 100 |
| Peça "Jaqueta Hype Alto" | 74.3 (Em alta) | 46 | 96.4 / 90 / 99.9 / 100 / 28.6 / 0 / 0 / 100 |
| Look "Look Hype Baixo" | 37.6 (Nicho) | 7 | 9.5 / 55.6 / 50.3 / 50.4 / 4.8 / 51.7 / 0 / 100 |
| Look "Look teste" (médio) | 56 (Relevante) | 13 | 47.1 / 69.1 / 81.3 / 73.7 / 4.8 / 51.7 / 0 / 100 |
| Look "Look Azul Hype Alto" | 69.1 (Em alta) | 36 | 67.5 / 79.4 / 99.7 / 100 / 12.4 / 51.7 / 0 / 100 |

O que a tabela mostra:

- **Subida:** a peça "Jeans Hype Médio" foi de sem dados para 64,5, 78,5 e 80,2; o look "Look Azul Hype Alto" foi de sem dados para 40,6, 64,4 e 69,1.
- **Descida:** só aconteceu por comparação com os outros itens. A "Camisa Hype Baixo" caiu de 65,3 para 57,2 sem perder nenhuma interação, só porque outros itens entraram na régua (lote 10). O mesmo item tinha subido de 53,8 para 65,3 no lote 3 sem receber nada.
- **Desfazer não derruba:** no lote 5, cinco pessoas tiraram a curtida e três tiraram o salvo do "Jeans Hype Médio" (os contadores do card foram a 0 curtidas e 0 salvos) e o Hype continuou 80,2. Ver defeito 3.
- **Integridade funciona:** a dona curtindo a própria peça não mudou nada; curtir de novo no mesmo dia não somou.
- **Faixa baixa quase inalcançável:** qualquer peça com 3 eventos já nasce entre 52 e 65 ("Relevante" ou "Em alta"). A peça que 7 pessoas apenas olharam, sem nenhuma interação, ficou com 52. O único card abaixo de 40 foi o look que só recebeu visualizações (37,6, "Nicho"). Ver defeito 4.
- A peça com mais atividade de todas ("Jaqueta Hype Alto", 46 eventos, 7 pessoas fazendo tudo) terminou **abaixo** da "Jeans Hype Médio" (17 eventos): 74,3 contra 78,9, porque Originalidade (28,6) e Raridade (0) pesam contra ela. Isso segue a fórmula, mas é difícil de explicar para quem usa.

## 5. Prova: estilos do painel de Hype aplicados em cada nível

Onde fica: na criação ou edição do card, passo de arte de fundo (em looks o passo se chama "Aparência"; em peças, "Arte de fundo" ou menu ⋯ → "Editar arte do card"), aba **Aura & Material → AURA Hype**. O seletor oferece 4 acabamentos (Bronze, Prata, Ouro, Especial) e 8 estilos: 4 "cards estáticos" e 4 "dinâmicos" ([seletor](evidencias/selos-hype/h10-seletor-de-estilos-aura-hype.jpg)). As contas novas só têm o acabamento Bronze liberado (Prata pede nível Studio; Ouro e Especial pedem Loft), então os 8 estilos foram aplicados no Bronze.

No seletor, as miniaturas mostram sempre "Valores de exemplo" (72 e variações), o que é avisado no rótulo. O valor real aparece no card de pré-visualização depois de escolher o estilo. O texto de cada célula abaixo foi lido da tela.

### Looks (tela `/schemes/{id}/edit`, passo Aparência)

| Estilo | Look Baixo (Hype 38, Nicho) | Look Médio (Hype 56, Relevante) | Look Alto (Hype 69, Em alta) |
|---|---|---|---|
| 1. Atributos na horizontal (fixo) | POP 10 ENG 56 TEN 50 VEL 50 ORI 5 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo1-atributos-na-horizontal.jpg) | POP 47 ENG 69 TEN 81 VEL 74 ORI 5 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo1-atributos-na-horizontal.jpg) | POP 68 ENG 79 TEN 100 VEL 100 ORI 12 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo1-atributos-na-horizontal.jpg) |
| 2. Atributos na vertical (fixo) | POP 10 ENG 56 TEN 50 VEL 50 ORI 5 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo2-atributos-na-vertical.jpg) | POP 47 ENG 69 TEN 81 VEL 74 ORI 5 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo2-atributos-na-vertical.jpg) | POP 68 ENG 79 TEN 100 VEL 100 ORI 12 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo2-atributos-na-vertical.jpg) |
| 3. Duas colunas (fixo) | POP 10 ENG 56 TEN 50 VEL 50 ORI 5 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo3-duas-colunas.jpg) | POP 47 ENG 69 TEN 81 VEL 74 ORI 5 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo3-duas-colunas.jpg) | POP 68 ENG 79 TEN 100 VEL 100 ORI 12 RAR 52 LON 0 NOV 100 INF —<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo3-duas-colunas.jpg) |
| 4. Somente Hype Score (fixo) | HYPE SCORE 38<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo4-somente-hype-score.jpg) | HYPE SCORE 56<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo4-somente-hype-score.jpg) | HYPE SCORE 69<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo4-somente-hype-score.jpg) |
| 5. Ranking em barras LED (dinâmico) | NOV 100 ENG 56 RAR 52 TEN 50 VEL 50 POP 10 ORI 5 LON 0 INF —<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo5-ranking-em-barras-led.jpg) | NOV 100 TEN 81 VEL 74 ENG 69 RAR 52 POP 47 ORI 5 LON 0 INF —<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo5-ranking-em-barras-led.jpg) | TEN 100 VEL 100 NOV 100 ENG 79 POP 68 RAR 52 ORI 12 LON 0 INF —<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo5-ranking-em-barras-led.jpg) |
| 6. Maior e menor atributos (dinâmico) | Ranking do snapshot atual NOV ↑ 100 Sem comparação temporal LON ↓ 0 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo6-maior-e-menor-atributos.jpg) | Ranking do snapshot atual NOV ↑ 100 Sem comparação temporal LON ↓ 0 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo6-maior-e-menor-atributos.jpg) | Ranking do snapshot atual TEN ↑ 100 Sem comparação temporal LON ↓ 0 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo6-maior-e-menor-atributos.jpg) |
| 7. Destaque editorial vivo (dinâmico) | Ranking do snapshot atual Destaque: Novidade 100 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo7-destaque-editorial-vivo.jpg) | Ranking do snapshot atual Destaque: Novidade 100 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo7-destaque-editorial-vivo.jpg) | Ranking do snapshot atual Destaque: Trend 100 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo7-destaque-editorial-vivo.jpg) |
| 8. Três atributos-chave (dinâmico) | NOV 100 ✦✧✦ Maior valor disponível no Hype ENG 56 ✦✧✦ Maior valor disponível no Hype RAR 52 ✦✧✦<br>[imagem](evidencias/selos-hype/h20-look-baixo-estilo8-tres-atributos-chave.jpg) | NOV 100 ✦✧✦ Maior valor disponível no Hype TEN 81 ✦✧✦ Maior valor disponível no Hype VEL 74 ✦✧✦<br>[imagem](evidencias/selos-hype/h21-look-medio-estilo8-tres-atributos-chave.jpg) | TEN 100 ✦✧✦ Maior valor disponível no Hype VEL 100 ✦✧✦ Maior valor disponível no Hype NOV 100 ✦<br>[imagem](evidencias/selos-hype/h22-look-alto-estilo8-tres-atributos-chave.jpg) |

### Peças (página da peça → ⋯ → Editar arte do card)

| Estilo | Peça Zero (sem dados) | Peça Vermelha (Hype 52, Relevante) | Peça Médio (Hype 79, Tendência) |
|---|---|---|---|
| 1. Atributos na horizontal (fixo) | POP — ENG — TEN — VEL — ORI — RAR — LON — NOV —<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo1-atributos-na-horizontal.jpg) | POP 75 ENG 10 TEN 56 VEL 56 ORI 82 RAR 52 LON 0 NOV 100<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo1-atributos-na-horizontal.jpg) | POP 89 ENG 70 TEN 98 VEL 93 ORI 96 RAR 52 LON 0 NOV 100<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo1-atributos-na-horizontal.jpg) |
| 2. Atributos na vertical (fixo) | POP — ENG — TEN — VEL — ORI — RAR — LON — NOV —<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo2-atributos-na-vertical.jpg) | POP 75 ENG 10 TEN 56 VEL 56 ORI 82 RAR 52 LON 0 NOV 100<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo2-atributos-na-vertical.jpg) | POP 89 ENG 70 TEN 98 VEL 93 ORI 96 RAR 52 LON 0 NOV 100<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo2-atributos-na-vertical.jpg) |
| 3. Duas colunas (fixo) | POP — ENG — TEN — VEL — ORI — RAR — LON — NOV —<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo3-duas-colunas.jpg) | POP 75 ENG 10 TEN 56 VEL 56 ORI 82 RAR 52 LON 0 NOV 100<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo3-duas-colunas.jpg) | POP 89 ENG 70 TEN 98 VEL 93 ORI 96 RAR 52 LON 0 NOV 100<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo3-duas-colunas.jpg) |
| 4. Somente Hype Score (fixo) | HYPE SCORE —<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo4-somente-hype-score.jpg) | HYPE SCORE 52<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo4-somente-hype-score.jpg) | HYPE SCORE 79<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo4-somente-hype-score.jpg) |
| 5. Ranking em barras LED (dinâmico) | POP — ENG — TEN — VEL — ORI — RAR — LON — NOV —<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo5-ranking-em-barras-led.jpg) | NOV 100 ORI 82 POP 75 TEN 56 VEL 56 RAR 52 ENG 10 LON 0<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo5-ranking-em-barras-led.jpg) | NOV 100 TEN 98 ORI 96 VEL 93 POP 89 ENG 70 RAR 52 LON 0<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo5-ranking-em-barras-led.jpg) |
| 6. Maior e menor atributos (dinâmico) | Ranking do snapshot atual Atributo ainda não disponível<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo6-maior-e-menor-atributos.jpg) | Ranking do snapshot atual NOV ↑ 100 Sem comparação temporal LON ↓ 0 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo6-maior-e-menor-atributos.jpg) | Ranking do snapshot atual NOV ↑ 100 Sem comparação temporal LON ↓ 0 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo6-maior-e-menor-atributos.jpg) |
| 7. Destaque editorial vivo (dinâmico) | Ranking do snapshot atual Atributo ainda não disponível<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo7-destaque-editorial-vivo.jpg) | Ranking do snapshot atual Destaque: Novidade 100 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo7-destaque-editorial-vivo.jpg) | Ranking do snapshot atual Destaque: Novidade 100 Sem comparação temporal<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo7-destaque-editorial-vivo.jpg) |
| 8. Três atributos-chave (dinâmico) | Atributo ainda não disponível Seleção editorial explicável, sem medir tecido nem criar métricas<br>[imagem](evidencias/selos-hype/h61-peca-zero-estilo8-tres-atributos-chave.jpg) | TEN 56 ✦✧✦ Cor informada na peça NOV 100 ✦✧✦ Maior valor disponível no Hype ORI 82 ✦✧✦ Maior va<br>[imagem](evidencias/selos-hype/h62-peca-vermelha-estilo8-tres-atributos-chave.jpg) | LON 0 ✦✧✦ Associação aos termos da peça TEN 98 ✦✧✦ Cor informada na peça NOV 100 ✦✧✦ Maior valo<br>[imagem](evidencias/selos-hype/h63-peca-medio-estilo8-tres-atributos-chave.jpg) |

Montagem lado a lado de alguns estilos nos três níveis: [imagem](evidencias/selos-hype/h40-montagem-estilos-por-nivel.jpg). Look salvo com o estilo aplicado: [imagem](evidencias/selos-hype/h31-look-alto-salvo-com-aura-hype.jpg).

Conclusão da prova: **os 8 estilos leem o Hype real do card**. Os estilos 1, 2, 3 e 5 mostram as oito ou nove dimensões e mudam de forma visível entre os níveis; o estilo 4 mostra só o número geral e também muda (38, 56, 69; 52, 79; "—" sem dados). Os estilos 6, 7 e 8 só mudam quando muda a dimensão mais alta ou mais baixa: ver defeito 5.

## 6. Defeitos encontrados

1. **Selo de marca concedido na hora a um look sem nenhuma peça da marca (atrapalha).** Passos: entrar como usuário comum; criar e publicar um look com peças sem marca; chamar o pedido de selo para uma marca aprovada (na tela: página do look → "Sugerir selos de marca" e escolher a marca; na API: `POST /api/schemes/{id}/seal-bonds` com `targetOwnerId` da marca). Resultado: vínculo `APPROVED`, base `BRAND_MATCH`, `requiresReview: false`, com o selo padrão da marca. A marca não revisa nada e a fila "Revisão de vínculos" fica vazia, embora a aba Selos diga "você aprova o vínculo". Só as celebridades passam por revisão. Arquivos prováveis: `SealBondService`/`SealPolicies.java` (selo padrão sem regras aceita qualquer look).
2. **A página da peça não mostra o Hype (atrapalha).** Passos: abrir `/pieces/{id}` de uma peça com Hype calculado (ex.: "Jeans Hype Médio", 79). A página mostra "🔥 — Hype ainda não calculado" ([imagem](evidencias/selos-hype/h50-pagina-peca-medio.jpg)), enquanto o mesmo card em `/closet` mostra 79 ([imagem](evidencias/selos-hype/h51-closet-cards-com-hype.jpg)). A página não chega a pedir o resumo de Hype da peça (nenhuma chamada a `/api/hype/summaries?type=PIECE`). Arquivo: `app/(site)/(app)/pieces/[id]/page.tsx` e o card expandido da peça.
3. **Desfazer curtidas e salvos não reduz o Hype (atrapalha).** Passos: cinco contas curtem e três salvam uma peça; recalcular; as mesmas contas desfazem; recalcular. Contadores do card: 0 curtidas, 0 salvos; Hype igual (80,2). A fórmula só lê sinais "criados". Qualquer pessoa pode curtir e descurtir para deixar o ganho. Arquivo: `HypeSignalRecorder.java` / `HypeSignalType.java`.
4. **Faixas baixas do Hype quase não aparecem numa comunidade pequena (detalhe de regra).** Com 3 eventos uma peça já recebe 52 a 65. Popularidade e Engajamento são percentis: com poucos itens públicos, quem tem 2 curtidas fica no topo da régua. A Novidade (100 para tudo que é novo) também empurra para cima.
5. **Três estilos não deixam ver a diferença de Hype (atrapalha).** "Maior e menor atributos" e "Destaque editorial vivo" não mostram o número geral e ficaram idênticos para Hype 38, 56, 52 e 79 (sempre "Novidade 100" e "Longevidade 0", porque todo card novo tem esses extremos). "Três atributos-chave" escolheu "LON 0" como atributo-chave da peça de Hype 79, com a explicação "Associação aos termos da peça". Os estilos dinâmicos mostram "Sem comparação temporal" e não se movem. Arquivos: `lib/hype/aura-hype-presets.ts`, `components/hype/fashion-card-panel.tsx`.
6. **"Atributos na horizontal" corta os números (detalhe).** No card de pré-visualização só cabem POP, ENG, TEN e metade de VEL; os outros ficam escondidos sem indicação de rolagem ([imagem](evidencias/selos-hype/h22-look-alto-estilo1-atributos-na-horizontal.jpg)).
7. **Um look só pode ter um vínculo por emissor (atrapalha).** O "Look Azul Hype Alto" era elegível para a campanha de Hype da marca, mas o pedido respondeu 409 `VINCULO_EXISTENTE` porque já tinha um selo da mesma marca. Não dá para ter o selo comum e o selo de Hype da mesma marca no mesmo look.
8. **Depois de revogado, o identificador do vínculo continua na lista `seals` do look (detalhe).** O medalhão some (`sealBadges` vazio), mas `GET /api/schemes/{id}` ainda devolve o id.
9. **Textos (detalhe).** Na aba Selos aparece "Peca · disponível" (sem cedilha). Na aba Métricas do emissor os rótulos estão em inglês e em maiúsculas: "SUGGESTED, ACCEPTED, APPROVED, PENDING REVIEW, ACTIVE SEALS, REDEMPTIONS, CONVERSION SEAL TO REDEMPTION" ([imagem](evidencias/selos-hype/s24-marca-metricas.jpg)). No criador, o passo 1 continua se chamando "Copilot · Definir selo" mesmo no modo Manual, e o rótulo "Nível do selo" aparece duas vezes.
10. **O criador deixa avançar sem nome (detalhe).** Dá para passar do passo "Dados" sem nome; o bloqueio só aparece no passo "Arte", como dica no botão desligado.
11. **Imagem padrão não acompanha a cor da peça (detalhe visual).** O look com camiseta vermelha mostra uma camiseta azul no card; todas as peças sem foto aparecem azuis.
12. **Marca real numa miniatura (regra de licenciamento).** No seletor de AURA, a miniatura de "AURA Metamorfose" mostra o logotipo "Nike" ([imagem](evidencias/selos-hype/h03-estudio-aura-hype-seletor.jpg)).

## 7. O que não foi possível fazer

- **Selo criado pelo Copilot:** precisa de IA remota paga. Só foi conferido que o app recusa com mensagem clara.
- **Acabamentos Prata, Ouro e Especial do painel:** bloqueados pelo nível da conta (Studio e Loft). Não foi alterado o nível das contas à força.
- **Queda do Hype por passagem do tempo** (Trend e Novidade diminuem com os dias): exigiria mexer em datas no banco, o que não foi feito.
- **Influência (remix):** o endpoint de remix só abre o criador de look com o original como base; nenhum look derivado foi salvo, então a dimensão ficou "—".
- **Criação de selo 100% pela tela até salvar:** o assistente foi percorrido até o passo 3; a gravação foi pelos mesmos endpoints.
- Combinações "Manual · Peça" e "Hype · Look" para celebridade não foram repetidas (o código trata marca e celebridade igual, mudando só o acabamento Premium).
