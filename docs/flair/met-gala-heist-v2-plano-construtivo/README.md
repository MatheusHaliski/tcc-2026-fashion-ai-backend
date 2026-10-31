# MET Gala Heist v2 — plano construtivo do cenário, área por área

Plano de produção do cenário 3D do Museu Vesper (ficcional) na noite da Gala Lumière, para sair do "desenho simples" e
chegar a interiores com a densidade de detalhe de um jogo de grande orçamento. Junta três fontes:

1. **O pedido de 31/10/2026:** salões internos no padrão dos salões de *Resident Evil Village* (câmera sempre dentro de um
   espaço fechado com teto, lustres, escadarias, móveis, piso de granito, portas e paredes com detalhe real); a rua como
   uma cidade 3D de verdade (prédios ao fundo, vitrines, calçada suja com panfletos e bitucas); no Grande Salão, DJ
   tocando, mesa de doces, bolos e comidas e pista com convidados dançando de verdade.
2. **O documento "METGALA HEIST — Blueprint construtivo de mundo 3D"** (25/10/2026), com as 15 zonas (Z01–Z15), os
   quatro móveis exclusivos de cada uma, as classes HERO/Near/Mid/Far e os critérios de reprovação.
3. **A planta jogável que já existe** (`lib/heist/level.ts`): 13 salas, portas, rotas dos seguranças, pessoas e
   interações. O cenário veste essa planta; não a redesenha.

## Linguagem visual de referência

*Resident Evil Village* (salões do castelo) serve como referência de **linguagem**, não de conteúdo: nada é copiado,
nem forma de objeto nem textura. O que se busca dela:

- **Espaço fechado e alto.** Pé-direito duplo, teto sempre presente e trabalhado (caixotões, vigas, medalhões, cúpulas),
  nenhum vazio preto acima da cabeça.
- **Paredes com camadas.** Rodapé alto, lambri ou boiserie com almofadas, cimalha, pilastras, sanca, molduras de quadro.
  A parede nunca é um plano liso de uma cor só.
- **Piso que conta a história.** Pedra polida com juntas, frisos e rosáceas embutidas, desgaste nas passagens, tapetes
  com espessura e franja.
- **Luz de fonte visível.** Lustres de cristal, castiçais, arandelas e abajures acesos que justificam a luz da sala, com
  sombras e cantos escuros.
- **Portas pesadas.** Folhas com almofadas entalhadas, batentes e guarnições com perfil, ferragens de latão.
- **Mobiliário único.** Cada sala tem peças que só existem nela; nenhum móvel genérico recolorido.

## As áreas e quem constrói cada uma

| Área do jogo | Zonas do blueprint | Salas da planta | Arquivos da área |
| --- | --- | --- | --- |
| [Rua: avenida, fachada (com o beiral) e cidade](areas/rua.md) | Z01 | `rua`, `beiral` | `scene/exterior*.tsx`, `exterior-*.ts`, `sky.tsx` |
| [Beco e doca](areas/beco-doca.md) | Z12, Z15 | `beco`, `doca` | `scene/exterior-alley.tsx`, `areas/doca.ts` |
| [Vestíbulo e escadaria](areas/vestibulo.md) | Z02, Z03, Z14 | `vestibulo` + portas internas | `areas/vestibulo.ts`, `interior-doors.ts` |
| [Grande Salão: gala, pista e DJ](areas/salao.md) | Z04, Z05, Z06 | `salao` | `interior-hall.ts`, `areas/salao.ts` |
| [Lounge, bar e terraço](areas/lounge-terraco.md) | Z05, Z13 | `lounge`, `terraco` | `areas/lounge.ts`, `areas/terraco.ts` |
| [Instituto do Traje e Sala das Joias](areas/galeria-joias.md) | Z07, Z08 | `galeria`, `cofre` | `areas/galeria.ts`, `areas/cofre.ts` |
| [Bastidores, copa e segurança](areas/servico.md) | Z09, Z10, Z11 | `bastidores`, `servico`, `seguranca` | `areas/bastidores.ts`, `areas/servico.ts`, `areas/seguranca.ts` |
| [Pessoas](areas/pessoas.md) | todas | — | `components/heist/people/*`, `lib/avatar3d/human/locomotion.ts`, `lib/heist/looks.ts` |

Os caminhos de `scene/` e `areas/` ficam em `components/heist/scene/`. Cada área tem um arquivo próprio no plano com:
piso, paredes, teto, portas, luz, móveis únicos, objetos, pessoas, regras de jogo e critérios de aceite. O estudo de
cada área (por que cada móvel faz sentido ali, medidas, materiais) é escrito no próprio arquivo da área.

## Como o código foi dividido para as áreas evoluírem juntas

- **Cena:** cada sala interna tem um módulo em `components/heist/scene/areas/` que exporta `AREA` (contrato em
  `areas/types.ts`): `dress` (decoração, luzes e animações), `props` (desenho dos móveis da planta naquela sala,
  inclusive os móveis próprios), `surfaces` (piso, parede e teto próprios no lugar dos da casca) e `keys` (luz
  principal com sombra). O registro fica em `areas/index.ts`.
- **Móveis com colisão:** um móvel novo entra na planta como `kind: "fixture"` com `model` (por exemplo
  `"djBooth"`), na seção da sala em `baseProps()`. A simulação usa só a forma e a altura (baixo esconde agachado, alto
  bloqueia a visão, vidro bloqueia o passo); o módulo da área desenha pelo `model`.
- **Proteção do jogo:** `lib/heist/world.test.ts` reprova móvel próprio fora da sala, na frente de porta ou em cima de
  interação, posto, ronda, pessoa, arara, checkpoint, fila ou saída; os testes de navegação continuam exigindo que
  toda sala seja alcançável e que o labirinto tenha mais de uma rota.
- **Laboratórios com câmera livre** para as capturas de cada área:
  - salas sem gente: `/lab/heist-salas?pos=x,y,z&target=x,y,z&room=sala`;
  - rua: `/lab/heist-rua?pos=…&target=…`;
  - jogo com gente: `/lab/heist?at=salao&shot=x,y,z,tx,ty,tz`.

## Critérios de aceite (valem para todas as áreas)

| Camada | Exigido | Reprova |
| --- | --- | --- |
| Identidade | Cada móvel único tem nome, uso, medida real e razão de estar ali | Móvel genérico recolorido |
| Geometria | Espessura, perfis, chanfros, encaixes; silhueta certa de frente, lado e de cima | Plano 2D no lugar de objeto 3D (lustre, porta, vitrine) |
| Materiais | Rugosidade e relevo variando; metal, vidro, pedra, madeira e tecido distinguíveis | Tudo igualmente brilhante; metal que parece plástico |
| Escala | Pessoa de 1,70 m como régua: degrau 17 cm, tampo de mesa 75 cm, balcão 1,10 m, porta 2,10 m ou mais | Móvel fora de escala |
| Luz | Toda luz tem uma fonte visível (lustre, arandela, abajur, refletor) | Sala iluminada sem luminária |
| Jogo | Colisão igual ao desenho; nenhuma rota, porta ou interação bloqueada; testes passando | Móvel atravessável ou que prende pessoas |
| Desempenho | Lotes e instâncias; texturas geradas uma vez e reaproveitadas; orçamento por sala | Cada objeto pequeno numa chamada de desenho própria |
| Evidência | Quatro vistas por área (geral da entrada, altura dos olhos para o móvel principal, detalhe a menos de 1,5 m, vista alta), mais uma com gente nas áreas com pessoas | Uma imagem bonita aprovando o que falha de perto |

Estados de cada item (como no blueprint): **PLANEJADO** → **IMPLEMENTADO** (no código, com captura) → **VALIDADO**
(passou nas quatro vistas e nos testes) ou **REPROVADO** (com o motivo).
