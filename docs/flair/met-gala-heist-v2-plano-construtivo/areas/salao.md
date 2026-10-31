# Grande Salão: gala, pista de dança e DJ

**Zonas do blueprint:** Z04 (salão de gala), Z05 (pista e DJ), Z06 (camarotes no mezanino) · **Salas da planta:** `salao`

**Dimensões:** x −12 a 12, z −6 a 14 (24 × 20 m), pé-direito 9,5 m com cúpulas e mezanino

**Arquivos da área:** `components/heist/scene/interior-hall.ts`, `components/heist/scene/areas/salao.ts` (e arquivos novos `areas/salao-*.ts`)

## Como está hoje

Colunata coríntia, cúpulas em caixotões, mezanino com balaustrada, instalação floral central, mesas altas, palco do quarteto, passarela e telão. Falta a festa: não há DJ, pista, comida nem doces.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Granito/mármore polido com frisos e rosácea central; **pista de dança** de madeira escura com borda metálica (ou piso de LED discreto) iluminada pelos globos; tapetes sob as mesas de jantar |
| Paredes | Pedra esculpida, pilastras, boiserie com almofadas, cortinas pesadas nos arcos, arte emoldurada ficcional |
| Teto | Cúpulas existentes com medalhões; lustres **Celestial Crown** de anéis de bronze e cristal presos em suportes; **três globos espelhados** com eixo e cabo sobre a pista; treliças (truss) com moving heads e caixas de som penduradas |
| Portas | Folhas duplas altas para o vestíbulo e a galeria; porta discreta dos garçons para o serviço; porta para o lounge |
| Luz | Lustres, castiçais nas mesas, luzes da pista que mudam com a música (cores e varredura), foco no palco |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Cabine do DJ: mesa com CDJs, mixer, laptop, cases, cabos e caixas | O DJ tocando de verdade, voltado para a pista | mesa 2,4 × 0,8 × 1,1 m; line array e subwoofers | alta | PLANEJADO |
| Pista de dança com globos espelhados | Onde os convidados dançam | 8 × 6 m | sem colisão | PLANEJADO |
| Mesa de doces: bolo de vários andares, torre de macarons, éclairs, cupcakes, cloches de vidro | O pedido do usuário: mesa de doces e bolos | 4,0 × 1,0 × 0,9 m | baixa | PLANEJADO |
| Buffet de comidas: réchauds, canapés, frios, frutas, torre de champanhe | Comida servida aos convidados | 5,0 × 1,0 × 0,9 m | baixa | PLANEJADO |
| Mesa de patronos com marchetaria e lugares nomeados; cadeiras Gala Étoile | Jantar dos patronos (Z04) | mesa Ø 1,8 m, 8 cadeiras | baixa | PLANEJADO |
| Aparador de serviço Atelier Service em pedra e madeira | Base dos garçons | 2,4 × 0,6 × 0,95 m | baixa | PLANEJADO |
| Púlpito e palco com instalação de moda | Anúncios da gala | palco existente | baixa (já existe) | PLANEJADO |
| Camarotes no mezanino com poltronas | Vista de cima da pista (Z06) | poltronas 0,8 × 0,8 m | fora da área jogável | PLANEJADO |

### Objetos de cena

Pratos, talheres, taças de tipos diferentes, guardanapos, menus, cartões de lugar, velas, centros florais, baldes de gelo, bandejas, fones do DJ, cabos presos com fita, cases abertos, copos no chão da pista.

### Pessoas

**DJ** tocando (mãos nos pratos, fone em uma orelha, cabeça no ritmo); **10 a 16 convidados dançando** com passos variados no ritmo, sem fase idêntica e sem atravessar ninguém; convidados comendo junto à mesa de doces e ao buffet; garçons circulando com bandejas; seguranças observando.

### Regras de jogo

As portas, a colunata, o arranjo floral, as rotas dos garçons e dos seguranças, o checkpoint do salão e o pôster-pista (`posterAurora`) continuam acessíveis. Pessoas novas (DJ, dançarinos, quem come) entram no fim de `civs()` na seção do salão; móveis com colisão como `fixture`.

### Vistas de aceite

Geral da porta do vestíbulo; a pista com gente dançando (jogo com `?shot=`); a cabine do DJ de perto; a mesa de doces de perto (bolo e macarons); vista do mezanino; vista alta.

## Estudo da área

_Preenchido pelo agente da área: referências de uso real, por que cada móvel faz sentido, materiais e medidas._

## Implementado

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
