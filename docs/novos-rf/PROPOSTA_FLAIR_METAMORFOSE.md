# RF — FLAIR METAMORFOSE

**Estado:** proposta aceita para esta edição; numeração oficial pendente de consulta ao Trello. Especificação, ainda sem implementação do jogo.

## Requisito funcional

Permitir que o usuário jogue FLAIR Metamorfose com cartas de seu guarda-roupa, descobrindo combinações, adaptando looks a cenários dinâmicos e conquistando apresentações visuais colecionáveis para suas peças.

## Experiência

As roupas viram cartas vivas e as combinações provocam transformações no cenário. A fotografia conserva os detalhes originais e recebe apresentações AURA: scanner, destaque de detalhes, revelação de logo e entrada na cena. A peça pode ser mostrada dobrada na mesa, no cabide ou vestida no avatar, conforme os recursos visuais disponíveis.

1. Entrar com um deck de peças próprias elegíveis.
2. Receber cenário e missão, por exemplo Festival no bosque: tons terrosos com um elemento inesperado.
3. Receber uma mão de cartas e escolher quais jogar ou guardar.
4. Ativar reações visuais e habilidades segundo regras explícitas.
5. Receber mudança de condição: chuva, noite ou troca de palco.
6. Adaptar o look e finalizar a criação.

| Combinação | Reação |
|---|---|
| Duas peças com uma cor em comum | Conexão cromática: circuito luminoso une as cartas. |
| Peça básica + detalhe marcante | Ponto de ruptura: destaque recebe transformação AURA. |
| Mesma peça em três interpretações diferentes | Metamorfose: apresentação especial da carta. |
| Look adequado à mudança do cenário | Virada de palco: ambiente muda e abre nova jogada. |

## Critérios de aceite

- CA01: permitir montar e selecionar deck com peças próprias elegíveis, preservando identificação, foto e atributos reais.
- CA02: iniciar partida com cenário, missão, mão de cartas e regras de combinações consultáveis.
- CA03: oferecer um primeiro cenário, três rodadas e seis combinações descobríveis; documentar as seis regras antes da validação do MVP.
- CA04: permitir jogar e guardar cartas, apresentando efeitos e consequências antes da confirmação quando aplicável.
- CA05: reconhecer combinações segundo regras versionadas e ativar reação visual e habilidade correspondentes.
- CA06: incluir Conexão cromática, Ponto de ruptura, Metamorfose e Virada de palco entre as combinações, com requisitos explícitos.
- CA07: introduzir mudanças de cenário entre rodadas e permitir adaptar o look às novas condições.
- CA08: manter pontuação da partida e habilidades separadas do Hype global real exibido na caixa LED da peça.
- CA09: registrar combos descobertos em álbum e permitir consultar suas regras e reutilizá-los em outros cenários.
- CA10: oferecer Duelo de interpretações com tema comum e resultados individuais, sem permitir alterar cartas ou decisões de outro jogador.
- CA11: permitir temporadas de marcas/celebridades com identidade visual, início, expiração, requisitos de acesso e recompensas explícitas.
- CA12: ao concluir, permitir salvar o look e uma composição visual da cena no perfil, respeitando visibilidade e moderação.
- CA13: integrar a Carta Assinatura à Peça Assinatura do FAI ATELIER, preservando foto, detalhes, história e desbloqueios ao trocar a favorita.
- CA14: conceder apresentações AURA, molduras e animações após eventos confirmados, com resgate idempotente e sem aumentar Hype diretamente.
- CA15: tratar desconexão, retomada, deck sem peças elegíveis, expiração de temporada e dispositivo sem renderização 3D; oferecer apresentação 2D acessível.
- CA16: respeitar redução de movimento, controles de áudio, teclado e descrições das reações que não dependam apenas de cor/animação.

## Integrações

FLAIR (RF37), Desafios (RF32), AURA/Background Studio (RF11), Hype (RF53), Meu Quarto (RF27) e [FAI ATELIER](PROPOSTA_FAI_ATELIER.md). PASSA O LOOK pertence aos critérios da aba Desafios, não constitui RF separado.

## Validação prevista

Combos positivos e negativos; mudança de cenário; escolha de guardar carta; três rodadas; repetição de eventos sem recompensa duplicada; Hype global inalterado pelas habilidades; privacidade do deck; retomada; duelo; temporada expirada; resultado salvo; Carta Assinatura preservada; apresentação com redução de movimento.
