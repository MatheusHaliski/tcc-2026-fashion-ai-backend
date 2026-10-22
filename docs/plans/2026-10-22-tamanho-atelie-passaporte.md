# Plano de implementação: tamanho por produto, criação colaborativa e passaporte da peça

Data: 22/10/2026. Base examinada: checkout `fashionai-vton-gpu`, branch de origem `fix/scheme-ai-and-catalog-retry`, após `b0d3a838`; entrega atual em `fix/social-card-anatomy-and-feature-plan` sobre `94703d23`.

Este documento planeja as três funcionalidades aceitas. **Não significa que os novos serviços, tabelas ou endpoints já existam.** As alterações visuais dos cards de peça/look são uma entrega separada e imediata, não dependem destes módulos e não desbloqueiam direitos de selo/Aura.

## 1. Decisão de produto e ordem de entrega

| Prioridade | Entrega inicial | Problema resolvido | Condição para avançar |
| --- | --- | --- | --- |
| 1 | Recomendação explicável de tamanho para produtos com tabela real | Reduzir incerteza entre o tamanho comercial e o caimento desejado | Tabela por produto/versionada + medidas fornecidas com protocolo compatível |
| 2 | Passaporte privado e histórico de cuidado/reparo, com compartilhamento seletivo | Reaproveitar informações já cadastradas e tornar a segunda vida da peça mais confiável | Separar peça física, produto global, dono e documento de comprovação |
| 3 | Projeto colaborativo, revisões e ficha técnica no FAI Atelier | Transformar inspiração em uma especificação revisável | Direitos de autoria, colaboradores e revisão de modelagem explícitos |
| Posterior | Transferência entre donos, campanhas de demanda e produção física | Conectar histórico e cocriação à circulação/produção reais | Pilotos anteriores avaliados; parceiro, operação e regras comerciais definidos |

A infraestrutura de identidade, permissões, documentos privados e eventos pode ser desenvolvida em conjunto. A priorização favorece primeiro o tamanho, depois um passaporte enxuto e o editor técnico. Não bloquear o piloto de tamanho esperando simulação física ou um modelo generativo.

## 2. O que o sistema já possui e o que falta

Referências relativas abaixo apontam para arquivos reais examinados, não para serviços planejados.

| Base existente | Evidência | Reutilização e lacuna |
| --- | --- | --- |
| Monólito modular Java 21/Spring com domínio, aplicação, infraestrutura, web e bootstrap | [pom.xml](../../pom.xml) | Manter essa divisão; não abrir três microserviços no MVP |
| Produto global, identificação SKU/GTIN/EAN, categoria/subcategoria, variação, atributos e proveniência | [CatalogProduct.java](../../fai-domain/src/main/java/br/com/fashionai/domain/model/CatalogProduct.java) | É a identidade comercial. Não é uma unidade física possuída por alguém |
| Variante por produto, cor/SKU, disponibilidade e preço | [CatalogVariant.java](../../fai-domain/src/main/java/br/com/fashionai/domain/model/CatalogVariant.java) | Não há grade estruturada de medidas/tamanhos neste agregado; não tratar cor como tamanho |
| Peça pessoal com `catalogProductId`, `catalogVariantId`, `sizeLabel`, estado, preço, compra, cuidados, usos e venda/doação | [WardrobeItem.java](../../fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java) | Reutilizar cadastro e ações existentes; não criar outro cadastro de roupas ou outra lista de venda |
| Proporções corporais do avatar com origens `observed`, `user`, `estimated`, `default` | [body-spec.ts](../../lib/avatar3d/body-spec.ts), [AvatarBodyScanService.java](../../fai-application/src/main/java/br/com/fashionai/application/service/AvatarBodyScanService.java) | Largura/profundidade relativas à estatura não são perímetros comerciais verificados. A GPU não elimina a necessidade de medidas compatíveis |
| Contrato da roupa distingue dado confirmado, estimado e ausente; molde visual é aproximação | [garment-contract.ts](../../lib/avatar3d/garment-contract.ts) | A imagem do provador não comprova que um tamanho cabe; recomendação e simulação devem permanecer distinguíveis |
| FAI Atelier com Metamorfoses, Linha do Tempo, Tendências e Conquistas & Quarto | [FAI_ATELIER_HOLOGRAFICO.md](../arquitetura/FAI_ATELIER_HOLOGRAFICO.md), [AtelierController.java](../../fai-web/src/main/java/br/com/fashionai/web/controller/AtelierController.java) | Ampliar com Projetos, sem reescrever galeria/hub. O Atelier atual não é um CAD nem um sistema de ficha técnica industrial |
| Concessões de recompensas auditadas e idempotentes | [AtelierRewardSystem.java](../../fai-application/src/main/java/br/com/fashionai/application/service/AtelierRewardSystem.java), [AtelierGrants.java](../../fai-application/src/main/java/br/com/fashionai/application/service/AtelierGrants.java) | Registrar conquistas a partir de fatos validados pelo servidor; não conceder licença de Aura ou dinheiro apenas por criar um projeto |
| Progresso de nível, ledger e regras de FAI Points | [LevelProgressService.java](../../fai-application/src/main/java/br/com/fashionai/application/service/LevelProgressService.java), [FaiPointsService.java](../../fai-application/src/main/java/br/com/fashionai/application/service/FaiPointsService.java) | A implementação atual deriva nível do acumulado elegível do ledger. Reutilizar essa autoridade; não inventar saldo XP paralelo nem permitir que compra/transferência farme nível |
| Guarda por dono, visibilidade, bloqueio e perfil institucional aprovado | [Guard.java](../../fai-application/src/main/java/br/com/fashionai/application/security/Guard.java) | Ampliar acesso por projeto/instância sem confiar no cliente, URL, selo decorativo ou tipo de perfil isoladamente |
| Eventos de domínio e concorrência otimista | [DomainEvents.java](../../fai-application/src/main/java/br/com/fashionai/application/events/DomainEvents.java), [VersionedAuditableEntity.java](../../fai-domain/src/main/java/br/com/fashionai/domain/model/VersionedAuditableEntity.java) | Reusar eventos/versionamento. Entrega durável a parceiros exige mecanismo adicional de outbox; evento em memória não basta |
| Fotografias com histórico e controle de acesso; porta de mídia | [PhotoService.java](../../fai-application/src/main/java/br/com/fashionai/application/service/PhotoService.java), [MediaStoragePort.java](../../fai-application/src/main/java/br/com/fashionai/application/ports/MediaStoragePort.java) | Reutilizar infraestrutura, adicionando entrega autenticada de comprovantes; não usar URL pública para nota fiscal ou medidas |

As funcionalidades abaixo ampliam a base. Não foi identificado, nos agregados e controllers examinados, um serviço dedicado de recomendação de tamanho por SKU, projeto técnico colaborativo ou transferência de passaporte de uma unidade física. Isso é uma constatação do recorte de arquitetura auditado, não uma declaração de inexistência absoluta em todo documento histórico.

## 3. Fundação comum

### Arquitetura e contratos

- Entidades e estados em `fai-domain`; casos de uso e cálculo em `fai-application`; repositórios, documentos e integrações em `fai-infrastructure`; DTOs validados/controllers em `fai-web`; configuração/flags no bootstrap existente.
- Frontend Next/React nas áreas atuais: catálogo/provador/peça, `/atelier` e guarda-roupa. Criar componentes de domínio; evitar reproduzir formulários/permissões em cada página.
- Novos módulos desativados por configuração no servidor até o piloto; a flag não substitui autorização. Usar o mecanismo de configuração já empregado no projeto, sem introduzir uma plataforma de flags apenas para este MVP.
- Toda entidade com dono/estado tem `version`. Escritas concorrentes levam a `409`; não sobrescrever silenciosamente uma revisão, medida, transferência ou reivindicação.
- Comandos que criam feedback, voto, documento, aceite ou recompensa têm chave de idempotência e restrição única. Tentar novamente após timeout não duplica resultado.
- Payloads públicos usam projeções permitidas, não serialização de entidades completas. Nenhum card/feed passa a carregar medidas privadas, comprovantes ou endereço de outros usuários.
- Identificar unidade, protocolo, fonte, data da fonte e versão das regras. `null`/indisponível nunca vira zero.

### Segurança, privacidade e documentos

Medidas ficam privadas por padrão. O consentimento para estimar medidas a partir de uma foto continua distinto do consentimento para persistir um perfil de medidas ou compartilhá-lo. A medida pode ser fornecida manualmente; não exigir foto, peso ou classificação de gênero para liberar o serviço quando a tabela aplicável não precisar deles.

Reutilizar as políticas de conta, retenção/exportação e acesso. Antes de persistir novos dados sensíveis, validar a disponibilidade da chave de criptografia e o processo de recuperação/rotação; [AesGcmStringConverter.java](../../fai-domain/src/main/java/br/com/fashionai/domain/security/AesGcmStringConverter.java) hoje usa `enc:v1` com chave configurada. Não trocar a chave para “corrigir” dados antigos e não registrar medidas/documentos em logs. Se for necessário suporte a múltiplas chaves, entregar migração e testes de leitura antiga antes de utilizá-lo.

Criar categoria de armazenamento **privado** para recibos, fichas restritas e medidas: acesso pelo backend ou URL assinada de curta duração, com revalidação de dono/participante, MIME real, tamanho, moderação/scan aplicável, remoção de EXIF e expiração de uploads abandonados. A porta existente não deve transformar esses arquivos em `publicUrl` por conveniência.

## 4. Proposta 1 — tamanho por produto e marca

### MVP de experiência

1. Na peça do catálogo/provador, ação “Encontrar meu tamanho”. Exibir fonte e atualidade da tabela antes de pedir medidas.
2. Usuário informa medidas necessárias, com instruções do ponto anatômico e opção de medir uma roupa de referência. Escolhe caimento desejado: ajustado, regular ou solto.
3. Serviço compara apenas medidas e protocolos compatíveis. Retorna tamanhos candidatos e razões por região: dentro da faixa, apertado, folgado ou dado insuficiente.
4. Se faltar tabela/medida essencial ou houver candidatos equivalentes, mostrar a limitação e a tabela disponível, sem forçar uma recomendação.
5. Após provar de verdade, usuário registra tamanho escolhido e avaliação por região. Feedback é privado no MVP e pode ser apagado; não é uma compra comprovada por ter clicado em “Provar”.

O provador recém-simplificado permanece com avatar fixo e somente rotação/zoom. A recomendação aparece como painel textual, sem reintroduzir espelho ou caminhada.

### Dados novos propostos

| Entidade/tabela proposta | Dados essenciais |
| --- | --- |
| `ProductSizeChart` / `product_size_charts` | Produto, variante aplicável opcional, mercado, fonte/autorização, revisão, validade, status de revisão e tipo `BODY_RANGE` ou `GARMENT_MEASUREMENT` |
| `ProductSizeOption` e `ProductSizeMeasurement` | Rótulo original, código de tamanho, ordem explícita, região/ponto, unidade normalizada, mínimo/máximo ou medida da peça e protocolo |
| `FitMeasurementProfile` e `FitMeasurementValue` | Dono, protocolo, medidas em cm, origem manual/observada/estimada, incerteza quando conhecida, data e versão; armazenamento privado |
| `SizeRecommendation` | Dono/produto, versões da tabela/perfil/regras, preferência e resultado explicável, com política de expiração; sem publicar as medidas nos eventos |
| `FitFeedback` | Dono, referência à recomendação/opção, tamanho provado, região e avaliação; fonte declarada ou compra comprovada quando houver evidência |

Não reaproveitar `CatalogVariant` como tabela de grade: sua relação de cor/SKU deve poder apontar para uma ou mais opções de tamanho. Não interpretar `sizeLabel` legado como dimensão física ou lista ordenada universal.

### Motor inicial determinístico

- Tabela `BODY_RANGE`: comparar o perímetro/medida corporal definido pelo fabricante com a faixa correspondente.
- Tabela `GARMENT_MEASUREMENT`: comparar medidas da roupa a medidas compatíveis da pessoa/roupa de referência, com folga declarada e regra específica por família. Largura plana só vira perímetro se o protocolo da própria fonte assim determinar.
- Não converter largura e profundidade do avatar em circunferência “real” por multiplicação arbitrária. Valores `default`/`estimated` não ganham proveniência de medida confirmada.
- Não usar uma constante universal de elasticidade ou folga. Legging com folga negativa precisa de referência de elasticidade/aplicação adequada; na ausência, abster-se.
- Não ordenar P/M/G, números regionais ou tamanhos infantis sem o mapa da tabela. Começar com adultos e duas famílias no piloto, por exemplo jeans e camisetas; não misturar tabelas adulto/infantil ou mercados.
- Estados propostos: `RECOMMENDED`, `AMBIGUOUS`, `NO_CHART`, `INSUFFICIENT_MEASUREMENTS`, `NO_COMPATIBLE_SIZE`. Retornar motivos e dimensões faltantes.
- No MVP, confiança é evidência qualitativa documentada. Percentual de acerto/confiança só entra após calibração com amostra e intervalo de incerteza, sem tratar score heurístico como probabilidade.
- Cache por produto/opção, versão da tabela, perfil, preferência e versão do motor. Mudar medidas/tabela invalida o resultado, não exige reprocessar fotos.

### API proposta, ainda não implementada

| Método/rota proposta | Responsabilidade e autorização |
| --- | --- |
| `GET /api/catalog/products/{id}/size-chart` | Tabela publicável, sem medidas de usuários; respeita visibilidade/estado do catálogo |
| `PUT /api/catalog/products/{id}/size-chart` | Marca responsável aprovada ou curador autorizado; revisão e fonte obrigatórias, `version` esperado |
| `GET/PUT/DELETE /api/me/fit-measurements` | Ler/alterar/apagar apenas o próprio perfil; validação de unidade e protocolo |
| `POST /api/catalog/products/{id}/size-recommendations` | Serviço lê perfil próprio e tabela; cliente não envia “resultado aprovado” |
| `POST /api/size-recommendations/{id}/feedback` | Autor da recomendação, deduplicação por experiência; não aceita feedback em nome de terceiros |

### Aceite e medição de valor

- Sem tabela ou medida essencial, nenhuma recomendação falsa; usuário ainda consegue navegar/comprar pela loja sem bloqueio.
- Casos de teste: cm/polegada, rótulos regionais, tabela de corpo versus peça, entre dois tamanhos, tabela expirada, erro de fonte, mudança de medida, perfil de outro dono e regras de elasticidade ausentes.
- Teste de contrato API→UI e fluxo no navegador com dados conhecidos; teste de carga/cache sem processar GPU a cada pedido.
- Piloto com produtos cuja tabela foi revisada. Medir cobertura do catálogo, taxa de abstenção, entendimento dos motivos, concordância após prova e mudança de escolha. Redução de devoluções só é afirmada com dados de venda/devolução e comparação válida; cliques no provador não comprovam esse resultado.

## 5. Proposta 2 — projeto colaborativo no FAI Atelier

### MVP de experiência

Adicionar **Projetos** ao hub atual, preservando Metamorfoses, Linha do Tempo, Tendências e Conquistas & Quarto. Um projeto reúne briefing, referências autorizadas, família/modelagem, medidas, materiais, cores, construção (bolsos/gola/mangas/fechos), observações e colaboradores.

O editor inicial é formulário estruturado com vistas e anotações, comentários e comparador de versões. A exportação gera PDF/JSON com versão, autor e estado de revisão. Uma ficha sem revisão técnica continua “rascunho”; não chamá-la de molde industrial nem de peça pronta para fabricar. Preview 3D é opcional e ilustrativo, respeitando o contrato atual de aproximação.

### Dados e estados novos propostos

- `DesignProject`: dono, título, briefing, visibilidade e estado.
- `DesignProjectMember`: convite/aceite e papéis `OWNER`, `EDITOR`, `REVIEWER`, `VIEWER`; escopo por projeto, não nova autoridade global sobre a marca.
- `DesignRevision`: snapshot imutável, revisão-pai, autor e licença de contribuição. Editor trabalha em rascunho e publica uma revisão; restauração cria outra revisão sem apagar histórico.
- `TechPack`: medidas por protocolo, gradação quando conhecida, materiais/componentes, acabamentos, vistas e anexos; referência à revisão exata e revisão técnica por especialista identificado.
- `DesignComment` e `DesignReview`: comentário por campo/vista/revisão e decisão de revisão. Aprovação de marca e aprovação de modelagem são capacidades distintas.
- `DesignVote`: votação autenticada sobre uma revisão/campanha específica, prazo e voto único alterável; não reutilizar votos de partidas FLAIR como demanda por fabricação.
- Estados iniciais: `DRAFT → IN_REVIEW → APPROVED_FOR_SHOWCASE → ARCHIVED`; `CHANGES_REQUESTED` volta para novo rascunho. `APPROVED_FOR_PRODUCTION` fica reservado à fase com revisão técnica e parceiro.

### API proposta, ainda não implementada

- `POST /api/atelier/projects`; `GET /api/atelier/projects/{id}`; `PUT /api/atelier/projects/{id}` com controle de dono/participante e versão.
- `POST /api/atelier/projects/{id}/invites` e aceite vinculado ao convidado; revogar membro não remove sua autoria das revisões anteriores.
- `POST /api/atelier/projects/{id}/revisions`; `GET /api/atelier/projects/{id}/revisions` com paginação; versão-pai divergente retorna conflito.
- `POST /api/atelier/projects/{id}/comments`; `POST /api/atelier/projects/{id}/reviews`; exportação autenticada da ficha de uma revisão.
- `PUT /api/atelier/projects/{id}/votes/me` para voto único em revisão publicada, respeitando bloqueios, prazo e política antiabuso.

### Autoria, Auras e recompensas

Contribuição exige licença/autorização explícita para referências e arquivos; remoção/moderação tem trilha de auditoria. Crédito de autoria permanece ao publicar e ao derivar uma revisão. A licença de um projeto não dá licença automática para usar logo, nome de celebridade, imagem de pessoa ou arte comprada.

Usar o comércio/licenciamento já existente de Aura e seus campos completos de configuração. Uma Aura associada à futura edição física requer concessão emitida pelo serviço responsável, com proprietário, validade e termos; não transferir uma licença porque o cliente copiou o JSON de um preset.

FAI XP/Points podem reconhecer revisão técnica/contribuição concluída, conforme regra de servidor e limite vigente. Criar projeto, subir arquivo, votar ou comentar repetidamente não concede saldo por padrão. Reusar idempotência da origem e `AtelierRewardSystem.grant` em evento confirmado `ATELIER_PROJECT`; o grant de conquista não compra uma peça nem substitui o entitlement da Aura.

### Etapa posterior: demanda e produção

Primeiro implementar “Tenho interesse”, sem cobrança e sem promessa de entrega. Voto não é pedido pago. Só abrir pré-venda quando houver parceiro de produção aprovado, ficha revisada, orçamento, quantidade mínima, capacidade, prazos, estoque/reserva, frete, suporte, cancelamento/reembolso e tributação definidos.

Produção real exige novos agregados de campanha/pedido e integração de pagamento com reconciliação/outbox e webhooks idempotentes. **FAI Points não viram dinheiro nem meio de cobrança de roupa física por inferência.** O ledger atual da loja virtual não é um checkout de mercadoria. Essas integrações ficam fora do MVP.

### Aceite e medição de valor

- Colaborador não convidado não lê projeto privado; revogado não escreve; bloqueio é respeitado.
- Duas edições simultâneas não apagam uma à outra; exportação e votos apontam à revisão correta.
- Ficha incompleta não obtém estado de produção. Nenhum arquivo é publicado sem direitos/visibilidade compatíveis.
- Testes de convite expirado, revogação, fork/restauração, exclusão de conta, exportação protegida, duplicação de voto e reconciliação de recompensa.
- Medir projetos com ficha completa, revisões necessárias, participação útil, tempo de revisão e interesse confirmado. Não equiparar número de likes a viabilidade industrial.

## 6. Proposta 3 — passaporte e segunda vida da peça

### MVP de experiência

Na peça do guarda-roupa, adicionar **História & cuidados** com dados de origem já cadastrados, anexos privados, composição quando conhecida, manutenção e reparos. Exibir sempre a proveniência: “informado pelo dono”, “comprovante apresentado”, “validado pelo emissor” ou “não verificado”.

O usuário escolhe o que compartilhar. Um link/QR revogável abre somente uma projeção pública aprovada pelo dono; não expõe recibos, CPF, endereço, comprador anterior ou medidas. QR é um ponteiro para o registro e pode ser copiado: não é prova de autenticidade do produto físico.

Venda/doação usa `forSale`/`forDonation` e o anúncio de peça já existente, acrescentando o resumo autorizado do passaporte, sem duplicar catálogo ou anunciar peça apagada/indisponível. Começar pelo histórico privado; transferência entre donos vem depois.

### Modelo novo proposto

| Entidade/tabela proposta | Função |
| --- | --- |
| `GarmentPassport` | ID opaco da unidade física, vínculo comercial opcional e estado; não tratar produto global/GTIN como número de série de uma unidade |
| `PassportHolding` | Relação temporal de dono com a peça pessoal; somente uma posse ativa por passaporte, com histórico de início/fim |
| `PassportEvent` | Compra declarada, cuidado, reparo, verificação ou transferência, com autor, fonte e correções por novo evento; histórico não é livremente reescrito |
| `PassportEvidence` | Chave privada de arquivo, tipo, dono/controlador, finalidade, status de validação e política de retenção |
| `PassportShare` | Escopo público escolhido, token aleatório armazenado em hash, validade/revogação; rate limit para consulta |
| `PassportClaim` | Alegação verificável específica, emissor, evidência, resultado e revogação; sem “autêntico” global baseado em uma foto |
| `PassportTransfer` | Oferta de transferência a destinatário, validade, estado, versões esperadas, aceite/cancelamento e idempotência |

Dois usuários podem cadastrar duas cópias digitais do mesmo modelo: isso não cria prova de que são a mesma unidade física. A criação inicial do passaporte registra essa limitação; reforço de identidade pode usar serial emitido pelo fabricante ou verificação operacional posterior. Foto/histórico semelhantes geram revisão, não fusão automática de posses.

### API proposta, ainda não implementada

- `POST /api/pieces/{id}/passport`: dono da peça, chave idempotente, sem permitir outro passaporte ativo para o mesmo vínculo.
- `GET /api/pieces/{id}/passport`: dono/escopo permitido, com projeção privada distinta da pública.
- `POST /api/passports/{id}/events`; `POST /api/passports/{id}/evidence`: proprietário atual ou prestador autorizado para aquele evento, sem autoaprovação de alegações.
- `POST /api/passports/{id}/shares` e revogação; `GET /api/passport-shares/{token}`: retorna só dados publicáveis e oculta tokens/PII dos logs.
- Fase posterior: `POST /api/passports/{id}/transfers`, `POST /api/passport-transfers/{id}/accept` e cancelamento. Duas partes autenticadas, prazo, desafio de destinatário e controle de concorrência.

### Transferência, autenticidade e exclusão

Transferir passaporte não é executar `/api/pieces/{id}/copy`: copiar uma peça não transfere posse. No aceite, uma transação encerra a posse anterior e cria o vínculo do destinatário, preservando autoria de fotos/looks anteriores e respectivas visibilidades. Não transferir endereço, comprovante pessoal, licença de Aura, saldo ou recompensas. Rever uso da peça antiga em looks privados/públicos sem reatribuir a autoria histórica.

Uma alegação de autenticidade só é confirmada para a afirmação específica e por emissor autorizado, com referência verificável e possibilidade de revogação/contestação. Perfil de marca aprovado ajuda a identificar o emissor, mas não prova a origem de cada peça. Selos Hype medem reconhecimento/estado do app, não autenticidade física ou sustentabilidade.

Excluir conta/arquivo exige política de retenção definida: apagar/anomizar dados pessoais conforme finalidade e obrigações aplicáveis; preservar apenas eventos não pessoais quando houver base para isso. A trilha de auditoria não autoriza guardar recibos para sempre. Hash de arquivo não substitui essa política nem torna o documento original inacessível a quem possui cópia.

### Recompensas e resultados

No piloto, registro de cuidado/reparo é histórico, sem pontuação automática. Recompensar reparo/reutilização apenas após regra e confirmação suficientes, com limites por unidade/evento e proteção contra transferências circulares entre contas. Reusar o ledger e conceder capítulos `garmentMemory` pela autoridade do servidor; será necessária uma integração/regra nova, porque os grants atuais não representam reparos físicos.

Não estimar CO₂, água economizada ou percentual de circularidade a partir da contagem de eventos sem metodologia/dados verificáveis.

### Aceite e medição de valor

- Recibo nunca aparece no card, HTML público, Open Graph, exportação pública ou link de QR.
- Usuário consegue corrigir alegação, revogar link e apagar evidência conforme a política; correção é distinguível do evento anterior.
- Concorrência entre dois compradores não cria dois donos ativos. Retry de aceite não duplica posse/recompensa; convite expirado/cancelado não transfere.
- Testar autorização por objeto/arquivo, revogação, busca pública, exclusão/exportação de conta, produto retirado do catálogo, compra declarada versus comprovada e transferência com conflitos.
- Medir passaportes com dados úteis, reparos registrados, uso de compartilhamento e transferências aceitas sem disputa. Impacto em confiança/revenda exige pesquisa/piloto; não inferir valor de mercado apenas de Hype.

## 7. Migrações, integração e entrega segura

As migrações reais ficam em `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/`. Não reservar números aqui: ler a última versão no momento do desenvolvimento e coordenar com branches paralelas. Não modificar migrations já aplicadas.

1. Criar tabelas novas, índices de dono/produto/estado/data e FKs com política de exclusão explícita. Usar expansão compatível: endpoints atuais seguem funcionando sem linhas nos novos módulos.
2. Inserir apenas referências de peças existentes; não classificar retrospectivamente origens/recibos como verificados. Não transformar cadastros antigos em posses físicas certificadas.
3. Fazer importação de tabelas por fonte autorizada em job paginado/reexecutável, com relatório de recusas e revisão humana. Documentar esquema e unidade do CSV/JSON, sem interpretar imagem de tabela automaticamente como dado aprovado.
4. Publicação e transferência exigem controle transacional; arquivos/job exports ficam fora da transação longa e têm limpeza de órfãos. Se houver pagamento/parceiro externo, usar outbox durável e consumidor idempotente.
5. DTOs acrescentam campos opcionais ou rotas novas, com contratos e estados de erro documentados. Não fazer as listagens/feed dispararem cálculo de tamanho ou leitura de documentos por card.
6. Reusar eventos existentes quando o significado for idêntico (`PieceWorn`, por exemplo); criar eventos específicos de revisão/reparo/transferência quando não for. Não emitir `PieceCreated` artificial para ganhar pontos em cada revisão.
7. Lançar por coorte de produtos/contas autorizadas; registrar versão da regra, motivo e latência sem dados pessoais. Rollback desativa a flag e interrompe novas operações, preservando dados/eventos; nunca desfaz posse ou pedido pago apagando tabelas.

## 8. Fases, dependências e estimativas condicionais

Estimativas iniciais em semanas de execução para uma pequena equipe com backend, frontend e QA disponíveis. Não são compromisso de prazo: variam com acesso a tabelas reais, decisão de privacidade, designer de moda/modelista e parceiros. Uma única pessoa trabalhando sequencialmente terá calendário maior; tarefas paralelas não devem ser somadas como prazo fechado.

| Fase | Trabalho | Dependência | Faixa inicial |
| --- | --- | --- | --- |
| 0 | Inventário de dados, protocolo de medidas, produto piloto, contratos de permissão/privacidade e critérios de piloto | Responsáveis de produto e fontes de marca | 1–2 semanas |
| 1 | Base de tabelas/perfis privados e motor determinístico, UI no catálogo/provador, feedback e testes de tamanho | Fase 0 e tabelas revisadas de duas famílias | 3–5 semanas |
| 2 | Passaporte privado com documentos, cuidados, compartilhamento seletivo e projeção de venda existente | Regras de retenção/identidade e infraestrutura privada | 2–4 semanas; parte pode ocorrer em paralelo com fase 1 |
| 3 | Projetos do Atelier, membros, revisões, comentários, ficha técnica e exportação | Autoria/licenciamento e revisão de modelista | 4–6 semanas |
| 4 | Piloto de voto/interesse, transferências e verificação de alegações | Resultados das fases 2/3, política antiabuso e suporte | 2–4 semanas adicionais |
| 5 | Produção/pré-venda/pagamento/logística | Parceiro, contratos, operação e estudo de viabilidade | Estimar separadamente após piloto; fora do escopo inicial |

Portões de liberação: contratos de acesso e dados passam antes do piloto; qualidade de recomendação é medida com pessoas/produtos reais; fabricação só é liberada após aprovação técnica e comercial. Nenhum calendário substitui esses critérios.

## 9. Plano de testes e observabilidade

- **Domínio:** regras puras de comparação/protocolo; máquina de estados; concorrência, idempotência, validade e autoria; casos de ausência de dados em vez de defaults fictícios.
- **Persistência/API:** migrations em MySQL de teste, isolamento entre contas, projeções públicas, permissões de marca e documentos privados. Ensaiar atualização de versão antiga do app e migração com dados existentes.
- **Integração:** falha de upload/storage, timeout após commit, repetição de evento, perda de membro/permissão e retomada de exportação. Não manter transação SQL aberta durante rede/GPU.
- **Navegador:** desktop/mobile, teclado/leitor de tela, labels/unidades, campos de medida com instruções, estados sem tabela, erro recuperável e transferência/revogação. No Atelier, conflito de revisão deve ser compreensível e preservar rascunho.
- **Piloto real:** tabela e fita métrica revisadas por profissional para tamanhos; usuários autorizados e recibos de teste para passaporte; modelista revisa ficha técnica. Teste unitário ou screenshot de manequim não prova caimento nem capacidade fabril.
- **Métricas:** contadores de cobertura, estados de abstenção, conclusão/erro por etapa e tempo por operação. IDs de recurso e versão de algoritmo são suficientes; não registrar medidas, imagem de corpo, comprovante, token de compartilhamento ou endereço.

## 10. Backlog inicial pronto para detalhamento

1. Documentar protocolo/unidades e selecionar produtos/tabelas com licença e revisão.
2. Especificar modelos de tamanho sem misturar variantes de cor, peça plana e perímetros corporais.
3. Implementar autorização e armazenamento privado para medidas/documentos com exportação/exclusão testadas.
4. Entregar motor determinístico, estados de abstenção e painel explicável; só depois avaliar aprendizado com feedback consentido.
5. Entregar passaporte privado reaproveitando compra/cuidados/estado do guarda-roupa e sem selo automático de autenticidade.
6. Definir unidade física e protocolo de transferência antes de expor um aceite entre donos.
7. Adicionar Projetos ao Atelier e implementar versões/membros antes de voto e recompensa.
8. Gerar ficha técnica de uma revisão com campos faltantes explícitos e aprovação de profissional.
9. Integrar conquistas por fatos de domínio, sem alterar silenciosamente economia de XP/Points ou direitos de Aura.
10. Conduzir pilotos, decidir critérios de avanço e só então contratar/implementar produção e checkout de mercadoria física.

Este plano não depende de contratar um serviço novo de IA no início. IA pode auxiliar extração de tabela ou redação de briefing como sugestão revisável; ela não aprova medida, autoria, autenticidade, licença ou fabricação.
