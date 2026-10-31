# Beco, doca e beiral

**Zonas do blueprint:** Z12 (apoio e doca), Z15 (pátio de saída e garagem) · **Salas da planta:** `beco`, `doca`, `beiral`

**Dimensões:** beco x 22,5 a 30, z −22 a 24,5 (rua, ao ar livre); doca x −22 a −8,5, z 16,5 a 24 (pé-direito 6 m); beiral x −21 a 21, z −23,5 a −22,5

**Arquivos da área:** `components/heist/scene/exterior-alley.tsx` (beco e beiral), `components/heist/scene/areas/doca.ts` (doca); arquivos novos da área em `areas/doca-*.ts` ou `exterior-alley-*.ts`

## Como está hoje

Beco com caçambas, escada de incêndio e o carro da fuga; doca com caixas do bufê e piso de concreto. Pouca sujeira, pouca tubulação, pouca história.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Beco: asfalto rachado e remendado, poças com brilho de óleo, grelha de drenagem, sujeira acumulada no pé das paredes. Doca: concreto polido com juntas de dilatação, faixas amarelas e pretas, manchas de pneu, marcações de vaga e de corredor de empilhadeira |
| Paredes | Beco: tijolo aparente velho com pichações fictícias, reboco descascado, canos de descida, caixas de ar-condicionado, medidores, fiação. Doca: bloco de concreto pintado até 1,2 m, para-choques de borracha nas quinas, quadros de aviso e escala |
| Teto | Doca: estrutura metálica aparente, calhas de cabos, luminárias industriais, sprinklers e tubulação pintada |
| Portas | Porta de enrolar da doca, porta de aço de serviço com barra antipânico e placa, porta corta-fogo |
| Luz | Beco: luminária de vapor de sódio na parede, luz de segurança com sensor, a luz da rua no fim do beco. Doca: luminárias industriais de LED, luz de emergência |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Flight cases, estantes e carrinhos da produção | Equipamento do evento chegando pela doca | case 1,2 × 0,6 × 0,8 m com rodízios e fechos | alta/baixa | PLANEJADO |
| Quadro de escalas, cabides, paletes e bancada de conferência | Onde a equipe confere a carga | bancada 2,0 × 0,8 × 0,9 m | baixa | PLANEJADO |
| Paleteira manual e empilhadeira estacionada | Movimento de carga | paleteira 1,6 × 0,55 m | baixa | PLANEJADO |
| Guarita de acesso da doca | Controle de quem entra pelos fundos | 1,6 × 1,6 × 2,6 m | alta | PLANEJADO |
| Caçambas, contêineres de lixo e gaiola de gás (beco) | Fundo de prédio de verdade | caçamba 2,0 × 1,2 × 1,3 m | alta (já existe) | PLANEJADO |
| Totem de saída com identidade gráfica | Orienta a saída de funcionários | 0,5 × 0,3 × 2,0 m | baixa | PLANEJADO |

### Objetos de cena

Sacos de lixo, caixas de papelão desmontadas, paletes encostados, cones, extintores, bebedouro, relógio de ponto, jaleco pendurado, rádio, prancheta, latas de tinta, rolos de fita, carrinho de lixo.

### Pessoas

Equipe do bufê descarregando, segurança da doca, motorista do caminhão.

### Regras de jogo

A rampa da doca, o portão com interfone, a porta da equipe e o teclado do labirinto continuam acessíveis; a escada de incêndio continua escalável nos pontos marcados. Móveis novos com colisão entram como `fixture`.

### Vistas de aceite

Beco do fim da rua até a escada; escada de incêndio de baixo; doca da rampa; bancada de conferência de perto; vista alta da doca.

## Estudo da área

_Preenchido pelo agente da área: referências de uso real, por que cada móvel faz sentido, materiais e medidas._

## Implementado

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
