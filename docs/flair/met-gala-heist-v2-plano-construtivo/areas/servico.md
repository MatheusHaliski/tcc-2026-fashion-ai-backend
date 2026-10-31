# Bastidores, copa e segurança

**Zonas do blueprint:** Z09 (operações e monitoramento), Z10 (cozinha, copa e bar de serviço), Z11 (camarins, ateliê e produção) · **Salas da planta:** `bastidores`, `servico` (labirinto), `seguranca`

**Dimensões:** bastidores x 12,5 a 22, z −6 a 4 (pé-direito 4,6 m); labirinto de serviço x −22 a −12,5, z −6 a 16 (3,6 m, divisórias de 3,2 m); segurança x −22 a −18,5, z 2 a 7,5

**Arquivos da área:** `components/heist/scene/areas/bastidores.ts`, `areas/servico.ts`, `areas/seguranca.ts` (e arquivos novos `areas/servico-*.ts`)

## Como está hoje

Bastidores com penteadeiras, mesa da produção, monitores, vaporizador e manequins; labirinto com luz fluorescente fria, canos e placas; segurança com monitores, cofre e quadro de luz.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Bastidores: piso de palco preto com marcações de fita; labirinto e copa: granilite ou borracha antiderrapante com ralos, faixas de segurança; segurança: piso vinílico |
| Paredes | Bastidores: paredes pretas com cases encostados e quadro de chamada; copa: azulejo branco até o teto, cantoneiras de inox, para-choques; labirinto: drywall com marcas de carrinho, extintores, placas "SOMENTE FUNCIONÁRIOS"; segurança: painel acústico |
| Teto | Bastidores: grid com refletores; copa: forro de PVC com luminárias estanques e coifa; labirinto: forro removível com canos e calhas aparentes; segurança: forro acústico |
| Portas | Porta do palco, portas vaivém da copa com visor, porta corta-fogo, porta da segurança com leitor |
| Luz | Bastidores: lâmpadas das penteadeiras e refletores de trabalho; copa: fluorescente fria; segurança: brilho dos monitores |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Penteadeira de maquiador com gavetas e lâmpadas | Camarim (Z11) | 1,6 × 0,5 × 0,75 m + espelho | baixa (já existe como mirror/desk) | PLANEJADO |
| Arara móvel com rodízios e cabides; bancada de costura com manequim de ajuste; carrinho de acessórios | Ateliê da produção (Z11) | arara 1,6 × 0,6 × 1,8 m | baixa/alta | PLANEJADO |
| Ilha central de inox e bancada de preparo; pass-through com louças | Copa do bufê (Z10), nas pontas mortas do labirinto | ilha 2,4 × 1,0 × 0,9 m | baixa | PLANEJADO |
| Carrinho de catering, torre de copos, estação de coquetelaria e refrigeração | Serviço do bufê | carrinho 0,9 × 0,6 × 1,0 m | baixa | PLANEJADO |
| Console panorâmico de monitores e mesa de coordenação com rádios | Monitoramento (Z09) | console 3 × 0,9 m | baixa (já existe como monitor) | PLANEJADO |
| Racks ventilados com portas e painel do palco e da pista | Operação técnica (Z09) | rack 0,6 × 1,0 × 2,0 m | alta | PLANEJADO |

### Objetos de cena

Panelas, formas, cubas gastronômicas, pilhas de pratos, caixas de taças, avental pendurado, quadro de pedidos, latas de lixo com pedal; bastidores: fita gaffer, cabos, rádios, prancheta, roupas em capas; segurança: café, rádios no carregador, quadro de chaves.

### Pessoas

Equipe do bufê e chef na copa, equipe de produção nos bastidores, operador na segurança.

### Regras de jogo

**O labirinto não muda de forma**: as paredes vêm da semente e os testes exigem mais de uma rota (doca → duto, porta da equipe → segurança). Móveis com colisão só em pontas mortas e sem fechar caminho; os armários do uniforme, o cofre, o quadro de luz e a porta da segurança continuam acessíveis.

### Vistas de aceite

Bastidores da porta do lounge; uma penteadeira de perto; um corredor do labirinto ao nível dos olhos; a copa de perto; a sala de segurança; vista alta do labirinto.

## Estudo da área

_Preenchido pelo agente da área: referências de uso real, por que cada móvel faz sentido, materiais e medidas._

## Implementado

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
