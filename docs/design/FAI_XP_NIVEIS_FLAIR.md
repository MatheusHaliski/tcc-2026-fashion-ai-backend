# FAI XP, níveis e desbloqueios

FAI XP é a progressão medida pelos **FAI Points vitalícios**. O saldo pode ser gasto na loja, mas gastos não reduzem os pontos vitalícios nem o nível. A barra de progresso aparece no perfil e na aba de partidas FLAIR.

## Níveis

| Nível exibido | Identificador interno | FAI Points vitalícios necessários | Desbloqueios relevantes |
|---|---|---:|---|
| Básico | `ESTREIA` | 0 | Acesso inicial e AURA básica |
| Studio | `STUDIO` | 300 | AURA Hype e auras dinâmicas |
| Loft | `LOFT` | 900 | AURA Metamorfose, AURA Impersonation e jogos FLAIR Metamorfose |
| Closet | `CLOSET` | 2.000 | Módulos especializados do quarto |
| Atelier | `ATELIER` | 4.000 | Ilha central do quarto |
| Penthouse | `PENTHOUSE` | 7.500 | Ambiente premium |
| Maison | `MAISON` | 12.000 | Closet de assinatura |

Os identificadores internos são mantidos para compatibilidade com dados existentes. Assim, `ESTREIA` é apresentado como **Básico**, sem alterar o valor persistido nem invalidar o progresso já registrado.

## Como ganhar XP

As partidas FLAIR concedem 5 pontos por partida, até 6 partidas pontuadas por dia, e mais 10 pontos por vitória, até 4 vitórias pontuadas por dia. Concluir uma quest FLAIR concede 10 pontos, até 3 quests pontuadas por dia. Os limites afetam somente a concessão de pontos, não o acesso ao jogo.

O Roubo ao Afterparty concede pontos por iniciar uma partida e um bônus de vitória ao concluir a missão. O ledger do backend garante idempotência, de forma que repetir uma requisição da mesma partida não duplica a recompensa.

## Classificação e bloqueios de jogo

- **FLAIR** reúne os modos regulares e permanece disponível conforme as regras próprias de cada modo.
- **FLAIR Metamorfose** reúne jogos com transformações durante a partida. O Roubo ao Afterparty é o primeiro modo desta categoria.
- Todo modo FLAIR Metamorfose exige nível **Loft**. A interface oculta as ações de jogo antes do desbloqueio, e a API também rejeita chamadas diretas de usuários abaixo do nível exigido.
- Met Gala Hype é uma possibilidade futura de FLAIR Metamorfose; não é um jogo implementado nesta versão.

## Auras

- AURA Hype e demais auras dinâmicas: **Studio** (300 pontos).
- AURA Metamorfose: **Loft** (900 pontos).
- AURA Impersonation: **Loft** (900 pontos).
