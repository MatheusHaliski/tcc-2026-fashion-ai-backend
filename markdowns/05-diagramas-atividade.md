# Etapa 8 — Diagramas de Atividade por Requisito Funcional

Notação: Mermaid `flowchart` (renderiza no GitHub e nos artefatos). Cada diagrama traz, nas caixas de saída, o **CA** que o fluxo satisfaz — é isso que torna o diagrama verificável e não apenas ilustrativo.

Convenção de raias: `[U]` ação do usuário · `[S]` ação do sistema · `[E]` serviço externo · `◇` decisão.

---

## 1. RF10 — Copilot (recomendações por IA)

```mermaid
flowchart TD
    A([Usuário abre a aba Copilot]) --> B[S: carrega guarda-roupa e contexto conhecido]
    B --> C{Possui ≥ 3 peças?}
    C -- Não --> D[/S: explica limitação e leva ao cadastro de peças — RF10.CA04/]
    D --> Z([Fim])
    C -- Sim --> E[S: pré-preenche ocasião, humor e clima — RF10.CA01]
    E --> F[U: ajusta o contexto e solicita sugestão]
    F --> G{Cota diária disponível?}
    G -- Não --> H[/S: informa cota e horário de reposição — RF24.CA14/] --> Z
    G -- Sim --> I[S: monta prompt com catálogo do usuário]
    I --> J[E: provedor de IA]
    J --> K{Resposta em até 30 s?}
    K -- Não / erro --> L[S: circuit breaker abre] --> M[/S: recomendação por regras locais + aviso — RF10.CA05 · RNF8/] --> P
    K -- Sim --> N[S: valida que só há peças do acervo]
    N --> O{Composições válidas?}
    O -- Não --> I
    O -- Sim --> P[S: exibe 3 looks com justificativa — RF10.CA02]
    P --> Q{Ação do usuário}
    Q -- Gerar outras --> R[S: exclui as composições já vistas — RF10.CA03] --> I
    Q -- Aceitar --> S1[S: salva esquema com origem 'Copilot' — RF10.CA06]
    Q -- Sair --> Z
    S1 --> T[S: registra inferência: provedor, latência, custo — RF24.CA16] --> Z
```

---

## 2. RF13 — DNA de Estilo

```mermaid
flowchart TD
    A([Usuário acessa 'DNA de Estilo']) --> B[S: conta peças e avaliações positivas]
    B --> C{≥ 10 peças e ≥ 5 avaliações?}
    C -- Não --> D[/S: tela de progresso com o que falta — RF13.CA02/] --> Z([Fim])
    C -- Sim --> E{Já possui DNA gerado?}
    E -- Não --> F[S: exibe formulário de Identidade de Vida — RF13.CA01]
    F --> G{Usuário preenche?}
    G -- Pula --> H[S: gera apenas Camada 1 + aviso de enriquecimento — RF13.CA03]
    G -- Preenche --> I[U: informa lugares, pessoas, animais, objetos]
    I --> J[S: cifra os campos da Camada 2 em repouso — RF13.CA08 · RNF3]
    J --> K[S: calcula Camada 1 — arquétipo, paleta, silhueta, ousadia, peça ícone]
    H --> K
    K --> L[E: LLM gera a Frase de Identidade — RF24.CA04]
    L --> M[S: renderiza o Card Visual — RF13.CA04]
    E -- Sim --> N{≥ 10 novas interações desde a última geração?}
    N -- Sim --> K
    N -- Não --> M
    M --> O{Ação do usuário}
    O -- Editar vida --> P[S: regenera só a Frase; Camada 1 intacta — RF13.CA05] --> M
    O -- Configurar visibilidade --> Q[U: marca campos como privados — RF13.CA06] --> M
    O -- Compartilhar --> R[S: gera PNG com marca d'água, omitindo campos privados — RF13.CA09] --> Z
    O -- Sair --> Z
```

---

## 3. RF12 — Minhas Fotos

```mermaid
flowchart TD
    A([Usuário acessa 'Minhas Fotos']) --> B[S: carrega acervo agrupado por origem, mais recentes primeiro — RF12.CA01]
    B --> C[S: carregamento sob demanda das imagens — RF12.CA06 · RNF7]
    C --> D{Ação do usuário}
    D -- Editar --> E[S: abre o Editor Canvas 2D com a foto — RF12.CA02 → RF15] --> D
    D -- Baixar --> F[S: entrega o original sem marca d'água ao dono — RF12.CA05] --> D
    D -- Excluir 1 --> G{Foto vinculada a peça ativa?}
    G -- Sim --> H[/S: avisa que a peça ficará sem imagem — RF12.CA03/] --> I{Confirma?}
    G -- Não --> I
    I -- Não --> D
    I -- Sim --> J[S: remove a foto e o vínculo] --> D
    D -- Selecionar várias --> K[U: seleciona N fotos] --> L[/S: confirmação única informando a quantidade — RF12.CA04/]
    L --> M{Confirma?}
    M -- Não --> D
    M -- Sim --> N[S: exclui em lote] --> D
    D -- Sair --> Z([Fim])
```

---

## 4. RF8 + RF17 — Buscar/Explorar e acessar o perfil de um usuário

```mermaid
flowchart TD
    A([Usuário abre a aba Buscar]) --> B[S: feed comunitário por relevância e recência — RF8.CA01]
    B --> C{Ação}
    C -- Rolar --> D[S: paginação por cursor, sem duplicar — RF8.CA06] --> C
    C -- Buscar termo --> E[S: consulta o índice]
    E --> F[S: aplica filtro de visibilidade — RF8.CA05 · RNF1]
    F --> G{Há resultados?}
    G -- Não --> H[/S: sugere termos e conteúdos em alta — RF8.CA04/] --> C
    G -- Sim --> I[S: segmenta em Looks, Peças, Pessoas, Marcas, Celebridades — RF8.CA02]
    I --> J{Aplica filtros?}
    J -- Sim --> K[S: filtros combináveis como chips removíveis — RF8.CA03] --> I
    J -- Não --> L{Seleção}
    L -- Look ou peça --> M[S: abre o detalhe com controles sociais — RF19] --> C
    L -- Pessoa --> N[S: abre o perfil público — RF17.CA01]
    N --> O{Visibilidade permite ver publicações?}
    O -- Não --> P[/S: mostra cabeçalho e convite para seguir — RF17.CA02/] --> Q
    O -- Sim --> R[S: exibe a grade de publicações]
    R --> S1{Ação no perfil}
    S1 -- Abrir publicação --> T[S: detalhe do esquema — RF17.CA05] --> S1
    S1 -- Seguir --> Q[S: cria vínculo, atualiza contadores atomicamente, notifica — RF17.CA03] --> S1
    S1 -- Deixar de seguir --> U[S: remove vínculo, decrementa, sem notificar — RF17.CA04] --> S1
    S1 -- Voltar --> C
```

---

## 5. RF7 — Acessar peça a partir da lista de um esquema

```mermaid
flowchart TD
    A([Usuário visualiza um esquema salvo]) --> B[S: renderiza a lista de peças do esquema]
    B --> C[U: aciona uma peça da lista]
    C --> D[S: guarda o esquema de origem no contexto de navegação — RF7.CA01]
    D --> E{Peça ainda existe?}
    E -- Não --> F[/S: exibe o snapshot da publicação marcado como 'não mais disponível' — RF7.CA03/] --> J
    E -- Sim --> G{Usuário é o autor?}
    G -- Sim --> H[S: detalhe com ações de edição — RF9] --> J
    G -- Não --> I[S: detalhe público com controles sociais — RF7.CA02 · RF19.CA10]
    I --> J{Ação}
    J -- Voltar --> K[S: retorna ao esquema de origem, posição preservada] --> A
    J -- Interagir --> L[S: curtir / reagir / comentar / salvar — RF19] --> J
    J -- Sair --> Z([Fim])
```

---

## 6. RF9 — Editar os dados de um esquema de vestimenta e suas peças

```mermaid
flowchart TD
    A([Usuário aciona 'Editar esquema']) --> B{É o autor?}
    B -- Não --> C[/S: 403 e registro na auditoria — RF9.CA04 · RNF1 · RNF5/] --> Z([Fim])
    B -- Sim --> D[S: carrega nome, ocasião, descrição, visibilidade, arte e lista de peças — RF9.CA01]
    D --> E{Ação}
    E -- Remover peça --> F[S: retira do esquema; peça permanece no Closet — RF9.CA02] --> E
    E -- Adicionar peça --> G[S: anexa a peça do acervo — RF9.CA03] --> E
    E -- Editar dados de uma peça --> H[S: altera a peça no acervo e em todos os esquemas dali em diante — RF9.CA07] --> E
    E -- Melhorar com IA --> I[E: IA propõe diff] --> J[U: aceita ou recusa item a item — RF24.CA10] --> E
    E -- Sair sem salvar --> K{Há alterações pendentes?}
    K -- Sim --> L[/S: pede confirmação antes de descartar — RF9.CA06/] --> M{Confirma?}
    M -- Não --> E
    M -- Sim --> Z
    K -- Não --> Z
    E -- Salvar --> N[S: persiste e registra a data de atualização]
    N --> O{Esquema tem vínculo aprovado com marca/celebridade?}
    O -- Sim --> P[S: vínculo passa a 'revalidação pendente' e notifica a marca — RF9.CA05] --> Q
    O -- Não --> Q[S: confirma o salvamento] --> Z
```

---

## 7. RF31 — Filtros favoritar / disponível / indisponível / todos dentro de um esquema

```mermaid
flowchart TD
    A([Usuário abre um esquema ou o acervo]) --> B[S: renderiza cards com a faixa de toggles no topo — RF6.CA11 · RF31.CA07]
    B --> C{Controle acionado}
    C -- Favoritar --> D[S: alterna o favorito — independente dos demais estados — RF31.CA01]
    D --> E[S: propaga o estado a todas as telas que exibem o card] --> B
    C -- Marcar indisponível --> F[S: define estado = INDISPONÍVEL — RF31.CA02]
    F --> G[S: remove o item das opções de RF5 e RF10, mantendo-o visível com marcação] --> B
    C -- Marcar disponível --> H[S: define estado = DISPONÍVEL; item volta a ser elegível — RF31.CA03] --> B
    C -- Filtro 'todos' --> I[S: lista favoritos, disponíveis e indisponíveis sem distinção — RF31.CA04] --> B
    C -- Abrir detalhe --> J[S: navega mantendo o filtro ativo — RF31.CA05]
    J --> K[U: volta] --> B
    C -- Sair --> Z([Fim])
```

> **Regra de consistência (RF31.CA06/CA07).** *Favoritar* é um sinalizador booleano independente, desenhado como estrelinha pequena no padrão Spotify. *Disponível* e *indisponível* são estados mutuamente exclusivos — a interface nunca permite os dois ao mesmo tempo — e *indisponível* é compacto, só a letra. Os três ficam na **faixa superior** do card; **"todos" não é toggle de card**, é o filtro da lista, no header, ao lado do filtro de ocasião.

---

## 8. RF14 / RF22 — Feed de busca de marcas e de celebridades

```mermaid
flowchart TD
    A([Usuário abre a aba Marcas ou Celebridades]) --> B[S: consulta perfis com status = VALIDADO — RF14.CA01]
    B --> C{Usuário tem DNA de Estilo?}
    C -- Sim --> D[S: ordena por afinidade com o arquétipo — RF24.CA06]
    C -- Não --> E[S: ordena por mais recentes]
    D --> F[S: renderiza logo, nome, nº de vínculos e de seguidores]
    E --> F
    F --> G{Ação}
    G -- Buscar nome --> H[S: filtra por correspondência parcial — RF14.CA02] --> F
    G -- Alternar ordenação --> E
    G -- Seguir --> I[S: cria vínculo; esquemas da marca passam a aparecer no feed — RF14.CA05] --> F
    G -- Abrir perfil --> J[Ver diagrama 9]
    G -- Sair --> Z([Fim])
```

---

## 9. RF14.CA03 / RF22 — Perfil de marca ou celebridade

```mermaid
flowchart TD
    A([Usuário aciona um perfil de marca/celebridade]) --> B[S: carrega bio, catálogo e identidade visual]
    B --> C[S: busca vínculos com estado = APROVADO — RF14.CA03]
    C --> D{Há esquemas vinculados?}
    D -- Não --> E[/S: estado vazio convidando a criar um look vinculado — RF14.CA04/] --> G
    D -- Sim --> F[S: exibe a grade de esquemas com o selo verificado — RF20.CA07]
    F --> G{Ação}
    G -- Abrir esquema --> H[S: detalhe do esquema com selo e link para o perfil] --> G
    G -- Seguir --> I[S: cria vínculo de seguimento] --> G
    G -- Administrador do perfil --> J{É o administrador?}
    J -- Sim --> K[S: exibe a fila de vínculos pendentes — ver diagrama 12] --> G
    J -- Não --> G
    G -- Sair --> Z([Fim])
```

---

## 10. RF3 — Alterar dados do perfil (dados sensíveis + direitos LGPD)

```mermaid
flowchart TD
    A([Usuário acessa 'Dados pessoais']) --> B[S: exibe finalidade, base legal e prazo de retenção de cada dado — RF3.CA03 · RNF6]
    B --> C{Ação}
    C -- Alterar dado sensível --> D[/S: exige reautenticação por senha — RF3.CA01/]
    D --> E{Senha confere?}
    E -- Não --> F[/S: recusa e registra a tentativa — RNF5/] --> C
    E -- Sim --> G{O dado é o e-mail?}
    G -- Sim --> H[S: novo e-mail em 'pendente de confirmação' + aviso ao e-mail antigo — RF3.CA02] --> C
    G -- Não --> I[S: persiste cifrado em repouso — RNF3] --> C
    C -- Exportar meus dados --> J[S: gera arquivo com perfil, guarda-roupa, esquemas e DNA]
    J --> K[S: disponibiliza por link expirável — RF3.CA04 · LGPD art. 18 V] --> C
    C -- Revogar consentimento --> L[S: cessa o tratamento e registra data/hora — RF3.CA06] --> C
    C -- Ajustar visibilidade --> M[S: aplica ao feed e ao perfil público; regra do esquema prevalece se mais restritiva — RF3.CA12 · CA13] --> C
    C -- Excluir conta --> N[/S: confirmação em duas etapas/]
    N --> O{Confirmou duas vezes?}
    O -- Não --> C
    O -- Sim --> P[S: conta em carência de 30 dias e invisível na rede — RF3.CA05]
    P --> Q{Reativou dentro do prazo?}
    Q -- Sim --> C
    Q -- Não --> R[S: eliminação definitiva — LGPD art. 18 VI] --> Z([Fim])
    C -- Sair --> Z
```

> ✅ **Confrontado com o material de padrões de interface LGPD** (anexo do RNF6, arquivado em `insumos/lgpd/`). O fluxo dos direitos do titular estava correto. A fonte acrescenta quatro regras de forma, agora exigíveis:
>
> 1. **Privacy by Default** — a conta nasce privada e com todo consentimento opcional desligado (RF3.CA19); o diagrama assume esse estado inicial.
> 2. **Granularidade** — "Revogar consentimento" é sempre *por finalidade*, nunca um botão único de "revogar tudo" (RF3.CA20).
> 3. **Simetria de esforço** — revogar tem o mesmo número de passos de conceder (RF3.CA21, art. 8º, §5º).
> 4. **Exportação legível por máquina** — o nó de exportação entrega JSON, não PDF (RF3.CA24, art. 18, V).

---

## 11. RF23 — Alterar dados **não sensíveis** e preferências de interface

```mermaid
flowchart TD
    A([Usuário acessa 'Preferências']) --> B[S: carrega tema, idioma, densidade, fonte, acessibilidade]
    B --> C{Ação}
    C -- Alterar tema/idioma/densidade/fonte --> D[S: aplica imediatamente e persiste entre dispositivos — RF23.CA02] --> C
    C -- Alto contraste / reduzir animações --> E[S: aplica em todas as telas — RF23.CA05] --> C
    C -- Alterar nome de exibição, bio, avatar ou capa --> F[S: persiste SEM reautenticação — RF23.CA03] --> C
    C -- "Alterar @" --> G{"@ disponível?"}
    G -- Não --> H[/S: recusa e sugere alternativas — RF23.CA04/] --> C
    G -- Sim --> I["S: atualiza o @ e mantém redirecionamento do antigo por 30 dias"] --> C
    C -- Navegar por teclado --> J[S: foco visível em todo controle interativo — RF23.CA06 · RNF7] --> C
    C -- Sair --> Z([Fim])
```

> A distinção **RF3 × RF23** é a que elimina a ambiguidade histórica: RF3 trata do dado que identifica a pessoa (exige reautenticação, tem base legal, entra no relatório LGPD); RF23 trata do dado de vitrine e da preferência de uso (não exige reautenticação).

---

## 12. RF1.CA06–CA10 *(ex-RF27/RF28)* — Cadastrar e gerenciar perfil de marca ou celebridade

```mermaid
flowchart TD
    A([Visitante escolhe o tipo de perfil]) --> B{Tipo}
    B -- Pessoal --> C[S: cadastro comum — RF1.CA01] --> Z([Fim])
    B -- Marca --> D[U: razão social, CNPJ, nome de exibição, logotipo — RF1.CA06]
    B -- Celebridade --> E[U: nome artístico, documento de comprovação, foto oficial — RF1.CA09]
    D --> F[S: cria conta com status PENDENTE DE VALIDAÇÃO]
    E --> F
    F --> G[S: perfil NÃO aparece nos feeds RF14/RF22 e não recebe vínculos]
    G --> H[E: administrador analisa]
    H --> I{Aprovado?}
    I -- Não --> J[/S: notifica o motivo; conta permanece sem visibilidade pública/] --> Z
    I -- Sim --> K[S: status = VALIDADO — RF1.CA07]
    K --> L[S: passa a listar no feed e a ser elegível a vínculos — RF20 / RF21]
    L --> M{Ação do administrador do perfil}
    M -- Editar dados --> N[S: persiste e reflete no feed em até um ciclo de cache — RF1.CA08] --> M
    M -- Ver fila de vínculos --> O[S: lista vínculos PENDENTES]
    O --> P{Decisão}
    P -- Aprovar --> Q[S: selo verificado; esquema entra no perfil — RF20.CA03] --> R
    P -- Recusar --> S1[S: remove o selo; esquema segue publicado sem vínculo — RF20.CA04] --> R
    P -- Ignorar por 15 dias --> T[S: vínculo caduca automaticamente — RF20.CA05] --> R
    R[S: notifica autor e perfil; registra na auditoria — RF20.CA08 · RNF5] --> M
    M -- Sair --> Z
```

---

## 13. RF3.CA15–CA18 *(ex-RF26)* — Receber e gerenciar notificações

```mermaid
flowchart TD
    subgraph Produção
    A([Interação social ocorre: curtida, reação, comentário, novo seguidor, mudança de vínculo]) --> B[S: transação principal é confirmada]
    B --> C[S: publica evento de domínio — RF19.CA11]
    C --> D{Destinatário desativou esse tipo? — RF3.CA17}
    D -- Sim --> E[S: contabiliza a interação, não entrega notificação — RF19.CA12] --> F([Fim da produção])
    D -- Não --> G[S: grava a notificação na timeline do destinatário] --> F
    end
    subgraph Consumo
    H([Usuário abre a central de notificações]) --> I[S: lista da mais recente para a mais antiga, com não lidas destacadas — RF3.CA15]
    I --> J{Ação}
    J -- Abrir uma --> K[S: marca como lida e navega ao conteúdo de origem] --> I
    J -- Marcar todas como lidas --> L[S: zera o contador e propaga entre dispositivos — RF3.CA16] --> I
    J -- Preferências --> M[U: desativa tipos de notificação — RF3.CA17] --> I
    J -- Sair --> N([Fim do consumo])
    end
    O([Rotina periódica]) --> P[S: expurga notificações com mais de 90 dias, sem afetar o conteúdo — RF3.CA18]
```

---

## 14. RF18 — Provador 2D com manequim masculino/feminino

```mermaid
flowchart TD
    A([Usuário abre o Provador 2D]) --> B{Possui ≥ 1 peça?}
    B -- Não --> C[/S: orienta o cadastro de peças — RF4/] --> Z([Fim])
    B -- Sim --> D[S: carrega o manequim da última escolha — RF18.CA01]
    D --> E{Ação}
    E -- Trocar manequim (masc/fem) --> F[S: troca e memoriza a escolha] --> E
    E -- Ajustar tom de pele / porte --> G[S: salva a preferência no perfil — RF18.CA06 · RF23] --> E
    E -- Vestir uma peça --> H{Peça tem fundo removido?}
    H -- Não --> I[E: remoção de fundo sob demanda — RF24.CA08]
    I --> J{Serviço respondeu?}
    J -- Não --> K[/S: avisa que a sobreposição será aproximada — RF18.CA05 · RNF8/] --> L
    J -- Sim --> L[S: identifica a camada da peça: base, intermediária, externa, acessório]
    H -- Sim --> L
    L --> M{Já há peça nessa camada?}
    M -- Sim --> N[S: substitui e informa a troca — RF18.CA03] --> O
    M -- Não --> O[S: sobrepõe na ordem correta de camadas — RF18.CA02] --> E
    E -- Limpar --> P[/S: confirma/] --> Q{Confirma?}
    Q -- Sim --> R[S: remove todas as peças do manequim; guarda-roupa intacto — RF18.CA07] --> E
    Q -- Não --> E
    E -- Salvar como look --> S1[S: cria esquema com origem 'Provador' — RF18.CA04 · RF5] --> Z
    E -- Sair --> Z
```

---

## 15. RF17 — Visualizar perfil com as postagens de outro usuário

> Fluxo detalhado no **diagrama 4** (nós `N` a `U`). Mantido lá para não duplicar a lógica de visibilidade, que é a mesma do feed.

---

## 16. RF2 — Autenticar usuário

```mermaid
flowchart TD
    A([Usuário abre a tela de login]) --> B[U: informa e-mail e senha]
    B --> C{Conta bloqueada por tentativas?}
    C -- Sim --> D[/S: informa bloqueio temporário e horário de liberação — RF2.CA03/] --> Z([Fim])
    C -- Não --> E[S: verifica credenciais com Argon2id]
    E --> F{Credenciais válidas?}
    F -- Não --> G[S: incrementa contador de falhas da janela de 15 min]
    G --> H[/S: mensagem genérica 'credenciais inválidas' — RF2.CA02/]
    H --> I{5ª falha na janela?}
    I -- Sim --> J[S: bloqueia e registra o evento na auditoria — RF2.CA03 · RNF5] --> Z
    I -- Não --> B
    F -- Sim --> K[S: emite token de acesso e token de renovação — RF2.CA01 · RNF2]
    K --> L{Tipo de perfil}
    L -- Marca / Celebridade --> M[S: direciona ao painel do perfil — RF2.CA05] --> Z
    L -- Pessoal --> N[S: direciona ao Perfil Lookbook — RF6] --> Z
```

**Renovação transparente da sessão (RF2.CA04)** — executa fora do fluxo de login:

```mermaid
flowchart TD
    A([App faz requisição autenticada]) --> B{Token de acesso expirado?}
    B -- Não --> C[S: processa a requisição] --> Z([Fim])
    B -- Sim --> D{Token de renovação válido?}
    D -- Sim --> E[S: rotaciona o par de tokens e repete a requisição — RF2.CA04] --> C
    D -- Não --> F[/S: encerra a sessão e leva ao login — RF3.CA07/] --> Z
```

---

## 17. RF4 — Adicionar peça ao guarda-roupa

```mermaid
flowchart TD
    A([Usuário abre 'Adicionar nova peça']) --> B[U: envia uma ou mais fotografias]
    B --> C{Formato JPG/PNG/WebP e ≤ 10 MB?}
    C -- Não --> D[/S: recusa com mensagem clara do motivo — RF4.CA01/] --> B
    C -- Sim --> E{Mais de uma foto?}
    E -- Sim --> F[S: cria um rascunho por foto para revisão em lote — RF4.CA05]
    E -- Não --> G[S: cria um rascunho]
    F --> G
    G --> H[E: IA de detecção de peça — RF24.CA01]
    H --> I{Confiança suficiente?}
    I -- Não --> J[/S: formulário vazio com aviso de preenchimento manual — RF4.CA03 · RNF8/] --> L
    I -- Sim --> K[S: pré-preenche categoria, cor dominante e tecido, tudo editável — RF4.CA02] --> L
    L[U: revisa e completa nome, categoria e cor]
    L --> M{Campos obrigatórios preenchidos?}
    M -- Não --> N[/S: indica os campos faltantes/] --> L
    M -- Sim --> O[E: remoção de fundo]
    O --> P{Serviço disponível?}
    P -- Não --> Q[S: salva com a foto original e enfileira reprocessamento — RF4.CA06 · RNF8] --> R
    P -- Sim --> R[S: persiste a peça em ClothingPiece]
    R --> S1[S: peça aparece imediatamente no Closet Digital — RF4.CA04 · RF6]
    S1 --> T[S: registra a inferência — RF24.CA16] --> Z([Fim])
```

---

## 18. RF5 — Criar esquema de vestimenta (aba "Criar Look")

```mermaid
flowchart TD
    A([Usuário abre a aba 'Criar Look']) --> B[S: conta as peças disponíveis do acervo]
    B --> C{Possui ≥ 2 peças?}
    C -- Não --> D[/S: orienta o cadastro de peças — RF5.CA02 · RF4/] --> Z([Fim])
    C -- Sim --> E[S: exibe o Closet Digital filtrável e o espaço de composição — RF5.CA01]
    E --> F{Como o usuário compõe?}
    F -- Manual --> G[U: arrasta peças para a composição]
    F -- Gerar com IA --> H[U: confirma ocasião e humor]
    H --> I[S: monta o prompt restrito ao acervo do usuário]
    I --> J[E: provedor de IA — RF24.CA02]
    J --> K{Resposta válida e só com peças do acervo?}
    K -- Não --> I
    K -- Sim --> L[S: apresenta 3 composições distintas — RF5.CA04]
    L --> M[U: escolhe uma e ajusta] --> G
    G --> N[U: informa nome e ocasião e aciona salvar]
    N --> O{Ao menos 1 peça na composição?}
    O -- Não --> P[/S: recusa e indica o mínimo de 1 peça — RF5.CA06/] --> G
    O -- Sim --> Q[S: cria o esquema herdando a visibilidade padrão do perfil — RF5.CA03 · RF3.CA12]
    Q --> R[S: sugere vínculo de marca/celebridade detectado — RF24.CA09 · RF20/RF21]
    R --> S1{Usuário publica no feed?}
    S1 -- Não --> Z
    S1 -- Sim --> T[S: publica respeitando a visibilidade escolhida — RF5.CA05 · RF8] --> Z
```

---

## 19. RF6 — Perfil Lookbook (Closet Digital + Looks Salvos)

```mermaid
flowchart TD
    A([Usuário acessa um Perfil Lookbook]) --> B{Perfil próprio ou de terceiro?}
    B -- Terceiro --> C[S: filtra pelo que a visibilidade permite — RF6.CA08 · RF3.CA12/CA13] --> D
    B -- Próprio --> D[S: exibe as abas Closet Digital e Looks Salvos com contadores — RF6.CA01]
    D --> E{Aba escolhida}

    E -- Closet Digital --> F{Possui peças?}
    F -- Não --> G[/S: estado vazio com chamada 'Adicionar nova peça' — RF6.CA03 · RF4/] --> Z([Fim])
    F -- Sim --> H[S: carrega a grade paginada, resposta em até 3 s — RF6.CA06 · RNF7]
    H --> I{Ação do usuário}
    I -- Filtrar --> J[S: filtra por categoria, cor ou estação sem recarregar — RF6.CA02] --> H
    I -- Editar peça --> K[S: abre o formulário com os dados atuais — RF6.CA04 · RF9] --> Z
    I -- Marcar indisponível --> L[S: peça deixa de ser oferecida em RF5 e RF10, mas permanece no acervo — RF6.CA07] --> H
    I -- Excluir peça --> M{Peça usada em esquemas?}
    M -- Sim --> N[/S: avisa quantos esquemas serão afetados/] --> O
    M -- Não --> O[U: confirma]
    O --> P[S: exclui preservando o histórico dos esquemas já publicados — RF6.CA05] --> H

    E -- Looks Salvos --> Q[S: exibe o feed compacto com a origem identificada — RF6.CA09]
    Q --> R[S: cada card traz os toggles de estado no TOPO e o footer social no RODAPÉ — RF6.CA11 · RF31 · RF19]
    R --> S1{Ação do usuário}
    S1 -- Filtrar ocasião --> T[S: filtra e preserva o filtro ao voltar do detalhe — RF6.CA10] --> R
    S1 -- Favoritar --> U[S: persiste o estado e reflete em todas as telas do card — RF6.CA12] --> R
    S1 -- Remover salvo de terceiro --> V[S: remove da lista sem afetar o original do autor — RF6.CA13] --> R
    S1 -- Sair --> Z
```

**Lookbook de celebridade — era como atmosfera (RF6.CA14).** É o subfluxo que a banca vai questionar, por isso está isolado:

```mermaid
flowchart TD
    A([Usuário abre um Lookbook de celebridade]) --> B[S: exibe as eras nomeadas como rótulo textual de curadoria]
    B --> C[U: seleciona uma era — Renaissance, Chromatica, Folklore, Blond Ambition]
    C --> D[S: monta o prompt apenas com atmosfera cromática e material: paleta, textura, tecido, acabamento, luz, styling]
    D --> E{Prompt contém nome da pessoa real, rosto, corpo ou silhueta identificável?}
    E -- Sim --> F[S: REJEITA antes do envio — RF6.CA14]
    F --> G[S: registra a rejeição — RF24.CA16] --> Z([Fim])
    E -- Não --> H[E: serviço de geração de imagem — pranchas 11 a 13, Coleção F]
    H --> I[S: entrega a arte de atmosfera da era, nunca a pessoa — RF6.CA14]
    I --> G2[S: registra a inferência — RF24.CA16] --> Z
```

---

## 20. RF11 — Background Studio

```mermaid
flowchart TD
    A([Usuário edita um card de esquema ou peça]) --> B[U: abre o Background Studio]
    B --> C[S: exibe a galeria de fundos por categoria com pré-visualização em tempo real — RF11.CA01]
    C --> D{Origem do fundo}

    D -- Galeria --> E[U: escolhe um fundo] --> J
    D -- Imagem própria --> F[U: envia a imagem]
    F --> G{Formato e proporção válidos?}
    G -- Não --> H[/S: recusa indicando o motivo/] --> F
    G -- Sim --> I[S: recorta para o formato do card — RF11.CA04] --> J
    D -- Gerar por IA --> K[U: descreve o cenário]
    K --> L[E: provedor de geração de arte — RF24.CA07]
    L --> M{Resposta em até 30 s?}
    M -- Não --> N[/S: informa o andamento do job sem travar a tela — RF11.CA03 · RNF8/] --> L
    M -- Sim --> O[S: entrega a arte gerada — RF11.CA03] --> J
    D -- Remover fundo --> P[S: card volta ao fundo padrão sem perder os demais dados — RF11.CA05] --> Z([Fim])

    J[S: valida a legibilidade do texto sobreposto nos temas claro e escuro]
    J --> Q{Contraste suficiente nos dois temas?}
    Q -- Não --> R[/S: avisa e sugere ajuste ou outro fundo/] --> D
    Q -- Sim --> S1[S: salva o card com o fundo aplicado — RF11.CA02]
    S1 --> T[S: registra a inferência quando houve IA — RF24.CA16] --> Z
```

---

## 21. RF15 — Editor Canvas Interativo 2D · **Tema Futuro**

> ⚠️ Card marcado com o label **TEMAS FUTUROS** no board. O diagrama existe para fechar a cobertura e dimensionar o esforço; não é compromisso de sprint.

```mermaid
flowchart TD
    A([Usuário abre uma foto no editor]) --> B[S: carrega a imagem e a pilha de histórico — RF15.CA01]
    B --> C{Ferramenta escolhida}
    C -- Recorte / rotação / brilho / contraste --> D[S: aplica a transformação e empilha no histórico] --> H
    C -- Remoção de fundo --> E[E: serviço de remoção de fundo]
    E --> F{Serviço respondeu?}
    F -- Não --> G[/S: informa a falha e mantém as demais ferramentas operantes — RF15.CA04 · RNF8/] --> C
    F -- Sim --> D
    C -- Desfazer --> I[S: retrocede um passo, até o estado original, sem encerrar a sessão — RF15.CA03] --> H
    H{Usuário continua editando?}
    H -- Sim --> C
    H -- Não --> J{Salvar ou sair?}
    J -- Sair --> K[U: confirma a saída]
    K --> L[S: descarta as edições e preserva a imagem original íntegra — RF15.CA05] --> Z([Fim])
    J -- Salvar --> M[S: a imagem editada substitui a exibida na peça]
    M --> N[S: a original permanece em 'Minhas Fotos' — RF15.CA02 · RF12] --> Z
```

---

## 22. RF16 — Geração 3D das peças · **Tema Futuro** *(stretch goal)*

> ⚠️ Card marcado com o label **TEMAS FUTUROS**. Dependência de API 3D externa e de custo por job — é o requisito de maior risco do board.

```mermaid
flowchart TD
    A([Usuário abre uma peça com fotografia válida]) --> B[U: solicita a geração 3D]
    B --> C{Cota de uso disponível?}
    C -- Não --> D[/S: informa a cota e o horário de reposição — RF24.CA14/] --> Z([Fim])
    C -- Sim --> E[S: cria o job no estado 'enfileirado' — RF16.CA01]
    E --> F[S: exibe o estado do job na peça: enfileirado → processando → concluído → falhou]
    F --> G[E: serviço externo de geração 3D]
    G --> H{Resultado}
    H -- Falha ou tempo limite --> I[S: atualiza o estado para 'falhou' com motivo legível — RF16.CA03 · RNF8]
    I --> J{Reprocessamento gratuito já usado?}
    J -- Não --> K[U: reprocessa uma vez sem custo — RF16.CA03] --> G
    J -- Sim --> L[/S: mantém a versão 2D como alternativa/] --> Z
    H -- Sucesso --> M[S: persiste o modelo e marca o job como 'concluído']
    M --> N[S: exibe o modelo 3D com rotação e zoom, com a versão 2D disponível — RF16.CA02]
    N --> O[S: registra a inferência: provedor, latência, custo — RF24.CA16] --> Z

    P([Usuário fecha o app durante o processamento]) --> Q[U: reabre o app depois]
    Q --> R[S: recupera o estado do job do servidor, não do dispositivo — RF16.CA04] --> F
```

---

## Cobertura

| RF | Diagrama | RF | Diagrama |
|---|---|---|---|
| RF1 (ex-RF27/RF28) | 12 | RF13 | 2 |
| RF2 | **16** | RF14 / RF22 | 8 e 9 |
| RF3 — dados pessoais | 10 | RF15 | **21** *(Tema Futuro)* |
| RF3 (ex-RF26) — notificações | 13 | RF16 | **22** *(Tema Futuro)* |
| RF4 | **17** | RF17 | 4 |
| RF5 | **18** | RF18 | 14 |
| RF6 | **19** *(inclui o subfluxo RF6.CA14)* | RF19 | 4, 5, 7 |
| RF7 | 5 | RF20 / RF21 | 12 |
| RF8 | 4 | RF23 | 11 |
| RF9 | 6 | RF24 — motor de IA | transversal: 1, 17, 18, 19, 20, 22 |
| RF10 | 1 | RF31 (filtros do esquema) | 7 |
| RF11 | **20** | RF12 | 3 |

**Cobertura completa.** Todos os RFs efetivos do board têm diagrama de atividade. Os diagramas 16 a 22 fecharam as lacunas que restavam (RF2, RF4, RF5, RF6, RF11, RF15, RF16).

O **RF24** não recebe diagrama próprio de propósito: ele é o motor transversal de IA, e cada uma de suas capacidades é exercida *dentro* do fluxo do RF que a consome — é por isso que os CAs do RF24 aparecem como caixas de saída nos diagramas dos outros requisitos, e não isolados. A única exceção destacada é o subfluxo de **direito de imagem** do RF6.CA14, separado no diagrama 19 justamente porque é o ponto que a banca tende a questionar.
