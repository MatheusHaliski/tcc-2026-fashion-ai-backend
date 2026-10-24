# Atelier colaborativo de peças físicas

O Atelier abre em **Projetos**. A tela permite criar uma peça com briefing e especificação de construção, convidar colaboradores, publicar revisões e exportar a ficha técnica. Os acessos existentes continuam em `/atelier?tab=metamorphoses`, `timeline`, `trends` e `room`, usando o `AtelierHub` original, suas Auras, recompensas e serviços.

## Fluxo entregue

1. O autor cria um projeto privado por padrão e declara autorização para referências e contribuições.
2. O formulário registra família, modelagem, tecido/composição/gramatura, cores, bolsos, gola, mangas, fechos, acabamentos, estampa, vista frontal, vista posterior, créditos e observações. Medidas de peça são registradas em centímetros com ponto e protocolo de medição.
3. O autor convida uma conta por nome de usuário. O convite expira em sete dias e só concede colaboração após aceite pelo destinatário.
4. Autor e editores salvam o rascunho. Publicar exige consentimento específico e cria uma cópia imutável, com autor, número, revisão anterior e eventual revisão usada como origem de uma restauração.
5. Participantes comentam uma revisão e um campo/vista. Um revisor convidado solicita ajustes ou aprova a exposição. O próprio autor da revisão não pode aprová-la.
6. O histórico permite comparação de especificações e restauração como novo rascunho, preservando o histórico publicado.
7. Uma revisão pode receber interesse, retirável e único por pessoa, até o prazo configurado. O prazo é opcional e limitado a 90 dias.
8. A ficha técnica da revisão pode ser exportada em JSON ou aberta em página autenticada para impressão/PDF.

O desenho da tela inicial é uma referência esquemática fixa. As vistas e os detalhes da peça são descrições estruturadas; este módulo não inclui editor vetorial, geração de moldes ou upload de arquivos.

## Acesso e integridade

Projetos usam a visibilidade já existente (`PRIVATE`, `FOLLOWERS`, `PUBLIC`). O índice lista projetos próprios e aqueles com participação aceita. A visibilidade de leitura não concede edição, comentários ou revisão. Bloqueios entre contas continuam prevalecendo sobre os convites. Revogar a participação remove os privilégios de colaboração e de voto. Projetos arquivados permanecem legíveis para quem tem acesso, com histórico e exportação.

Todas as mutações passam pela política de conta existente (`Guard.requireCanCreate`), inclusive verificação de e-mail e restrições de conta. O servidor determina capacidades; nenhum campo de recompensa, selo, licença de Aura, cobrança ou aprovação industrial faz parte dos comandos aceitos.

As gravações que alteram o projeto verificam `expectedVersion` sob bloqueio pessimista da linha. Duas edições/publicações/decisões concorrentes com a mesma versão não sobrescrevem silenciosamente uma à outra: uma recebe HTTP 409. O formulário preserva o rascunho local, mostra a versão atual e exige escolha explícita de uma nova base para salvar. Este rascunho local permanece no formulário durante a sessão; não há recuperação persistente após recarregar a página.

Criação, publicação, comentário e análise usam chaves de requisição com validação do conteúdo ao repetir o comando. A criação compara também a visibilidade. Publicações mantêm unicidade por projeto/número e projeto/chave. O voto usa unicidade por revisão/pessoa e o mesmo bloqueio de projeto para serializar tentativas concorrentes.

Família, modelagem, tecido e pelo menos uma medida válida com protocolo são necessários para aprovar a exposição. Elementos nulos de medidas são rejeitados pela validação de entrada e tratados como incompletos na leitura de dados existentes. O estado da ficha é obtido pelas análises da revisão exportada, sem depender das últimas 50 análises de outras revisões.

## Privacidade e exclusão

`AtelierAccountDataCleanup` implementa a extensão `AccountDataCleanup` chamada no mesmo processo transacional de exclusão definitiva de conta. A limpeza funciona mesmo com o módulo desabilitado.

- Projetos do titular e seus registros dependentes são removidos.
- Convites/participações, comentários, análises e votos do titular em outros projetos são removidos.
- Contribuições publicadas sob a autorização de colaboração em projetos de terceiros mantêm especificação e linhagem, com autor substituído pelo UUID anônimo. Identificadores do autor nos campos de auditoria da revisão e do último editor do projeto também são removidos.
- Uma aprovação de exposição feita pelo revisor excluído volta a análise quando corresponde à revisão atual.
- Projetos de autor com estado `DELETED` ficam indisponíveis por detalhe/exportação/escrita, listagem de participante e convites, mesmo antes de eventual saneamento de dados antigos.

Não foram introduzidos uploads, URLs públicas de armazenamento ou dados de pagamento. A página imprimível usa texto escapado pelo React.

## API e implantação

Base autenticada: `/api/atelier/projects`. Há rotas de listagem/criação/detalhe/atualização, arquivamento, histórico/publicação, convites/aceite/revogação, comentários, análises, voto próprio e ficha técnica por revisão. A exportação JSON retorna `Cache-Control: no-store`.

A migração `V79__collaborative_atelier.sql` cria as seis tabelas `atelier_projects`, `atelier_project_members`, `atelier_project_revisions`, `atelier_project_comments`, `atelier_project_reviews` e `atelier_project_votes`, com índices, chaves estrangeiras e restrições únicas. Aplicar pelo fluxo Flyway habitual. A propriedade `fashion.atelier-projects.enabled` controla a API e tem padrão `true`; quando desabilitada, as rotas retornam 503. A limpeza de conta continua ativa.

As novas traduções são mantidas nos fragmentos `work/atelier-i18n-pt-BR.json`, `work/atelier-i18n-en.json` e `work/atelier-i18n-es.json`, para integração com os catálogos compartilhados sem sobrepor alterações de outros módulos.

Projetos, interesse e aprovação de exposição não constituem compra, reserva, pré-venda, promessa de entrega, certificação de modelagem ou aprovação de produção. Fabricação, pagamentos e validação industrial exigem uma etapa posterior.
