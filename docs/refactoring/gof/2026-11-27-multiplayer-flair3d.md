# Multiplayer do FLAIR 3D (27/11/2026)

## Problema

A auditoria de 27/11 (`docs/flair/flair-3d/auditoria-2026-11-27/AUDITORIA.md`, T1) deu 0,6 em Multiplayer: nenhum jogo
abre partida contra outra pessoa e o duelo 2D pede a tag digitada. A dona pediu convite por busca na rede FAI, nunca
tag. `Flair3dNucleoService` (242/250) e `Flair3dNucleoController` não podiam crescer.

## Decisões

| Peça | Padrão | Por quê |
| --- | --- | --- |
| `Flair3dPartidaAbertura` (tirada de `Flair3dNucleoService.abrir`) | **NENHUM** (extração) | A abertura recebe a semente de fora: sorteada na partida solo, a da sala no duelo assíncrono. O serviço caiu de 242 para 214 linhas; `Flair3dPartidaAberturaTest` caracteriza o contrato antes/depois. |
| `Flair3dDuelo` + `BatalhaLooksDuelo`, `DressFighterDuelo`, `FashionSportsDuelo` | **Strategy** | Cada jogo de confronto julga o turno com as regras dele; a sala TURNOS (`Flair3dSalaTurnos`/`Flair3dSalaPlacar`) só grava lances e pede o julgamento. O juiz refaz o duelo inteiro a partir dos lances gravados (como `Flair3dRetomada`), então o resultado não depende da ordem de chegada. Os juízes da Batalha e do Dress Fighter ficam no pacote `nucleos` para reusar `BatalhaLooksPlacar` e `DressFighterGolpes` sem abrir a visibilidade deles. |
| `Flair3dSalaLeitura` (ASSINCRONO × TURNOS) | **Strategy** (por modo, escolha simples) | A leitura da sala delega o andamento ao modo: `Flair3dSalaAssincrona` (fecha quando as duas partidas terminam) ou `Flair3dSalaPlacar`. Um `if` sobre o modo; com o COOP vira um mapa modo → estratégia. |
| `Flair3dSalaAvisos` | **Observer** (eventos da sala → `NotificationService`) | Convite, vez e resultado viram notificações com `payload.href`; recusa e expiração não avisam (ETI-02). Os serviços só disparam o evento. |
| `Flair3dSalaAcesso` | **NENHUM** (regra de acesso) | Sala só existe para as duas pessoas (404), leitura travada (`PESSIMISTIC_WRITE`) e expiração preguiçosa do convite. |
| `Flair3dConvidavel` | **NENHUM** (regra) | Mesmas regras da busca de pessoas e dos desafios: ativa, pessoal, sem bloqueio, teste só para teste, 13+, conta privada só com seguir aceito. Usada pela busca, pelo convite e pelo duelo 2D (`FlairDueloOponente`). |
| `FlairDueloOponente` | **NENHUM** (adaptador do controller) | `FlairService` está congelado: o controller converte `opponentId` em username antes de chamar `duel`; `opponent` continua aceito. |

## Contrato

Em `docs/flair/flair-3d/MULTIPLAYER.md`.
