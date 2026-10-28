# FAI XP, níveis e desbloqueios

FAI XP é a progressão medida pelos **FAI Points vitalícios**. O saldo pode ser gasto na loja, mas gastos não reduzem os pontos vitalícios nem o nível. A barra de progresso aparece no perfil e na aba de partidas FLAIR.

## Níveis

São **três** níveis (`FaiPointsService.Level`). A migração `V74__tres_niveis_basico_studio_loft.sql` converteu Closet,
Atelier, Penthouse e Maison em Loft, e `Level.parse` continua lendo esses nomes antigos como Loft.

| Nível exibido | Identificador interno | FAI Points vitalícios necessários | Desbloqueios relevantes |
|---|---|---:|---|
| Básico | `ESTREIA` | 0 | Quarto base, Smart Mirror/Vista-me, AURA estática e acabamento Hype **Comum** |
| Studio | `STUDIO` | 300 | Iluminação guiada, sapateira/vitrine/porta-joias, AURA dinâmica (borda animada do AURA Hype) e acabamento Hype **Raro** |
| Loft | `LOFT` | 900 | Quarto maior, ilha central, closet de assinatura, AURA Metamorfose, AURA Impersonation, FLAIR Metamorfose e acabamentos Hype **Lendário** e **Collab/Drop** |

Os identificadores internos são mantidos para compatibilidade com dados existentes. Assim, `ESTREIA` é apresentado como **Básico**, sem alterar o valor persistido nem invalidar o progresso já registrado.

A fonte única da regra é o backend (`AuraPermissionsService.AuraGatingConfig` e `HYPE_FINISH_TIERS`); o frontend lê os
requisitos de `GET /api/me/aura-permissions` (`auras` e `hypeFinishes`).

## Como ganhar XP

As partidas FLAIR concedem 5 pontos por partida, até 6 partidas pontuadas por dia, e mais 10 pontos por vitória, até 4 vitórias pontuadas por dia. Concluir uma quest FLAIR concede 10 pontos, até 3 quests pontuadas por dia. Os limites afetam somente a concessão de pontos, não o acesso ao jogo.

O Roubo ao Afterparty concede pontos por iniciar uma partida e um bônus de vitória ao concluir a missão. O ledger do backend garante idempotência, de forma que repetir uma requisição da mesma partida não duplica a recompensa.

## Classificação e bloqueios de jogo

- **FLAIR** reúne os modos regulares e permanece disponível conforme as regras próprias de cada modo.
- **FLAIR Metamorfose** reúne jogos com transformações durante a partida. O Roubo ao Afterparty é o primeiro modo desta categoria.
- Todo modo FLAIR Metamorfose exige nível **Loft**. A interface oculta as ações de jogo antes do desbloqueio, e a API também rejeita chamadas diretas de usuários abaixo do nível exigido.
- Met Gala Hype é uma possibilidade futura de FLAIR Metamorfose; não é um jogo implementado nesta versão.

## Auras

- AURA básica e acabamento Hype Comum: **Básico** (0 pontos).
- AURA dinâmica, borda animada do AURA Hype (preferência `auraHype`) e acabamento Hype Raro: **Studio** (300 pontos).
- AURA Metamorfose, AURA Impersonation e acabamentos Hype Lendário e Collab/Drop: **Loft** (900 pontos).

Todas as regras valem também em chamadas diretas à API (403 `AURA_LEVEL_REQUIRED` com `requiredTier`).
