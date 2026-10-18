# RF — FAI ATELIER: projetos, identidade e recompensas criativas

**Estado:** proposta; numeração oficial pendente de consulta ao Trello. Não implementado por este documento.
**Destino:** quadro TCC 2026 (Fashion AI) - Bryan,Matheus, lista Requisitos Funcionais.

## Requisito funcional

Permitir que jogar no FLAIR e concluir jornadas criativas desenvolva a identidade de moda do usuário, a história de suas peças e seu quarto, por meio de Projetos de Atelier, recompensas com escolha e uma Peça Assinatura persistente.

A recompensa principal transforma algo que o usuário já possui. FAI Points compram itens; conquistas constroem projetos e desbloqueiam formas de expressão. O quarto torna-se um museu jogável da identidade de moda do usuário.

## Recompensas

| Recompensa | Como conquistar | O que muda |
|---|---|---|
| Assinatura de Aura | Descobrir combinações em partidas | Desbloqueia constelações, circuitos, holografia e animações de entrada nas peças. |
| Memória da peça | Reutilizar uma roupa em desafios diferentes | Acrescenta capítulos visuais com participações, combinações e colaborações. |
| Troféu habitável | Completar uma temporada | Concede um objeto funcional para o quarto: vitrine, luminária, espelho ou mesa que exibe conquistas. |
| Poder de direção | Cumprir missões criativas | Permite escolher condições de uma rodada, personalizar cenário ou organizar desafio próprio. |
| Obra coletiva | Concluir desafios em equipe | Concede partes de uma instalação que se completa em visitas ou colaborações entre participantes. |
| Convite de temporada | Participar de jornada de marca ou celebridade | Abre cenários, histórias e desafios exclusivos daquele perfil. |

## Projetos de Atelier

O usuário escolhe o que quer construir, vê requisitos e acompanha progresso verificável.

**Exemplo: Espelho Constelação FAI.** Descobrir três combinações cromáticas, reutilizar uma peça em dois cenários e concluir um dueto. Ao concluir, o espelho fica disponível no quarto e pode reproduzir apresentações dos looks criados pelo usuário.

Ao concluir uma jornada com escolha, o usuário seleciona uma recompensa entre transformação AURA para uma carta favorita, melhoria funcional para o quarto ou recurso de autoria para criar cenário/desafio. A seleção é confirmada e persistida; uma mesma conquista não pode ser resgatada repetidamente.

## Peça Assinatura

Cada usuário escolhe uma peça favorita e desenvolve sua carta durante partidas: moldura, animações e história visual. Trocar a favorita preserva as conquistas, a história e os desbloqueios anteriores.

## Critérios de aceite

- CA01: apresentar Projetos de Atelier com objetivo, requisitos, recompensas, progresso e estado de conclusão.
- CA02: permitir selecionar um projeto e contabilizar eventos de partidas/jornadas confirmados pelo servidor, sem duplicar progresso por repetição de um evento.
- CA03: oferecer as seis classes de recompensa descritas na tabela, com condições explícitas de obtenção e utilização.
- CA04: permitir concluir o projeto Espelho Constelação FAI ao cumprir três combinações cromáticas, dois cenários com reutilização de uma peça e um dueto.
- CA05: conceder o espelho uma única vez e permitir instalá-lo no quarto e reproduzir apresentações de looks próprios disponíveis.
- CA06: apresentar escolhas de recompensa ao concluir uma jornada configurada com escolhas, confirmar a seleção e impedir resgate duplicado ou de alternativa adicional.
- CA07: permitir escolher e trocar a Peça Assinatura, preservando conquistas, molduras, animações e história de cada peça.
- CA08: registrar capítulos da Memória da peça com participação, combinação e colaboração, respeitando privacidade e acesso aos itens envolvidos.
- CA09: desbloquear efeitos AURA e aplicar os selecionados às peças autorizadas, com prévia, redução de movimento e alternativa estática.
- CA10: integrar objetos funcionais e obras coletivas ao quarto; apresentar os requisitos de colaboração sem exigir que o usuário exponha itens privados.
- CA11: vincular Convites de temporada à marca/celebridade emissora, ao período e às condições de acesso, tratando expiração e cancelamento.
- CA12: conceder poderes de direção dentro dos limites do modo de jogo e das permissões de criação/moderação de desafios.
- CA13: permitir benefícios adicionais de cupons, selos e até 50 FAI Points por conquista, com limites configurados, registro de concessão e prevenção de duplicação.
- CA14: manter Hype baseado em interações reais elegíveis da comunidade; concessão de recompensa, compra ou resgate não acrescenta Hype diretamente.
- CA15: manter progresso e resgates consistentes após reconexão, repetição de solicitação e acesso em outro dispositivo; apresentar carregamento, erro e tentativa novamente.
- CA16: mostrar histórico das conquistas, projetos concluídos e recompensas resgatadas no perfil/quarto conforme a visibilidade escolhida.

## Ciclo de progressão

Jogar → descobrir uma combinação → desenvolver uma peça → concluir um projeto → transformar o quarto → mostrar a criação → colaborar em outra jornada.

## Integrações e arquitetura a definir

FLAIR (RF37), Desafios (RF32), Meu Quarto 3D (RF27), Background Studio/AURA (RF11), FAI Points (RF30/RF41), selos (RF25/RF50) e Hype (RF53). Modelar projetos versionados, requisitos, progresso por usuário, eventos de origem, opções de recompensa, desbloqueios, resgates e capítulos das peças. Resgates e concessões devem ser transacionais e idempotentes. Esta proposta não cria endpoints ou entidades implementadas.

## Testes de aceite previstos

Progresso por evento único; evento repetido; dois usuários isolados; escolha exclusiva; resgate concorrente; troca de Peça Assinatura sem perda; expiração de convite; objeto instalado; obra coletiva incompleta/completa; efeitos com redução de movimento; concessão de 0–50 Points e limites; Hype sem alteração direta; falha de rede e retomada.
