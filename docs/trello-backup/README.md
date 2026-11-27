# Revisão do quadro Trello "TCC 2026 (Fashion AI)" — 2026-11-10

`fashion-ai-board-2026-11-10.json` é o estado do quadro **antes** da revisão: listas, etiquetas, cartões
(nome, descrição, lista, etiquetas, estado) e checklists com itens marcados. Use-o para recuperar qualquer
texto removido. Nenhum cartão foi excluído: os removidos foram **arquivados** e podem ser restaurados no Trello.

## O que mudou

Regra aplicada (já definida em `markdowns/02-rf-reestruturados-e-criterios-aceite.md` §0): critério de aceite
mora **só** no card HU-RFx do Product Backlog.

| Onde | Antes | Depois |
|---|---|---|
| Card RFx (Requisitos Funcionais) | Histórico de edições, listas de CA e checklists | Requisito, escopo, fora do escopo, dependências, sprint e link para o HU |
| Card HU-RFx (Product Backlog) | CA divergentes entre cópias, listas de campos de banco como CA | "Critérios de Aceite" (4–10, formato DADO/QUANDO/ENTÃO) + "Tarefas" por área |
| Cópias em Sprint Backlog / Feito | Checklists duplicados (até 33 itens) | Ponteiro curto para o HU canônico |

Números: 291 → 282 cartões abertos (11 arquivados por duplicidade), descrições 174 mil → 97 mil caracteres,
itens de checklist 1.602 → 937. RF42 e RF43 (sem descrição) e RNF12/RNF13 ganharam texto.

Correções estruturais:
- **Colisão de números:** as propostas de 29/10 numeradas RF44/45/46 (RF44–46 já eram Creative Engine, Lens e
  HypeScore v2) viraram **RF50 (recomendação de tamanho), RF51 (editor 3D colaborativo do Atelier) e RF52
  (passaporte digital)**. A numeração do quadro vai de RF1 a RF52 sem buracos. Atenção: `docs/novos-rf/` usa RF50–RF59
  com outros significados (ex.: `RF50_Criador_de_Selos.md`); vale o Trello.
- **RF15 e RF16** saíram de Temas Futuros (editor de fotografia entregue e geração 3D em andamento na Sprint 4).
- **Tags de tarefas corrigidas** na Sprint 4 (ex.: `[RF7] style-dna` → RF13, `[RF16] brands` → RF14,
  `[RF17] remove-bg` → RF15, `[RF15] 3d-worker` → RF16) e na Sprint 2 (Aura → RF11).
- **Feito - Sprint 1:** endpoints duplicados (`/api/signup`, `/api/auth/verify`, `/api/auth/session`,
  `PATCH /api/users/me`) consolidados num cartão cada.
- **Temas Futuros eliminados:** as listas de futuros foram arquivadas. RF44–RF52 estão em Requisitos Funcionais
  (Sprint 04), cada um com HU no Product Backlog (HU-RF47 a HU-RF52 criados com os critérios que estavam no RF).
  Os 7 cards de critério de aceite avulsos viraram um CA cada no HU do RF hospedeiro: HU-RF37 (CA11 cenários CBC,
  CA12 jogos FLAIR exclusivos), HU-RF39 (CA11 editor de assets 3D), HU-RF14 (CA09 peças autorais), HU-RF38 (CA10
  promoções com Copilot), HU-RF25 (CA11 mercado de selos) e HU-RF32 (CA11 Trends "Passa o Look").
- RNF: títulos `RNFn — tema` (RN11 → RNF11); RNF14 condensado (6,2 mil → 1,1 mil caracteres) sem repetir RNF1–RNF3.
- Listas: colunas vazias
  "A fazer"/"Fazendo" das Sprints 1–3 arquivadas; etiquetas "SPRINT 04"/"Sprint 04" duplicadas substituídas pela
  "Sprint 04" roxa nos cartões abertos.

## Decisões pendentes para o time

1. **Numeração repo × Trello:** `docs/novos-rf/README.md` usa RF46 (Creative Engine), RF53 (HypeScore v2), RF54 (Lens)
   e RF49 (segurança); no Trello são RF44, RF46, RF45, e RF49 é o FLAIR Metamorfose. O README diz que vale o Trello;
   falta atualizar os docs.
2. **RF12:** "adicionar mais de uma peça por vez" saiu do título por não ter CA nem aparecer no doc 02. Se for
   requisito, entra como CA no RF4.
3. **CAs movidos para outros RFs:** confirmar cobertura nos HUs destino. Exclusão de peça com senha (antes no RF3) →
   RF6/RF9. Seguir/perfil privado (antes no RF8) → RF17. Loja e itens únicos (antes em RF14/RF22/RF34/RF35) → RF39
   ou propostas Minha Loja/Atelier. Prévia 2D do RF28 (CA17–CA22) ficou só em `docs/novos-rf/RF28_Previa_2D_Espelho_Vista-me.md`.
4. **Doc 02 desatualizado** em relação ao quadro: RF2 (verificação em duas etapas), RF1 (aceite de termos),
   RF11 (modelo de três modos) e RF3.CA11 (troca de senha só por e-mail).
5. **Sprints:** RF18 tem etiqueta Sprint 02, mas o escopo é de outubro; RF25 tem Sprint 03 e cópia na Sprint 4.
6. **Entregas sem itens marcados:** RF15 (entregue), RF43 (em "Feito - Sprint 3" com CA03–CA05 abertos) e o
   look do dia básico (Sprint 2, RF42.CA01). Marque os CAs que o time confirmar.
7. **RF21:** o HU antigo dispensava aprovação da celebridade quando a IA sugere o vínculo; o doc exige sempre.
   Mantido "exige aprovação".
8. **Etiquetas duplicadas "SPRINT 04" e "Sprint 04" (lilás)** continuam existindo no quadro (sem cartões abertos);
   podem ser excluídas em *Etiquetas*.
