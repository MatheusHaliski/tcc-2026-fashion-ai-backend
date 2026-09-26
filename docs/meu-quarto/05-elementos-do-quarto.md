# 05 — Elementos do Meu Quarto

Todos os elementos físicos do Meu Quarto espalhados pelas especificações (RF27 a RF32 do Trello e os detalhes de
engajamento). As especificações anteriores estão em [`docs/meu_guarda_roupa/`](../meu_guarda_roupa/) (`01` a `04`).
As fases são as do plano de entrega: 1 = núcleo útil, 2 = inteligência, 3 = gamificação, 4 = comunidade.

A coluna **No código** diz onde o elemento está implementado. A cena é toda procedural (React Three Fiber, sem
modelos externos):

- cena: `components/room3d/room-scene.tsx`;
- objetos: `components/room3d/room-props.tsx`;
- página e diálogos: `app/(app)/room/page.tsx`;
- dados: `RoomService.render` (`GET /api/me/room`).

## Móvel inicial: FAI Origem

| Elemento | Onde fica | Para que serve | O que mostra | RF | Fase | No código |
|---|---|---|---|---|---|---|
| **Portas 1–4 com cabideiro** | parte de cima de cada compartimento | guardar peças superiores, vestidos e casacos | abrem com animação; acendem quando o Vista-me aponta uma peça ("Porta 2") | RF27 | 1 | `DoorBay` (`lit` vem da `sequence` do Vista-me) |
| **24 gavetas (3×2 por compartimento)** | abaixo das portas | peças inferiores, acessórios e íntimas | têm rótulo (Jeans, Academia, Praia…); acendem no Vista-me; vazias mostram sachê de lavanda e uma meia sem par | RF27 | 1 | `Drawer` + `EmptyDrawerCharm`. Tocar na meia abre "Adicionar peça a esta gaveta" |
| **Maleiro** | topo do móvel | guardar os esquemas salvos | cada look é uma Caixa de Look com o outfit card na frente | RF27 | 1 | `LookBox` (`top.lookBoxes`) |
| **Base de calçados** | rodapé do móvel | sapatos enfileirados | acende no Vista-me; vira Sapateira no nível Closet | RF27 | 1 | fita de LED da base; prateleira inclinada e rótulo "Sapateira" no Closet |
| **Cabide especial** | dentro das portas | marcar peça favorita | cabide diferenciado | RF27, RF31 | 1 | `Hanger gold` (dourado com ombreiras de veludo) |
| **Poeira e teia** | sobre a própria peça | sinalizar peça esquecida (60+ dias sem uso) | somem com um "puff" e o cabide balança quando a peça volta a um look | RF27 | 1 (efeito do puff: fase 2) | véu de poeira + `Cobweb`; `DustPuff` (≤ 400 ms) e balanço do `HangingPiece`. Nenhum dos dois roda com "reduzir movimento" |
| **Etiqueta costurada** | no detalhe da peça | ficha da peça | lavagem, composição, origem e contador de usos, com ponto dourado ao chegar a 30 usos | RF27 | 2 | tocar numa peça abre o diálogo "Etiqueta costurada" (`GET /api/pieces/{id}/tag`); `GoldDot` na peça com 30 usos |
| **Croqui** | no lugar da foto | peça sem foto aprovada | desenho técnico que ganha cor quando a foto é aprovada | RF27 | 1 | `sketchDraw` por categoria; transição de ~600 ms do croqui para a foto |
| **Logo FAI** | nas portas e gavetas | identidade de fábrica | vira monograma com as iniciais do usuário a partir do nível Studio | RF27, RF28 | 1 / 3 | `DoorMark` (FAI → monograma de `PUT /api/me/room/monogram`) |

## Objetos do quarto

| Elemento | Onde fica | Para que serve | O que mostra | RF | Fase | No código |
|---|---|---|---|---|---|---|
| **Smart Mirror (espelho)** | ao lado do móvel | montar looks arrastando peças; botão ✨ Vista-me | Look do Dia montado; post-it com o que falta ("faltou o sapato"); fecho com luz subindo; tema da Batalha na Passarela escrito no vidro | RF28 | 1–2 | `Mirror`: botão "+ ✨ Vista-me" ao lado do móvel, peças penduradas (`GET /api/me/mirror`), post-it, faixa de luz subindo ao "Usar este look" e o tema de `tema_espelho` · **item modular da loja** (`slotType = MIRROR`, moldes `ESP-RET` retangular, `ESP-ARC` arco, `ESP-OVL` oval, `ESP-CAM` camarim com luzes; material e cor da moldura como qualquer componente) · **botões 3D dentro do vidro** (RF28): ✨ Vista-me, Usar este look, Outra sugestão, Tira uma coisa (`GlassButton` em `Mirror`) |
| **Busto de costura (Copilot)** | canto do quarto | presença física do Copilot | vira quando o usuário fala e aponta a posição citada na resposta, sem rosto humano | RF10, RF27 | 2 | `DressForm`: aponta o `roomHighlight.moduleId` devolvido por `POST /api/copilot/messages` |
| **Cesto de roupa** | ao lado do móvel | peças indisponíveis | peça "para lavar"; aceita ir ao espelho, mas não vira Look do Dia | RF27, RF31 | 1 | `Basket` com a etiqueta "para lavar" |
| **Arara do Desapego** | perto do móvel | peças à venda | etiqueta de preço; selo Garimpo para peças de brechó | RF27 | 2 | `SaleRack` com `salePrice` e o selo `GARIMPO` |
| **Cadeira** | canto do quarto | peças que não cabem no nível atual | pilha visual que nunca bloqueia o cadastro | RF27 | 1 | `Chair` |
| **Vitrine da Peça Ícone** | destaque no quarto | a peça-assinatura do DNA de Estilo | peça exposta | RF27 | 1 | vitrine de vidro com a peça `ICONE` |
| **Interruptor de luz** | parede | alternar tema claro e escuro | sincronizado com as Configurações (RF23) | RF27 | 1 | `LightSwitch`: grava `theme` em `PUT /api/me/preferences`, a mesma preferência das Configurações |
| **Janela e iluminação** | ambiente | luz do horário real | manhã fria, tarde dourada, abajur à noite; decoração discreta em datas sazonais | RF27 | 1 (datas sazonais: fase 4) | `RoomWindow` (céu e luz por `ambient.period`), `Lamp` à noite, bandeirinhas (junho), luzinhas (dezembro) e "Vista o que você tem" (abril) |
| **Luzes do closet** | todo o ambiente | comemorar marcos do Inventory Score | acendem, e aparece uma animação de conquista no espelho | RF29 | 2 | `ClosetLights`: uma luz por faixa (Organizado → Maison Closet); marco novo → `Sparkles` no espelho (`closetLights` no `GET /api/me/room`) |
| **Caixa FAI** | chão do quarto | entrega de item comprado | unboxing, e o item se monta sozinho | RF30 | 3 | `FaiBox`: itens comprados e não aplicados (`unboxing`); ao tocar, a tampa abre e o item é aplicado ao primeiro módulo compatível |
| **Gancho da Chave do Quarto** | perto da porta | convites | chave pendurada; quem a recebe pode visitar o quarto e entrar em desafios | RF27, RF32 | 4 | `KeyHook` (`keys`), diálogo para entregar a chave (`POST /api/me/room/keys`) |

## Módulos liberados por nível (RF30)

| Elemento | Nível | Para que serve | No código |
|---|---|---|---|
| **Iluminação guiada** | Studio | luz personalizável | controle "Luz" (2700–6500 K) → `PUT /api/me/room/light`; fita de LED sob o maleiro e a luz interna das portas |
| **+2 módulos** | Loft | mais espaço e mais categorias de gaveta | extensão de 1,8 m à direita: portas 5–6 e gavetas 25–36 |
| **Sapateira, vitrine de bolsas, porta-joias** | Closet | um lugar próprio para cada categoria | base vira Sapateira; `BagDisplay` com o porta-joias em cima |
| **Ilha central (bancada de looks)** | Atelier | comparar 2 ou 3 looks lado a lado | `Island` com até 3 outfit cards |
| **Troca de estação no maleiro** | Penthouse | guardar peças fora de estação, que o Vista-me passa a ignorar | caixa "Fora de estação" no maleiro, com a contagem do módulo `season` |
| **Closet de assinatura** | Maison | itens exclusivos e Colabs Maison | filetes dourados e a placa "Closet de assinatura" com o monograma |
| **Acabamentos da loja** | todos | portas, frentes de gaveta, puxadores, cabides e logo, no sistema Molde + Acabamento | cada porta e gaveta usa o `finish` do próprio módulo; os puxadores usam o `finish` de `handles` |

## Elementos que só aparecem com desafio ativo (RF32, fases 3–4)

Todos vêm de `decorations` (`ChallengeService.decorations`) e somem quando o desafio termina.

| Elemento | Desafio | O que mostra | No código |
|---|---|---|---|
| **Quadro de cortiça** | 10×10 | os 10 dias, com cada look preso como polaroide | `CorkBoard` (`quadro_cortica.polaroids`) |
| **Fita de alfaiate nos puxadores** | Temporada Cápsula | peças fora da cápsula trancadas no maleiro | `TailorTape` nos puxadores das portas e gavetas com peças fora da cápsula, mais a caixa "Fora da cápsula" no maleiro |
| **Etiqueta "2ª chance"** | Segunda Chance | pendurada nas peças esquecidas do desafio | `HangTag` "2ª chance" (`taggedPieceIds`) |
| **Calendário de parede** | Sem Repetir | dias seguidos sem repetir look | `WallCalendar` com os dias riscados |
| **Tema escrito no espelho** | Batalha na Passarela | o tema da semana | texto no vidro do `Mirror` (`tema_espelho.theme`) |

## Acessibilidade e limites

- **Reduzir movimento.** Portas e gavetas mudam de posição sem animação. Não há puff, balanço, pulsação das luzes do
  closet nem luz subindo no fecho do Vista-me. A luz do horário fica fixa, porque `ambient.period` = `fixed`.
- **Sem WebGL.** O quarto abre em 2.5D e em lista, com as mesmas ações (RF32.CA08).
- **Custo por uso.** A etiqueta costurada só mostra o custo por uso para o dono (ETI-04).
- **Tom das mensagens.** Nenhum elemento cobra o usuário. A gaveta vazia convida, e a poeira some quando a peça volta.
