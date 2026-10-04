# Política de verificação de perfis de marca e de celebridade

**Versão 1.0 · outubro de 2026 · RF1 (CA07–CA09), RF20–RF22 (emissores de selos)**
Responsável: administração do FashionAI. Revisão desta política: a cada semestre ou quando um critério mudar.

## 1. Para que serve

Um perfil de **marca** ou de **celebridade** é um *emissor*: concede selos aos looks e às peças dos usuários, publica
promoções e cupons e aparece como perfil oficial nas buscas e no Explorador. Um emissor falso engana quem recebe o selo
e quem compra. Por isso todo perfil emissor passa por análise humana antes de ganhar esses poderes.

A verificação responde a três perguntas, nesta ordem:

1. **Autenticidade** — a marca ou a pessoa existe e é quem diz ser?
2. **Legitimidade** — quem fez o cadastro tem o direito de falar por ela?
3. **Relevância para a moda** — a marca atua no mercado de moda; a celebridade tem notoriedade pública verificável.

A aprovação diz que **o perfil é o oficial**. Ela não é endosso de produtos, de opiniões ou de qualidade.

## 2. Quem pode pedir

| Tipo | Quem pode pedir | Não pode |
|---|---|---|
| Marca | Empresa com CNPJ ativo, por sócio, funcionário ou agência autorizada | Revendedor, fã, perfil de loja multimarca falando por uma marca de terceiro |
| Celebridade | A própria pessoa, maior de 18 anos, ou o representante dela (agência, assessoria, gravadora) | Fã-clube, paródia, perfil de homenagem, pessoa menor de 18 anos |

Cada marca e cada pessoa tem **um** perfil oficial. Um segundo pedido para o mesmo nome é recusado como possível
impersonação até que o primeiro seja esclarecido.

## 3. Critérios

Os critérios **obrigatórios** são eliminatórios: o analista só aprova com todos atendidos, e o sistema recusa uma
aprovação com algum deles em aberto. Os **complementares** não eliminam; deixam o perfil mais completo e ajudam o analista
a decidir rápido.

O sistema confere sozinho o que dá para conferir (marcado como *automático*); o resto é conferido pelo analista e fica
registrado na checklist da decisão.

### 3.1 Marca

| Código | Critério | Como é conferido | Obrigatório |
|---|---|---|---|
| `EMAIL_CONFIRMADO` | E-mail da conta confirmado pelo código enviado | automático | sim |
| `CNPJ_VALIDO` | CNPJ com 14 dígitos e dígitos verificadores corretos | automático | sim |
| `CNPJ_ATIVO` | CNPJ com situação **ativa** na Receita Federal e razão social igual à informada | analista, na consulta pública do CNPJ | sim |
| `ATIVIDADE_MODA` | Atividade ligada à moda: confecção, vestuário, calçados, bolsas, acessórios, joias, têxtil, beleza de moda (CNAE ou comprovante) | analista | sim |
| `COMPROVANTE_ATIVIDADE` | Comprovante legível em nome do CNPJ (ver 4.1) | automático (enviado) + analista (legível e coerente) | sim |
| `PRESENCA_OFICIAL` | Site, loja on-line ou rede social oficial ativa, com o mesmo nome da marca | automático (link enviado) + analista (abre e confere) | sim |
| `REPRESENTACAO` | Quem cadastrou representa a marca: e-mail no domínio do site **ou** código de verificação publicado no site/rede oficial **ou** documento de representação | automático (domínio do e-mail = domínio do site) + analista | sim |
| `SEM_CONFLITO` | O nome não imita marca de terceiro nem repete um perfil oficial já aprovado | automático (nome já aprovado) + analista | sim |
| `PERFIL_COMPLETO` | Logo, categoria, contato comercial e hashtag oficial preenchidos | automático | não |

### 3.2 Celebridade

| Código | Critério | Como é conferido | Obrigatório |
|---|---|---|---|
| `EMAIL_CONFIRMADO` | E-mail da conta confirmado pelo código enviado | automático | sim |
| `DOCUMENTO_IDENTIDADE` | Documento oficial com foto (RG, CNH, passaporte ou RNE), legível e dentro da validade | automático (enviado) + analista | sim |
| `NOME_CONFERE` | Nome civil informado igual ao do documento; foto oficial compatível com a pessoa | analista | sim |
| `MAIOR_DE_IDADE` | 18 anos ou mais na data da análise | automático (data de nascimento) ou analista (documento) | sim |
| `CONTROLE_PERFIL_OFICIAL` | Prova de controle do perfil público: o **código de verificação** aparece na bio ou numa publicação do perfil oficial informado, ou o pedido chega pelo e-mail oficial da agência | automático (link enviado) + analista | sim |
| `NOTORIEDADE` | Pelo menos um: (a) 10 mil seguidores reais numa rede pública; (b) 3 matérias em veículos de imprensa independentes nos últimos 12 meses (publieditorial não conta); (c) selo de verificação vigente em outra grande plataforma; (d) verbete ou perfil em base pública reconhecida (Wikipédia, IMDb, Spotify for Artists, Discogs) | automático (seguidores declarados ≥ 10 mil) + analista | sim |
| `SEM_IMPERSONACAO` | Não é fã-clube, paródia ou homenagem, e não repete um perfil oficial já aprovado | automático (nome já aprovado) + analista | sim |
| `REPRESENTACAO` | Se o pedido vem de agência ou assessoria, contato do representante e autorização da pessoa | analista | não* |
| `CONSENTIMENTO_SELOS` | Consentimento para usar nome e imagem nos selos que o perfil conceder (RF21) | automático | não |
| `PERFIL_COMPLETO` | Foto oficial, áreas de atuação, histórico profissional e interesses de moda preenchidos | automático | não |

\* Obrigatório quando o cadastro é feito por um representante.

Sinais que **não** contam para notoriedade: seguidores comprados ou com engajamento incompatível, presença só em
sites pagos, autodeclaração sem fonte.

## 4. Evidências aceitas

### 4.1 Comprovante de atividade da marca (um destes, em nome do CNPJ)
- Comprovante de inscrição e situação cadastral do CNPJ, contrato social ou certificado do MEI;
- Nota fiscal de venda de produto de moda emitida nos últimos 6 meses (valores podem ser cobertos);
- Certificado de registro ou pedido de marca no INPI;
- Tela do painel da loja on-line ou do marketplace mostrando a razão social.

### 4.2 Código de verificação
Cada perfil emissor tem um código próprio, no formato `FAI-XXXXXX`, mostrado na **Central do emissor**. Para provar o
controle, a pessoa publica o código na bio ou numa publicação do perfil oficial (ou numa página do site da marca) e
mantém até a decisão. Depois pode apagar. O código só vale para a conta que o mostra: publicar o código de outra conta
não aprova ninguém.

### 4.3 O que não é aceito
Documento de terceiro, documento vencido ou cortado, montagem, captura de tela de documento sem os dados legíveis,
link encurtado que não leva ao perfil oficial, perfil privado sem outra prova.

## 5. Fluxo da análise e prazos

1. **Envio** — o cadastro é o primeiro envio. O e-mail precisa ser confirmado antes da análise.
2. **Aviso** — cada administrador recebe uma notificação no app e um e-mail com o link da fila.
3. **Análise** — um analista abre o dossiê (dados, documentos, verificações automáticas), percorre a checklist e decide.
4. **Decisão** — aprovar, pedir ajustes ou recusar (seção 6). A pessoa recebe a decisão no app, por e-mail e na
   Central do emissor.

| Etapa | Prazo de referência |
|---|---|
| Primeira análise, contada da confirmação do e-mail | até **3 dias úteis** |
| Reanálise depois de um reenvio | até **2 dias úteis** |
| Resposta a um pedido de ajustes | a pessoa tem **30 dias**; depois o analista pode recusar por falta de resposta |

## 6. Decisões

| Decisão | Quando | Efeito |
|---|---|---|
| **Aprovar** | Todos os critérios obrigatórios atendidos | Perfil oficial: selo de verificado, selos, promoções, cupons e dashboard do emissor liberados |
| **Pedir ajustes** | Falta ou não está legível algo que a pessoa consegue corrigir | Status *Ajustes solicitados*; a Central mostra o que corrigir e permite reenviar |
| **Recusar** | Critério obrigatório não atendido e sem correção simples (ex.: CNPJ inativo, impersonação) | Status *Recusado*, com motivo; a pessoa pode reenviar com novas evidências, dentro do limite de envios |

Toda decisão negativa traz **pelo menos um motivo padronizado** e pode trazer uma observação livre do analista
(até 500 caracteres, sem dados sensíveis):

| Motivo | Texto mostrado à pessoa |
|---|---|
| `DOCUMENTO_ILEGIVEL` | O documento enviado está ilegível, cortado ou vencido. |
| `DOCUMENTO_DIVERGENTE` | Os dados do documento não batem com os do cadastro. |
| `CNPJ_INVALIDO_OU_INATIVO` | O CNPJ não está ativo ou a razão social não confere. |
| `ATIVIDADE_FORA_DA_MODA` | A atividade da empresa não está ligada ao mercado de moda. |
| `PRESENCA_NAO_VERIFICAVEL` | Não encontramos o site, a loja ou o perfil oficial informado. |
| `REPRESENTACAO_NAO_COMPROVADA` | Não ficou comprovado que você representa a marca ou a pessoa. |
| `CONTROLE_NAO_COMPROVADO` | O código de verificação não aparece no perfil oficial informado. |
| `NOTORIEDADE_INSUFICIENTE` | A notoriedade pública ainda não atinge os critérios da política. |
| `MENOR_DE_IDADE` | Perfis de celebridade exigem 18 anos ou mais. |
| `POSSIVEL_IMPERSONACAO` | Já existe um perfil oficial com este nome ou o perfil parece não oficial. |
| `DADOS_INCOMPLETOS` | Faltam dados obrigatórios do cadastro. |
| `VIOLACAO_DOS_TERMOS` | O perfil viola os Termos de Uso. |
| `OUTRO` | Outro motivo (detalhado na observação). |

## 7. Reenvio e contestação

- Com *Ajustes solicitados* ou *Recusado*, a pessoa corrige pela **Central do emissor** (links, contato, nome civil
  no caso de celebridade, novo documento e uma mensagem ao analista) e reenvia. O pedido só é aceito se todos os
  campos forem válidos; nada é gravado de um reenvio inválido. O pedido volta para a fila e os administradores são avisados de novo.
- Cada perfil tem **até 5 envios** (o cadastro conta como o primeiro). Esgotado o limite, só a administração reabre o
  pedido, por contato direto.
- A pessoa pode contestar uma recusa respondendo ao e-mail da decisão; a contestação é analisada por outro
  administrador sempre que houver mais de um.

## 8. Depois da aprovação

- O emissor mantém os dados atualizados e usa selos e promoções conforme as regras do RF21/RF25.
- **Revalidação**: troca de nome do perfil, de CNPJ ou de titularidade exige nova análise; o analista pode pedir
  revalidação a qualquer tempo diante de denúncia fundamentada.
- **Suspensão**: impersonação descoberta depois, uso enganoso de selos, venda do perfil ou violação grave dos Termos.
  A conta é suspensa com motivo registrado e a pessoa é avisada.

## 9. Conduta do analista

- Não analisa o próprio perfil nem o de quem tem relação pessoal ou comercial com ele (o sistema impede a aprovação do
  próprio perfil).
- Decide só com base nesta política e registra a checklist; "conheço a marca" não substitui evidência.
- Não copia, baixa nem compartilha documentos fora da tela de análise.

## 10. Dados pessoais (LGPD)

- Documentos ficam numa área restrita do armazenamento (`restricted/`), legível só por administradores, sem link
  público; cada abertura de documento fica no registro de auditoria.
- Só se pede o necessário para a verificação (princípio da necessidade). Dados fiscais, como o CNPJ, ficam cifrados no
  banco.
- Os documentos servem só a esta verificação e a eventuais revalidações e contestações; a pessoa pode pedir a
  exclusão dos dados pela própria conta, nos termos da Política de Privacidade.

## 11. Como o sistema aplica esta política

| Regra | Onde |
|---|---|
| Aviso à administração por notificação no app e e-mail a cada envio e reenvio | `IssuerReviewService` |
| Destinatários: contas com papel ADMIN, mais `ISSUER_REVIEW_NOTIFY_EMAILS` (padrão: `FAI_ADMIN_EMAIL`) | `IssuerReviewService` |
| Verificações automáticas, código de verificação e catálogo de critérios e motivos | `IssuerVerificationPolicy` |
| Aprovação bloqueada sem e-mail confirmado, com obrigatório em aberto ou do próprio perfil | `AdminService.decide` |
| Recusa e pedido de ajustes exigem ao menos um motivo padronizado | `AdminService.decide` |
| Limite de 5 envios; reenvio só com *Ajustes solicitados* ou *Recusado* | `IssuerReviewService.resubmit` |
| Prazo da primeira análise contado da confirmação do e-mail; dos reenvios, da data do reenvio | `IssuerReviewService.emailConfirmed` |
| Nome civil obrigatório no cadastro de celebridade e em todo reenvio (corrigível; sem ele o reenvio é recusado) | `IdentityService`, `IssuerReviewService.resubmit` |
| Documentos só para ADMIN, com auditoria a cada abertura | `GET /api/admin/approvals/{id}/documents/{tipo}` |
| Checklist, motivos e envios gravados no perfil e na auditoria | migração `V31__politica_verificacao_emissor.sql` |

O envio real de e-mails depende de `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` e de um `RESEND_FROM_EMAIL` num
**domínio verificado no Resend**; sem isso, a notificação no app continua chegando aos administradores.
