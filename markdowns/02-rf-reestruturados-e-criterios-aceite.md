# Etapas 3 e 5 — Reestruturação dos Requisitos Funcionais e Critérios de Aceite

> **Fonte:** board Trello *TCC 2026 (Fashion AI)* → lista **Requisitos Funcionais** (30 cards, sendo 1 card de rastreabilidade) e lista **Requisitos Não-Funcionais (RNF)** (8 cards), lidos em 2026-09-07.
> **Norma de referência:** ISO/IEC/IEEE 29148 (requisitos verificáveis, não ambíguos, atômicos) + INVEST para as HU.

---

## 0. Onde os Critérios de Aceite moram — **só no card HU-RF**

**Regra do time, sem exceção:** o texto de um Critério de Aceite vive em **um único lugar**, a checklist "Critérios de Aceite" do card **HU-RFx** no Product Backlog do Trello. O card do RF (lista *Requisitos Funcionais*) descreve o requisito, as dependências, a sprint e as decisões de modelagem — **nunca** carrega o texto dos CA, apenas o link para o HU correspondente.

| Onde | O que fica lá |
|---|---|
| Card **RF**x (lista Requisitos Funcionais) | Enunciado, dependências, sprint, decisões de modelagem, ponteiro para o HU |
| Card **HU-RF**x (lista Product Backlog) | ✅ **Os Critérios de Aceite** + a checklist de Tarefas por área (`[BE]` `[DB]` `[FE]` `[INT]` `[IA]` `[QA]`) |
| Este documento (`02`) | A versão canônica em Gherkin, versionada no git |

**Por que isso importa, e não é burocracia:** CA duplicado em dois cards diverge na primeira edição. Quando duas versões do mesmo critério discordam, ninguém sabe qual vale, e o critério deixa de ser verificável — que é a única função dele. Um dono documental por critério, sempre.

---

## 1. Política de renumeração — **não renumerar**

O time pediu fundir RFs em CAs de outros RFs. Existem duas formas de fazer isso:

| Estratégia | Efeito | Recomendação |
|---|---|---|
| Renumerar (RF24 vira RF3.CA7 e os números seguintes deslizam) | Quebra toda a rastreabilidade já escrita em HUs, diagramas, commits, PDF do TCC e histórico do Trello | ❌ |
| **Absorver mantendo o número morto** — o RF absorvido vira CA do RF hospedeiro e o card antigo é marcado `[ABSORVIDO em RFx]` e arquivado | Rastreabilidade preservada; qualquer documento antigo que cite "RF24" continua resolvível | ✅ **adotada aqui** |

**Regra:** números de RF nunca são reciclados. RFs novos recebem o próximo número livre (a partir de **RF24**).

---

## 2. Mapa de absorção (o que o time pediu)

| RF absorvido | Vira | Justificativa |
|---|---|---|
| **RF27** — Cadastrar/gerenciar perfil de MARCA | **RF1.CA06–CA08** | É o mesmo caso de uso "criar conta", variando apenas o `tipo_de_perfil`. Manter separado gerava dois fluxos de cadastro redundantes. |
| **RF28** — Cadastrar/gerenciar perfil de CELEBRIDADE | **RF1.CA09–CA10** | Idem RF27. |
| **RF24 (antigo)** — Recuperar senha, logout, sessões ativas | **RF3.CA07–CA10** | Ciclo de vida da conta autenticada = gerenciamento de conta. ⚠️ **O número RF24 foi reaproveitado** — ver nota abaixo. |
| **RF25** — Configurações de conta e segurança | **RF3.CA11–CA14** | A "página Configurações" é a *interface* do RF3, não um requisito distinto. |
| **RF26** — Receber e gerenciar notificações | **RF3.CA15–CA18** | Conforme decisão do time. ⚠️ **Ver nota de rastreabilidade abaixo.** |
| **RF29** — Página de Looks Salvos | **RF6.CA09–CA13** | Looks Salvos é uma aba do Perfil Lookbook (RF6), gerada pelo mesmo modelo de interface. |

> ⚠️ **Nota de rastreabilidade sobre o REAPROVEITAMENTO do número RF24.**
>
> A política desta seção é **não renumerar e não reciclar números**: um RF absorvido tem o número aposentado.
> O time abriu **uma exceção explícita** para o RF24. O RF24 original ("Recuperar senha, logout, sessões ativas")
> foi absorvido pelo RF3 (CA07–CA10) e o card antigo está arquivado; o número foi então reatribuído ao novo
> **RF24 — Usar a IA do sistema**, o motor transversal de inteligência artificial descrito em
> [`03-rf24-ia-e-servicos-externos.md`](03-rf24-ia-e-servicos-externos.md).
>
> **Consequência prática, e é a razão desta nota existir:** qualquer documento anterior a esta decisão que cite
> "RF24" está falando de recuperação de senha, **não** de IA. Ao ler material antigo (HUs, atas, versões prévias
> do PDF do TCC, histórico do Trello), resolva "RF24" para **RF3.CA07–CA10**. Deste documento em diante, RF24
> significa exclusivamente o motor de IA. Esta é a única exceção à política; nenhum outro número foi reciclado.

> ⚠️ **Nota de rastreabilidade sobre RF26 (notificações).**
> Colocar notificações dentro de RF3 é correto para a *gestão* (central de notificações, marcar como lida, preferências de canal). Mas o *disparo* das notificações nasce das interações sociais (RF19) e do vínculo por selo (RF20/RF21). Para não perder essa origem, os CAs foram divididos:
> - **RF3.CA15–CA18** → central, leitura, preferências, exclusão (o que o usuário gerencia);
> - **RF19.CA11–CA12** e **RF20.CA08** → "a interação X gera notificação ao autor" (o que dispara).
> Assim o card RF26 pode ser arquivado sem deixar endpoint órfão (`/api/notifications`).

**Ação no Trello:** para cada card absorvido — renomear para `[ABSORVIDO em RFx] RF27 - …`, colar no topo da descrição `➡️ Este RF foi absorvido em RFx (CAyy–CAzz). Card mantido para rastreabilidade.`, remover o label de Sprint e arquivar.

---

## 3. Correções de ambiguidade nos enunciados de RF

Problemas encontrados na redação atual e a reescrita proposta:

| RF | Problema na redação atual | Enunciado corrigido |
|---|---|---|
| RF1 | Só cobria usuário comum, enquanto marca e celebridade tinham RF próprio | **Cadastrar conta na plataforma**, com escolha do tipo de perfil (Pessoal, Marca ou Celebridade) e persistência dos dados de acesso |
| RF3 | "Gerenciar conta e privacidade" — verbo genérico, escopo indefinido | **Gerenciar a conta**: dados pessoais, sessão, segurança, privacidade/LGPD, preferências de notificação e exclusão de conta |
| RF5 | "Criar um esquema de vestimenta & sua respectiva lista de peças" — mistura a criação com a listagem | **Criar um esquema de vestimenta** na aba "Criar Look", compondo-o a partir de peças do guarda-roupa |
| RF6 | Título fala em "Guarda-Roupa Virtual"; as aulas e as pranchas chamam de **Perfil Lookbook** | **Acessar e gerenciar o Perfil Lookbook** (Closet Digital + Looks Salvos) do usuário |
| RF7 | Enunciado de 22 palavras com "o sistema deve permitir que o usuário…" duplicando o cabeçalho da lista | **Acessar o detalhe de uma peça** a partir da lista de peças de um esquema salvo |
| RF9 | "esquema … & seus respectivos esquemas de peça de roupa" — "esquema de peça" não existe no modelo | **Editar os dados de um esquema de vestimenta** e das peças que o compõem |
| RF11 | Não diz se a arte é fundo, moldura ou filtro | **Compor a arte de fundo** (Background Studio) aplicada ao card de um esquema ou de uma peça |
| RF12 | Título de 24 palavras explicando a origem das fotos | **Visualizar e editar a página "Minhas Fotos"** (acervo de fotografias originadas de peças e esquemas) |
| RF19 | Requisito guarda-chuva: mistura reações, comentário, compartilhamento, salvamento e filtros de disponibilidade | Desmembrado em **RF19** (reações e comentários), **RF19.CA07–CA10** (salvar/compartilhar) e **RF31** (filtros favoritar/disponível/indisponível/todos) — ver §5 |
| RF20/RF21 | Dois RFs quase idênticos (marca vs. celebridade) | Mantidos separados por decisão do time, mas com **CAs espelhados**: o que muda é só a entidade-alvo (`Brand` \| `Celebrity`) |
| RF23 | "Preferências de interface e usabilidade" — não deixava claro que também cobre alteração de dados **não sensíveis** | **Gerenciar preferências de interface e dados não sensíveis do perfil** (tema, idioma, densidade, acessibilidade, bio, avatar, @) |

---

## 4. Catálogo de Critérios de Aceite (formato Gherkin compacto)

Convenção: `RFx.CAnn`. Todo CA é **verificável** (tem um observável), **atômico** (um comportamento) e **livre de solução técnica** no enunciado.

### RF1 — Cadastrar conta na plataforma *(absorve RF27, RF28)*

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF1.CA01 | visitante na tela de cadastro | informa e-mail, senha e aceita os termos | conta é criada com perfil **Pessoal** e o usuário é levado ao onboarding |
| RF1.CA02 | visitante informa e-mail já cadastrado | submete o formulário | sistema recusa com mensagem específica de e-mail em uso, sem revelar outros dados da conta existente |
| RF1.CA03 | visitante informa senha fora da política (mín. 8, 1 maiúscula, 1 dígito) | submete o formulário | sistema bloqueia o envio e indica qual regra falhou |
| RF1.CA04 | conta recém-criada | o cadastro é concluído | senha é persistida apenas como hash+salt (**RNF3**) e nenhum campo de senha aparece em log (**RNF5**) |
| RF1.CA05 | visitante não confirmou o e-mail | tenta autenticar | acesso é permitido em modo limitado e o app exibe aviso persistente de confirmação pendente |
| RF1.CA06 | visitante escolhe o tipo de perfil **Marca** | informa razão social, CNPJ, nome de exibição e logotipo | conta empresarial é criada com status `pendente_validação` e não aparece ainda no feed da aba "Marcas" (RF14) |
| RF1.CA07 | conta Marca em `pendente_validação` | administrador aprova o cadastro | status passa a `validada`, a marca passa a listar no feed RF14 e torna-se elegível a receber vínculos (RF20) |
| RF1.CA08 | administrador de uma Marca validada | edita dados do perfil empresarial (bio, site, logo, catálogo) | alterações são persistidas e refletidas no feed RF14 em até um ciclo de cache |
| RF1.CA09 | visitante escolhe o tipo de perfil **Celebridade** | informa nome artístico, documento de comprovação e foto oficial | conta é criada com status `pendente_validação`, sujeita ao mesmo fluxo de aprovação da Marca |
| RF1.CA10 | perfil Celebridade validado | acessa a própria página | vê o feed dos esquemas que lhe foram vinculados (RF21) e pode aprovar ou recusar cada vínculo |

### RF2 — Autenticar usuário

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF2.CA01 | usuário com conta ativa | informa credenciais válidas | sessão é aberta com token de acesso e token de renovação (**RNF2**) |
| RF2.CA02 | usuário informa credenciais inválidas | submete o login | sistema responde com mensagem genérica ("credenciais inválidas"), sem indicar se o erro foi no e-mail ou na senha |
| RF2.CA03 | usuário erra a senha 5 vezes em 15 min | tenta novamente | acesso é bloqueado temporariamente e o evento é registrado na auditoria (**RNF5**) |
| RF2.CA04 | token de acesso expirado e token de renovação válido | app faz uma requisição autenticada | sessão é renovada de forma transparente, sem novo login |
| RF2.CA05 | conta com tipo de perfil Marca ou Celebridade | autentica | é direcionada ao painel do respectivo perfil, não ao Lookbook pessoal |

### RF3 — Gerenciar a conta *(absorve RF24, RF25, RF26)*

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF3.CA01 | usuário autenticado na página de dados pessoais | altera um dado **sensível** (e-mail, CPF, data de nascimento) | sistema exige reautenticação por senha antes de persistir |
| RF3.CA02 | usuário alterou o e-mail | confirma a alteração | novo e-mail entra em `pendente_confirmação` e o e-mail antigo recebe aviso de segurança |
| RF3.CA03 | usuário autenticado | acessa "Privacidade" | vê, em linguagem clara, quais dados são coletados, para qual finalidade e por quanto tempo (**RNF6 / LGPD art. 9º**) |
| RF3.CA04 | usuário quer exercer o direito de portabilidade | solicita exportação dos dados | sistema gera arquivo com perfil, guarda-roupa, esquemas e DNA de Estilo e o disponibiliza por link expirável (**LGPD art. 18, V**) |
| RF3.CA05 | usuário solicita exclusão da conta | confirma em duas etapas | conta entra em carência de 30 dias, fica invisível na rede social e é eliminada em definitivo ao fim do prazo (**LGPD art. 18, VI**) |
| RF3.CA06 | usuário revoga um consentimento opcional (ex.: uso de fotos para treino de modelo) | salva | o tratamento correspondente cessa e a revogação é registrada com data/hora (**RNF5**) |
| RF3.CA07 | usuário esqueceu a senha | solicita recuperação informando o e-mail | sistema envia link de redefinição válido por 30 min e responde a mesma mensagem, exista ou não a conta |
| RF3.CA08 | link de redefinição já usado ou expirado | é acessado | sistema recusa e oferece novo envio |
| RF3.CA09 | usuário autenticado | aciona "Sair" | sessão atual é encerrada e o token de renovação é invalidado no servidor |
| RF3.CA10 | usuário com várias sessões ativas | acessa "Sessões ativas" | vê dispositivo, local aproximado e último acesso de cada uma e pode encerrar qualquer sessão individualmente ou todas |
| RF3.CA11 | usuário na página Configurações | troca a senha informando a atual | senha é atualizada e **todas** as demais sessões são encerradas |
| RF3.CA12 | usuário ajusta a visibilidade do perfil (público / somente seguidores / privado) | salva | a regra passa a valer imediatamente para o feed (RF8) e para o perfil público (RF17) |
| RF3.CA13 | usuário define a visibilidade de um esquema individual | salva | a regra do esquema prevalece sobre a regra geral do perfil quando for mais restritiva |
| RF3.CA14 | usuário tenta acessar dados de conta de outro usuário via URL direta | a requisição chega ao servidor | sistema responde 403 e registra a tentativa (**RNF1 / RNF5**) |
| RF3.CA15 | usuário recebeu interações desde o último acesso | abre a central de notificações | vê a lista ordenada da mais recente para a mais antiga, com marcação visual de não lidas |
| RF3.CA16 | usuário com notificações não lidas | aciona "marcar todas como lidas" | contador zera e o estado persiste entre dispositivos |
| RF3.CA17 | usuário nas preferências de notificação | desativa um tipo (ex.: curtidas) | deixa de receber esse tipo em qualquer canal, mantendo os demais |
| RF3.CA18 | notificação com mais de 90 dias | o expurgo periódico executa | a notificação é removida sem afetar o conteúdo que a originou |
| RF3.CA19 | uma conta é criada | o cadastro conclui | ela nasce no estado **mais protetivo**: perfil privado, e todos os consentimentos opcionais **desligados** — o usuário opta por abrir (*Privacy by Default*) |
| RF3.CA20 | a tela de "Uso dos seus dados" | é renderizada | há **um controle por finalidade** (anúncios, reconhecimento facial, histórico de localização, compartilhamento com parceiros), nunca um "aceito tudo" agrupado |
| RF3.CA21 | um consentimento foi concedido | o usuário quer revogá-lo | a revogação está **no mesmo lugar e com o mesmo número de cliques** da concessão (LGPD art. 8º, §5º) |
| RF3.CA22 | qualquer controle de consentimento | é exibido pela primeira vez | ele **não** vem pré-marcado — o aceite exige ação afirmativa do usuário |
| RF3.CA23 | o campo data de nascimento | é apresentado | a tela declara que ele é coletado **apenas para verificação de idade mínima** (princípio da necessidade, LGPD art. 6º, III) |
| RF3.CA24 | usuário aciona "Baixar seus dados" | confirma | o arquivo sai em formato **legível por máquina** (JSON), não em PDF ou imagem (LGPD art. 18, V) |

#### Mapa direito do titular → controle na tela *(fonte: material de padrões de interface LGPD, anexo do RNF6)*

Cada linha é um direito do art. 18 e o componente concreto que o realiza. Serve de checklist para o artefato #6 e para a implementação.

| Direito do titular | Artigo | Componente de UI | CA |
|---|---|---|---|
| Confirmação e acesso | art. 18, I e II | Página "Meus dados" | RF3.CA03 |
| Correção | art. 18, III | Inputs editáveis (nome, e-mail, bio, nascimento) + Salvar | RF3.CA01 |
| Anonimização / bloqueio de dados excessivos | art. 18, IV | Toggles que desativam coletas; ocultar campos | RF3.CA06, RF13.CA06 |
| Portabilidade | art. 18, V | "Exportar dados" em JSON | RF3.CA04, RF3.CA24 |
| Eliminação | art. 18, VI | "Excluir conta" em zona de risco, confirmação dupla | RF3.CA05 |
| Informação sobre compartilhamento | art. 18, VII | Painel "Quem pode ver" (radio, padrão restritivo) | RF3.CA12, RF3.CA19 |
| Revogação do consentimento | art. 18, IX | Toggles desligáveis a qualquer momento | RF3.CA06, RF3.CA21 |

#### Anti-padrões que reprovam a tela *(mesma fonte)*

São **critérios de rejeição** do artefato #6 — se algum aparecer, a tela volta:

| Dark pattern | Por que reprova | CA que o proíbe |
|---|---|---|
| Checkbox pré-marcado | Consentimento sem ação afirmativa | RF3.CA22 |
| Consentimento agrupado | A LGPD exige granularidade por finalidade | RF3.CA20 |
| Revogação escondida | Conceder em 1 clique, revogar em 6 — fere o art. 8º, §5º | RF3.CA21 |
| Padrão invasivo | Perfil público e coletas ligados por padrão | RF3.CA19 |

> **Confirmação da separação RF3 × RF23.** O material do RNF6 é explícito: modo escuro, tamanho de fonte e idioma são **preferências de interface** — requisito funcional de usabilidade, **não** tratamento de dado pessoal. Isso valida a divisão feita na §3: dado que identifica a pessoa → RF3 (reautenticação, base legal, relatório LGPD); preferência de uso e dado de vitrine → RF23.

### RF4 — Adicionar peça ao guarda-roupa

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF4.CA01 | usuário autenticado na aba "Adicionar nova peça" | envia uma fotografia | sistema aceita JPG/PNG/WebP até 10 MB e rejeita os demais formatos com mensagem clara |
| RF4.CA02 | fotografia enviada | o upload conclui | a IA de detecção (**RF24.CA01**) pré-preenche categoria, cor dominante e tipo de tecido, deixando todos os campos editáveis |
| RF4.CA03 | a IA não reconhece a peça com confiança suficiente | a detecção retorna | formulário é apresentado vazio com aviso de preenchimento manual, sem bloquear o cadastro (**RNF8**) |
| RF4.CA04 | usuário preencheu os campos obrigatórios (nome, categoria, cor) | salva | peça é persistida e aparece imediatamente no Closet Digital (RF6) |
| RF4.CA05 | usuário envia várias fotografias de uma vez | conclui o envio | sistema cria um rascunho por foto e permite revisar cada um antes de confirmar o lote |
| RF4.CA06 | serviço de remoção de fundo indisponível | usuário salva a peça | a peça é salva com a foto original e um job de reprocessamento fica pendente (**RNF8**) |

### RF5 — Criar esquema de vestimenta (aba "Criar Look")

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF5.CA01 | usuário com ao menos 2 peças cadastradas | abre a aba "Criar Look" | vê o Closet Digital filtrável por categoria e um espaço de composição vazio |
| RF5.CA02 | usuário com menos de 2 peças | abre a aba "Criar Look" | sistema orienta o cadastro de peças (RF4) e não apresenta o compositor vazio sem explicação |
| RF5.CA03 | usuário arrastou peças para a composição | informa nome e ocasião e salva | esquema é criado com a lista de peças, visibilidade padrão herdada do perfil (RF3.CA12) |
| RF5.CA04 | usuário aciona "gerar com IA" | confirma ocasião e humor | sistema apresenta 3 composições distintas usando apenas peças do guarda-roupa do usuário (**RF24.CA02**) |
| RF5.CA05 | esquema salvo | usuário publica no feed | esquema passa a aparecer na aba "Buscar" (RF8) respeitando a visibilidade escolhida |
| RF5.CA06 | usuário tenta salvar sem nenhuma peça | aciona salvar | sistema recusa e indica o mínimo de 1 peça |

### RF6 — Perfil Lookbook: Closet Digital e Looks Salvos *(absorve RF29)*

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF6.CA01 | usuário autenticado | acessa o Perfil Lookbook | vê duas abas — **Closet Digital** (peças) e **Looks Salvos** (esquemas) — e os contadores de cada uma |
| RF6.CA02 | Closet Digital com peças | usuário aplica filtro por categoria, cor ou estação | a grade é filtrada sem recarregar a página |
| RF6.CA03 | usuário sem nenhuma peça | acessa o Closet Digital | vê estado vazio com chamada para "Adicionar nova peça" (RF4) |
| RF6.CA04 | usuário seleciona uma peça | aciona editar | é levado ao formulário da peça com os dados atuais carregados (RF9) |
| RF6.CA05 | usuário exclui uma peça usada em esquemas | confirma a exclusão | sistema avisa quantos esquemas serão afetados e mantém o histórico daqueles já publicados |
| RF6.CA06 | Closet Digital com mais de 30 peças | o usuário rola a lista | o carregamento é paginado e a tela principal responde em até 3 s (**RNF7**) |
| RF6.CA07 | usuário marca uma peça como **indisponível** | salva | a peça deixa de ser oferecida na criação de looks (RF5) e no Copilot (RF10), mas permanece no acervo |
| RF6.CA08 | usuário acessa o Lookbook de outro perfil público | a página carrega | vê apenas os itens cuja visibilidade permite (RF3.CA12/CA13) |
| RF6.CA09 | usuário na aba **Looks Salvos** | a página carrega | vê o feed compacto dos esquemas próprios e dos salvos de terceiros, com origem identificada |
| RF6.CA10 | aba Looks Salvos | usuário usa o filtro de ocasião no header | o feed passa a exibir só os esquemas daquela ocasião, mantendo o filtro ao voltar da página de detalhe |
| RF6.CA11 | card do feed compacto | é renderizado | exibe, no **topo**, os toggles de estado — ⭐ favoritar (estrelinha pequena), disponível e indisponível (RF31) — e, no **rodapé**, o footer social do RF19 |
| RF6.CA12 | usuário favorita um look salvo | aciona o ícone | o estado é persistido e refletido em todas as telas que exibem aquele card |
| RF6.CA13 | usuário remove um look salvo de terceiro | confirma | o look sai da sua lista sem afetar o conteúdo original do autor |
| RF6.CA14 | usuário abre um Perfil Lookbook do tipo **celebridade** (Rihanna, Madonna, Beyoncé, Lady Gaga, Ariana Grande, Taylor Swift) e seleciona uma **era nomeada** (Renaissance, Chromatica, Folklore, Blond Ambition) | o sistema monta o prompt enviado ao serviço de geração de imagem (pranchas 11–13, Coleção F) | o prompt descreve **exclusivamente a atmosfera cromática e material da era** — paleta, textura, tecido, acabamento, luz, referência de styling — e **não contém** o nome da pessoa real, descrição facial, descrição corporal nem silhueta identificável; qualquer prompt que viole a regra é rejeitado **antes do envio** e a rejeição é registrada conforme RF24.CA16 |

> **Justificativa da RF6.CA14 (a banca vai perguntar).** A restrição não decorre apenas da política de uso do Adobe Firefly. Um retrato gerado de pessoa real, dentro de um produto que a vincula comercialmente a um look, é problema de **direito de imagem**. O nome da celebridade e o nome da era permanecem como rótulo textual de curadoria; a imagem gerada é sempre **atmosfera**, nunca a pessoa.

### RF7 — Acessar peça a partir da lista de um esquema

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF7.CA01 | usuário visualiza um esquema salvo | aciona uma peça da lista | é levado ao detalhe da peça, mantendo o contexto do esquema de origem para o botão "voltar" |
| RF7.CA02 | peça pertence a outro usuário | usuário abre o detalhe | vê os dados públicos e os controles sociais (RF19), sem acesso a edição |
| RF7.CA03 | peça foi excluída pelo autor após a publicação do esquema | usuário aciona a peça | sistema exibe o snapshot da peça no momento da publicação, marcado como "peça não mais disponível" |

### RF8 — Buscar / Explorar

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF8.CA01 | usuário autenticado | abre a aba "Buscar" | vê o feed comunitário de esquemas e peças públicas, ordenado por relevância e recência |
| RF8.CA02 | usuário digita um termo | submete a busca | resultados são segmentados em abas **Looks**, **Peças**, **Pessoas**, **Marcas** e **Celebridades** |
| RF8.CA03 | usuário aplica filtros (estilo, ocasião, cor, marca) | confirma | os filtros são combináveis e ficam visíveis como chips removíveis |
| RF8.CA04 | busca sem resultados | a consulta retorna vazia | sistema sugere termos alternativos e conteúdos em alta, nunca uma tela em branco |
| RF8.CA05 | conteúdo com visibilidade privada ou de perfil bloqueado | a busca é executada | esse conteúdo nunca aparece nos resultados (**RNF1**) |
| RF8.CA06 | usuário rola o feed | atinge o fim da página | novos itens carregam por cursor, sem duplicar itens já vistos |

### RF9 — Editar esquema de vestimenta e suas peças

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF9.CA01 | usuário autor do esquema | abre "Editar esquema" | vê nome, ocasião, descrição, visibilidade, arte de fundo e a lista de peças, todos com os valores atuais |
| RF9.CA02 | usuário remove uma peça da lista | salva | o esquema é atualizado e a peça continua existindo no Closet Digital |
| RF9.CA03 | usuário adiciona uma peça | salva | a peça é anexada ao esquema e a data de atualização é registrada |
| RF9.CA04 | usuário não é o autor | tenta acessar a edição por URL direta | sistema responde 403 e registra a tentativa (**RNF1/RNF5**) |
| RF9.CA05 | esquema já publicado e vinculado a uma marca (RF20) | usuário edita a lista de peças | o vínculo passa a `revalidação_pendente` e a marca é notificada |
| RF9.CA06 | usuário abandona a edição com alterações não salvas | tenta sair | sistema pede confirmação antes de descartar |
| RF9.CA07 | usuário edita os dados de uma peça a partir do esquema | salva | a alteração vale para a peça no acervo e para todos os esquemas que a referenciam a partir dali |

### RF10 — Copilot (recomendações por IA)

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF10.CA01 | usuário com ao menos 3 peças | abre a aba Copilot | vê o campo de contexto (ocasião, humor, clima) já pré-preenchido com o que o sistema conhece |
| RF10.CA02 | usuário solicita sugestão | a IA responde | sistema apresenta 3 looks distintos, cada um com justificativa curta em linguagem natural (**RF24.CA03**) |
| RF10.CA03 | usuário rejeita todas as sugestões | aciona "gerar outras" | as 3 novas sugestões não repetem nenhuma composição da rodada anterior |
| RF10.CA04 | guarda-roupa insuficiente (<3 peças) | usuário solicita sugestão | sistema explica a limitação e leva ao cadastro de peças (RF4) |
| RF10.CA05 | serviço de IA indisponível ou acima do limite de uso | usuário solicita sugestão | sistema informa a indisponibilidade e oferece recomendações por regras locais, sem travar a interface (**RNF8**) |
| RF10.CA06 | usuário aceita uma sugestão | confirma | o esquema é salvo como look do dia, com a origem "Copilot" registrada |
| RF10.CA07 | Copilot sugere uma **peça** que o usuário não possui | a sugestão é exibida | o card é marcado como "sugestão externa" e não pode ser adicionado ao guarda-roupa sem cadastro (RF4) |

### RF11 — Background Studio

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF11.CA01 | usuário editando um card de esquema ou peça | abre o Background Studio | vê a galeria de fundos por categoria e a pré-visualização em tempo real sobre o card |
| RF11.CA02 | usuário escolhe um fundo | aplica | o card é salvo com o fundo e mantém a legibilidade do texto sobreposto em ambos os temas |
| RF11.CA03 | usuário gera um fundo por IA descrevendo um cenário | confirma | sistema entrega a arte gerada em até 30 s ou informa o andamento (**RF24.CA07**) |
| RF11.CA04 | usuário envia a própria imagem de fundo | aplica | sistema valida formato e proporção e recorta para o formato do card |
| RF11.CA05 | usuário remove o fundo aplicado | salva | o card volta ao fundo padrão sem perder os demais dados |

### RF12 — Minhas Fotos

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF12.CA01 | usuário autenticado | acessa "Minhas Fotos" | vê todas as fotografias enviadas, agrupadas por origem (peça, esquema, provador, DNA) e ordenadas por data |
| RF12.CA02 | usuário seleciona uma foto | aciona editar | abre o Editor Canvas 2D (RF15) com a foto carregada |
| RF12.CA03 | usuário exclui uma foto vinculada a uma peça ativa | confirma | sistema avisa que a peça ficará sem imagem e exige confirmação explícita |
| RF12.CA04 | usuário seleciona várias fotos | aciona exclusão em lote | sistema pede uma única confirmação informando a quantidade |
| RF12.CA05 | usuário faz download de uma foto | aciona baixar | a imagem original é entregue sem marca d'água, apenas ao próprio dono |
| RF12.CA06 | acervo com mais de 50 fotos | a página carrega | as imagens carregam sob demanda (lazy) e a tela responde em até 3 s (**RNF7**) |

### RF13 — DNA de Estilo

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF13.CA01 | usuário com ≥10 peças e ≥5 avaliações positivas | acessa "DNA de Estilo" pela primeira vez | sistema apresenta o formulário de Identidade de Vida (lugares, pessoas, animais, objetos) |
| RF13.CA02 | pré-requisitos não atingidos | usuário acessa a página | sistema exibe o progresso indicando exatamente quantas peças e avaliações faltam |
| RF13.CA03 | usuário pula o formulário de vida | confirma a geração | card é gerado só com a Camada 1 (arquétipo, paleta, silhueta, ousadia, peça ícone), **com a Frase de Identidade baseada somente no estilo**, e avisa que pode ser enriquecido depois — conforme HU20, Critério 2 |
| RF13.CA04 | usuário preenche as duas camadas | confirma | IA gera a Frase de Identidade cruzando estilo e vida e renderiza o Card Visual (**RF24.CA04**) |
| RF13.CA05 | usuário edita campos da Identidade de Vida | salva | somente a Frase de Identidade é regenerada; a Camada 1 permanece intacta |
| RF13.CA06 | usuário marca um campo da Camada 2 como privado | exporta o card | o campo não aparece na imagem exportada, mesmo tendo influenciado a frase |
| RF13.CA07 | usuário acumula 10 novas interações relevantes | acessa o DNA | Camada 1 é recalculada e o usuário é notificado de que sua identidade evoluiu |
| RF13.CA08 | dados de Identidade de Vida | são persistidos | ficam cifrados em repouso e nunca trafegam no payload de geração da imagem (**RNF3/RNF6**) |
| RF13.CA09 | usuário compartilha o card | aciona compartilhar | sistema gera PNG com marca d'água e permite exportar para rede externa |

### RF14 — Aba "Marcas" (feed de perfis)

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF14.CA01 | usuário autenticado | abre a aba "Marcas" | vê o feed de marcas **validadas** (RF1.CA07), com logo, nome, nº de vínculos e nº de seguidores |
| RF14.CA02 | usuário busca por nome de marca | submete | resultados filtram por correspondência parcial no nome de exibição |
| RF14.CA03 | usuário aciona uma marca | abre o perfil | vê bio, catálogo e os esquemas vinculados **aprovados** (RF20) |
| RF14.CA04 | marca sem esquemas vinculados | o perfil é aberto | exibe estado vazio convidando o usuário a criar um look vinculado |
| RF14.CA05 | usuário segue uma marca | aciona seguir | passa a receber no feed (RF8) os esquemas vinculados àquela marca |

### RF15 — Editor Canvas Interativo 2D

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF15.CA01 | usuário com uma foto de peça | abre o editor | dispõe de recorte, rotação, brilho/contraste, remoção de fundo e desfazer/refazer |
| RF15.CA02 | usuário aplica edições | salva | a imagem editada substitui a exibida na peça e a original é preservada em "Minhas Fotos" |
| RF15.CA03 | usuário aciona desfazer | repetidamente | o histórico retrocede até o estado original sem perder a sessão de edição |
| RF15.CA04 | serviço de remoção de fundo falha | usuário aciona a função | sistema informa a falha e mantém as demais ferramentas operantes (**RNF8**) |
| RF15.CA05 | usuário sai sem salvar | confirma a saída | as edições são descartadas e a imagem original permanece íntegra |

### RF16 — Geração 3D das peças *(stretch goal)*

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF16.CA01 | peça com fotografia válida | usuário solicita a geração 3D | um job é criado com estado visível (`enfileirado → processando → concluído → falhou`) |
| RF16.CA02 | job concluído | usuário abre a peça | o modelo 3D é exibido com rotação e zoom, mantendo a versão 2D como alternativa |
| RF16.CA03 | job falha ou excede o tempo limite | o estado é atualizado | usuário é informado com motivo legível e pode reprocessar uma vez sem custo (**RNF8**) |
| RF16.CA04 | usuário fecha o app durante o processamento | reabre depois | o estado do job é recuperado do servidor, não perdido |

### RF17 — Visualizar perfil de outros usuários

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF17.CA01 | usuário autenticado | acessa o perfil público de outro usuário | vê avatar, @, bio, contadores de seguidores/seguindo e a grade de publicações |
| RF17.CA02 | perfil com visibilidade "somente seguidores" e o visitante não segue | a página carrega | sistema exibe o cabeçalho e oculta as publicações, com convite para seguir |
| RF17.CA03 | usuário aciona "seguir" | confirma | o vínculo é criado, os contadores de ambos são atualizados atomicamente e o autor é notificado (RF3.CA15) |
| RF17.CA04 | usuário já seguidor | aciona "deixar de seguir" | vínculo é removido e os contadores são decrementados; nenhuma notificação é enviada |
| RF17.CA05 | usuário aciona uma publicação do perfil | abre o detalhe | vê o esquema com os controles sociais (RF19) conforme sua permissão |
| RF17.CA06 | perfil pertence a Marca ou Celebridade | é aberto | é renderizado o layout de perfil institucional (RF14/RF22), não o de usuário pessoal |

### RF18 — Provador 2D virtual

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF18.CA01 | usuário autenticado com ≥1 peça | abre o Provador 2D | escolhe o manequim **masculino** ou **feminino** e a escolha é lembrada na próxima sessão |
| RF18.CA02 | manequim selecionado | usuário arrasta uma peça | a peça é sobreposta na camada correta (base → intermediária → externa → acessório), sem ordem inconsistente |
| RF18.CA03 | usuário tenta vestir duas peças da mesma camada | executa a ação | a segunda substitui a primeira e o sistema informa a troca |
| RF18.CA04 | composição montada no provador | usuário aciona salvar | um esquema é criado a partir da composição (RF5), com origem "Provador" |
| RF18.CA05 | peça sem imagem com fundo removido | é levada ao provador | sistema aplica remoção de fundo sob demanda ou avisa que a sobreposição ficará aproximada (**RNF8**) |
| RF18.CA06 | usuário ajusta o tom de pele ou o porte do manequim | confirma | a preferência é salva no perfil (RF23) e aplicada às próximas sessões |
| RF18.CA07 | usuário aciona limpar | confirma | todas as peças são removidas do manequim sem afetar o guarda-roupa |

### RF19 — Interações sociais: reagir, comentar, salvar, compartilhar

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF19.CA01 | usuário autenticado vendo um esquema público de terceiro | aciona **curtir** | o contador incrementa em uma unidade e o estado do botão reflete a ação imediatamente |
| RF19.CA02 | usuário já curtiu | aciona novamente | a curtida é removida e o contador decrementa; nunca há curtida dupla do mesmo usuário |
| RF19.CA03 | usuário vê um esquema | aplica uma das reações qualitativas **trend / elegante / criativo** | a reação é registrada de forma independente da curtida, com contador próprio |
| RF19.CA04 | usuário escreve um comentário | envia | o comentário aparece na lista com autor, texto e horário, e o autor do conteúdo é notificado |
| RF19.CA05 | autor do conteúdo ou autor do comentário | aciona excluir comentário | o comentário é removido; nenhum outro usuário tem essa permissão (**RNF1**) |
| RF19.CA06 | comentário vazio ou acima do limite de caracteres | é enviado | sistema recusa com mensagem específica |
| RF19.CA07 | usuário aciona **salvar** um esquema de terceiro | confirma | o esquema aparece na aba Looks Salvos (RF6.CA09) identificado com o autor original |
| RF19.CA08 | usuário aciona **compartilhar** | escolhe "feed interno" | uma publicação é criada na sua timeline referenciando o conteúdo original |
| RF19.CA09 | usuário aciona **compartilhar** | escolhe "rede externa" | sistema gera uma imagem exportável do card e devolve o link/arquivo |
| RF19.CA10 | as mesmas interações | são aplicadas a uma **peça** acessada via lista de um esquema (RF7) | comportam-se exatamente como no esquema, com contadores próprios da peça |
| RF19.CA11 | uma curtida, reação ou comentário é registrado | a transação conclui | uma notificação é enfileirada para o autor do conteúdo (consumida em RF3.CA15) |
| RF19.CA12 | autor desativou o tipo de notificação (RF3.CA17) | a interação ocorre | a interação é contabilizada, mas nenhuma notificação é entregue |

### RF20 / RF21 — Vínculo de esquema com marca e celebridade (selos e promoções)

> ⚠️ **Correção.** A primeira versão deste catálogo escreveu 8 CAs genéricos para RF20 e 9 para RF21, com um fluxo "usuário escolhe a marca numa lista → marca aprova". **Esse fluxo está errado.** O repositório já tem a especificação autoritativa desses dois requisitos em **[`docs/rf20-rf21-vinculo-marca-celebridade.md`](../rf20-rf21-vinculo-marca-celebridade.md)** (mesclada no PR #555), com **23 CAs**, fluxo de atividades, modelo de dados, endpoints e rastreabilidade. Ela não foi consultada na primeira redação. Os CAs antigos foram removidos daqui.

**Regra de manutenção:** RF20 e RF21 têm **um único dono documental** — o arquivo acima. Este catálogo não os duplica, para não abrir uma segunda fonte da verdade que sai de sincronia. O que segue é só o resumo e o *delta* que as pranchas acrescentaram.

#### O mecanismo real, em uma frase

Criar Look → **a IA analisa as peças e sugere o vínculo** (até 3 candidatos, com confiança e justificativa) → o usuário **aceita, edita ou recusa** → vínculo criado como `pendente` → **auto-aprovado se o perfil não exigir revisão**, senão vai à fila da marca/celebridade → selo emitido → **o selo habilita as promoções** publicadas no perfil (desconto em e-commerce, cupom de loja, show, evento).

O que a redação anterior errou: a IA sugere *dentro do fluxo de criação* (não é escolha manual numa lista), a revisão da marca é **opcional** (não obrigatória), e o selo **habilita promoções resgatáveis** — o que não existia nos meus CAs.

| CA | Assunto | CA | Assunto |
|---|---|---|---|
| CA01 | Sugestão da IA na criação do look | CA09 | Selo único por par esquema/marca |
| CA02 | Aceite da sugestão | CA10 | Múltiplos selos no mesmo esquema |
| CA03 | Edição da sugestão | CA11 | Promoção habilitada pelo selo |
| CA04 | Recusa (registrada para aprendizado) | CA12 | Resgate com código único |
| CA05 | Nenhum candidato com confiança suficiente | CA13 | Promoção indisponível |
| CA06 | Marca não cadastrada | CA14 | Revogação e expiração do selo |
| CA07 | Revisão pelo perfil (quando exigida) | CA15 | Visibilidade e privacidade |
| CA08 | Emissão do selo | CA16 | Rastreabilidade e auditoria |

**RF21** herda CA01–CA16 trocando "marca" por "celebridade verificada", e acrescenta CA17–CA23: base da sugestão pela assinatura de estilo, **somente celebridades verificadas**, **consentimento e direito de imagem**, Selo Premium, promoções de celebridade, promoção com marca parceira e limite de emissão por campanha.

#### Delta que as pranchas acrescentam *(fonte: artefato "Vinte pranchas", insumo recebido)*

Estes três pontos **não estão** no documento autoritativo e precisam entrar nele — não aqui:

| # | O que falta no documento de RF20/RF21 | Onde impacta |
|---|---|---|
| 1 | **Dois tiers de selo.** `tier PEÇA` (1 peça vinculada) e `tier LOOK` (várias peças ou o look inteiro da mesma marca). CA08 fala em "um selo", sem tier. | Modelo de dados (`Seal.tier`), card do esquema, pranchas 06/07 e 10/11 |
| 2 | **Aba "Meus Selos" guarda os selos recusados** para aplicação manual posterior. CA04 hoje só registra a recusa "para aprendizado". | RF20.CA04, tela de Meus Selos |
| 3 | **Distinção visual categórica** entre os dois tipos: selo de marca é têxtil/dourado, selo de celebridade é vítreo/holográfico. | Artefato #7 e pranchas da Coleção E |

**Ação:** abrir os três como comentário no card RF20 do Trello e atualizar `docs/rf20-rf21-vinculo-marca-celebridade.md` — este catálogo continua apenas apontando para lá.

### RF23 — Preferências de interface e dados não sensíveis

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF23.CA01 | usuário autenticado | acessa "Preferências" | pode alterar tema (claro/escuro/sistema), idioma, densidade da grade e tamanho de fonte |
| RF23.CA02 | usuário altera uma preferência | salva | a mudança é aplicada imediatamente e persiste entre dispositivos |
| RF23.CA03 | usuário altera um dado **não sensível** (nome de exibição, @, bio, avatar, foto de capa) | salva | a alteração é persistida **sem** exigir reautenticação (diferente de RF3.CA01) |
| RF23.CA04 | usuário escolhe um @ já em uso | salva | sistema recusa e sugere alternativas disponíveis |
| RF23.CA05 | usuário ativa o modo de alto contraste ou reduz animações | salva | a interface respeita a preferência em todas as telas |
| RF23.CA06 | usuário navega pelo teclado | percorre a tela | todos os controles interativos são alcançáveis e têm foco visível (**RNF7**) |
| RF23.CA07 | as 20 pranchas de tela (Etapa 6) | são implementadas | cada prancha é rastreada por um item de checklist neste RF (ver `04-telas-artefatos-e-pranchas.md`) |

### RF31 — Filtros de estado do acervo: favoritar / disponível / indisponível / todos *(novo — desmembrado de RF19)*

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF31.CA01 | usuário vê um card de esquema ou peça no seu acervo | aciona **favoritar** | o item é marcado como favorito e o estado é refletido em todas as telas que exibem aquele card |
| RF31.CA02 | usuário marca um item como **indisponível** | confirma | o item deixa de ser oferecido na criação de looks (RF5) e no Copilot (RF10), permanecendo visível no acervo com marcação própria |
| RF31.CA03 | usuário marca um item como **disponível** | confirma | o item volta a ser elegível para composição |
| RF31.CA04 | usuário aciona o filtro **todos**, no header da lista (não no card) | confirma | a lista exibe favoritos, disponíveis e indisponíveis sem distinção |
| RF31.CA05 | um filtro está ativo | usuário navega para o detalhe e volta | o filtro permanece aplicado |
| RF31.CA06 | os toggles | são renderizados na **faixa superior** do card | *favoritar* é um sinalizador independente; *disponível* e *indisponível* são exclusivos entre si e nunca coexistem |
| RF31.CA07 | a faixa de toggles | é desenhada | ⭐ favoritar é uma **estrelinha pequena** no padrão Spotify; *indisponível* é **compacto, só a letra** — o card não pode gastar altura com rótulos longos |

> **Onde cada coisa mora no card** (Parte 3 da modelagem UML + correção do time):
> **topo** → toggles de estado do RF31 (favoritar · disponível · indisponível) · **rodapé** → interações sociais do RF19 (curtir · comentar · compartilhar · remixar · retornar · editar, este só para o dono) · **header da lista** → o filtro **todos**, ao lado do filtro de ocasião.

---

## 4.1 Correções vindas da Modelagem UML *(insumo recebido depois da primeira redação)*

O artefato **[Modelagem UML & mapa de estado](https://claude.ai/code/artifact/8c050ab5-8faf-4073-a077-dd8e492db661)** (arquivado em `insumos/uml/`) traz um mapa de telas↔RF, o ER, a Parte 3 dimensional dos cards e uma seção de **correções de incoerência**. O confronto com o catálogo acima achou **sete lacunas**. Cada uma vira CA novo:

| # | CA novo | Requisito | Regra |
|---|---|---|---|
| 1 | **RF4.CA07** | RF4 | Toda peça carrega o campo **`sexo`**, obrigatório no formulário e exibido na identificação da peça. É ele que alimenta o filtro do Provador 2D |
| 2 | **RF4.CA08** | RF4 · RNF7 | "Adicionar peça" é uma **página própria** (`/add-piece`) na navegação lateral, **não um modal** — o modal quebrava em telas menores. Cada campo com label explícita: nome, tipo/parte do corpo, cor, material, tamanho, ocasião, estilo, marca, sexo |
| 3 | **RF4.CA09** e **RF5.CA07** | RF4 · RF5 | Os **wearstyles** de uma peça são um subconjunto do vocabulário permitido pela sua **parte do corpo** (ver a tabela no documento `04`, artefato #7). O input oferece apenas os valores daquela parte |
| 4 | **RF5.CA07b** | RF5 | Na etapa **Build Outfit**, cada lista (uma por parte do corpo) é um **espelho do guarda-roupa real do usuário** — só as peças que ele possui hoje, respeitando o estado *indisponível* (RF31.CA02). Hoje as listas trazem uma variedade fictícia |
| 5 | **RF18.CA08** | RF18 | O preset masculino/feminino define `manequim.sexo` e **filtra o catálogo**; a inserção revalida `peça.sexo == manequim.sexo` e **bloqueia** o que não corresponder |
| 6 | **RF19.CA13** e **RF19.CA14** | RF19 · RF5 | **Remixar** e **retornar** são interações **exclusivas** do Fashion AI, distintas de curtir/comentar/compartilhar. *Remixar* instancia um **novo esquema** pré-preenchido com o conteúdo da fonte e entra no fluxo do RF5, registrando a ligação origem→novo. *Retornar*, a partir de um item da lista de peças, abre o **esquema de origem** que usou aquela peça |
| 7 | **RF23.CA08** | RF23 · RNF6 | Trocar o tema ou o fundo da interface muda **apenas o *chrome* do app** (navegação, fundos de tela, painéis). **Nunca** altera a cor dos esquemas de vestimenta e das peças — esse conteúdo é do usuário e sua arte é definida por ele (RF11) |

### Duas correções que não são CA, mas entram na arquitetura

| Origem | Correção |
|---|---|
| **RNF6 · RF4** | Redirecionar **todas as escritas** para as **entidades canônicas do ER**, com apenas os atributos necessários por RF. Hoje há caminhos paralelos (`/add-piece` × `/wardrobe-items` × `/wardrobe/process-piece`) gravando o "mesmo" dado em formatos diferentes. Uma peça = um registro em `ClothingPiece`, sem duplicata. Alinha-se ao princípio da **minimização** e ao módulo `fai-domain` do documento `01` |
| **RF20 · RF21** | A modelagem confirma o redesenho do selo: a IA detecta na criação e **dispensa a revisão manual**, com **tiers** por unidade de vínculo (peça = menor, look = maior). Compatível com `docs/rf20-rf21-vinculo-marca-celebridade.md`, onde a revisão já é opcional (`Perfil exige revisão? → Não, auto-aprovação`) |

### Entidades que o ER acrescenta ao domínio

Além das já previstas no documento `01`, a modelagem nomeia: **PrivacySettings** (com `default=private` — é o RF3.CA19 no modelo de dados), **BackgroundArt** (com escopo *look* ou *peça*), **Mannequin** (com `sexo`), **Seal** (com `tier` e `auto_detected`), **Remix** (`source_id` → `new_scheme_id`), **Interaction**, **Photo**, **StyleDNA** e **AuditLog**. O `AuditLog` aparece como entidade transversal do RNF5 — o que confirma a correção do `AuditService` feita no documento `01`.

---

## 5. Resumo das mudanças estruturais

| Ação | Itens |
|---|---|
| **Absorvidos** (viram CA) | RF24 *(antigo — senha)*, RF25, RF26, RF27, RF28, RF29 |
| **Reescritos** (enunciado corrigido) | RF1, RF3, RF5, RF6, RF7, RF9, RF11, RF12, RF19, RF23 |
| **Criados** | **RF24** *(número reaproveitado)* — motor de IA, ver [`03-rf24-ia-e-servicos-externos.md`](03-rf24-ia-e-servicos-externos.md); **RF31** — filtros favoritar/disponível/indisponível/todos |
| **RFs efetivos após a reestruturação** | **25** — ver a conta abaixo |

### 5.1 A conta dos 25, passo a passo

A lista do Trello tem 30 cards, sendo 1 de rastreabilidade → **29 RFs (RF1–RF29)**. Os seis absorvidos são **RF24 *(o antigo, de senha)*, RF25, RF26, RF27, RF28 e RF29** — todos *fora* da faixa RF1–RF23, e é por isso que a faixa não encolhe:

| Passo | Conta | Total |
|---|---|---|
| RFs no board | RF1–RF29 | 29 |
| − absorvidos (RF24–RF29, numeração antiga) | −6 | **23** (= exatamente RF1–RF23) |
| + RF24 (motor de IA — número reaproveitado) | +1 | 24 |
| + RF31 (favoritar/disponível/indisponível/todos) | +1 | **25** |

⚠️ O erro fácil aqui é subtrair 6 de 23 e chegar a 19. Não se subtrai: RF24–RF29 **já não fazem parte** de RF1–RF23. Os 23 são o *resultado* da absorção, não o ponto de partida.
| **Total de CAs catalogados** | ~150 |

## 6. Matriz de rastreabilidade RF × RNF

| RNF | RFs que o realizam | CAs-âncora |
|---|---|---|
| RNF1 — Controle de acesso por perfil | RF3, RF8, RF9, RF17, RF19 | RF3.CA14, RF8.CA05, RF9.CA04, RF19.CA05 |
| RNF2 — Token JWT e recuperação de sessão | RF2, RF3 | RF2.CA01, RF2.CA04, RF3.CA09, RF3.CA10 |
| RNF3 — Criptografia de dados sensíveis | RF1, RF3, RF13 | RF1.CA04, RF13.CA08 |
| RNF4 — Backup e recuperação | transversal (infraestrutura) | plano de restauração documentado + teste trimestral |
| RNF5 — Auditoria e logging | RF1, RF2, RF3, RF9, RF20 | RF1.CA04, RF2.CA03, RF3.CA06, RF3.CA14, RF20.CA08 |
| RNF6 — Privacidade / LGPD | RF3, RF13, RF23 | RF3.CA03–CA06, RF13.CA06, RF13.CA08 |
| RNF7 — Desempenho e usabilidade | RF6, RF8, RF12, RF23 | RF6.CA06, RF12.CA06, RF23.CA05, RF23.CA06 |
| RNF8 — Falhas de APIs externas | RF4, RF10, RF11, RF15, RF16, RF18, RF24 | RF4.CA03, RF10.CA05, RF15.CA04, RF16.CA03, RF18.CA05 |
