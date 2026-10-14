# Proposta — conquistas, artes e Minhas Artes

Requisitos definidos na conversa. Este documento é uma proposta de funcionamento; sua existência não significa que os fluxos já estejam implementados.

## Coleção do usuário

**Perfil → Minhas Artes** reúne cada AURA Metamorfose desbloqueado. A coleção do perfil agrega direitos vinculados a cards específicos; não concede uma licença global para qualquer card. Cada entrada mostra arte e prévia, nome, família, criador/emissor, origem e data da conquista, condições de uso e cards em que está aplicada. Busca e filtros por família, origem e uso tornam a coleção navegável.

Remover a arte de um card apenas a desequipa. Não consome o direito nem exige nova conquista enquanto o card continuar elegível; a entrada permanece em Minhas Artes durante essa elegibilidade. O usuário só pode reaplicar a mesma arte no card que conquistou o direito e ainda satisfaz sua política. Trocar de arte também preserva a anterior na coleção. Cada resgate identifica o card autorizado. Se a mesma arte for conquistada por dois cards, existem dois direitos independentes, cada um com suas condições.

Estados distintos: **bloqueada**, **desbloqueada**, **aplicada**. Uma arte pode estar desbloqueada e sem aplicação. Mostrar quantos cards a usam, sem confundir posse com equipamento. Remover deve revelar a composição de fundo anterior preservada, sem mudar a foto e os dados da roupa.

## Formas de desbloqueio

| Origem | Condição proposta | Recompensa | Aplicação |
| --- | --- | --- | --- |
| FLAIR | Completar combinação, modalidade, temporada ou desafio exclusivo com resultado validado | Variante exclusiva da jornada | Desbloquear em Minhas Artes e oferecer Aplicar |
| Hype | Atingir um marco com interações elegíveis e verificadas | Variante do nível alcançado | Desbloqueio automático; aplicação automática somente se habilitada |
| ATELIER | Concluir requisitos de um projeto com eventos reais de progresso | Arte e, conforme o projeto, objeto funcional para o quarto | Guardar a arte na coleção e concluir a construção do objeto |
| Selo exclusivo | Receber/resgatar um selo aprovado e cumprir sua política | Preset vinculado ao selo | Conceder o preset como consequência; respeitar a preferência de aplicação |

Exemplos de criação original para o FashionAI:

- **FLAIR — Prisma em Dueto:** concluir um desafio colaborativo desbloqueia uma variante prismática.
- **Hype — Órbita:** alcançar um marco de reconhecimento desbloqueia uma constelação própria da jornada.
- **ATELIER — Espelho Constelação FAI:** completar combinações cromáticas, reutilização de peça e dueto concede a arte e o espelho funcional.
- **Selo de coleção — Fio de Autor:** um selo aprovado de marca/celebridade concede o preset definido na política daquela coleção.

Estes nomes e regras são exemplos de design, não regras já publicadas ou pontuações existentes.

## Aplicação automática e escolhas

Desbloquear automaticamente não significa substituir automaticamente a arte escolhida. Em Minhas Artes, oferecer **Aplicar**, **Prévia** e **Ver conquista**. No card, oferecer **Remover arte** e **Trocar arte**. Depois de remover, manter o card no modo manual para que uma rotina automática não reaplique a arte sem nova escolha.

O modo automático deve ser uma opção explícita: ao conquistar um preset compatível, o sistema pode aplicar conforme a preferência escolhida. AURA Hype continua sendo ativável pelas configurações ou por modalidade no Background Studio. Os presets Electro, comum e Splash são famílias visuais, não evidência de nível Hype.

## Regras de concessão

A concessão ocorre no servidor, com registro de usuário, arte, origem e evento. O mesmo evento não pode conceder duas vezes a mesma recompensa; atualizar a página e repetir uma solicitação não duplica conquistas. Critérios e presets de marcas/celebridades exigem autoria autorizada e política validada. Uma combinação FLAIR não pode confiar apenas em confirmação do navegador.

Marcos de Hype devem considerar interações válidas e proteção contra manipulação. Para presets concedidos por nível Hype, manter o nível exigido é uma condição contínua. Se o card perder o nível, retirar o preset da listagem Minhas Artes daquele direito, recusar reaplicação e desativar a aplicação atual, revelando a composição-base anterior. Não manter uma entrada bloqueada visível no perfil. Preservar o histórico interno da concessão e da perda de elegibilidade para auditoria; o histórico não autoriza uso. Ao recuperar o nível, o direito pode reaparecer após revalidação, sem aplicação automática sobre uma escolha manual. Revogações por fraude têm motivo e histórico próprios. A validade de uma campanha e a validade de uso de um preset devem ser declaradas separadamente.

Selos com consequência visual precisam declarar o preset concedido e seu escopo. Receber um selo não deve apagar uma arte aplicada manualmente. A remoção manual de uma arte não remove a elegibilidade. A perda de nível Hype remove a elegibilidade, mesmo se a arte estiver desequipada. O backend deve revalidar usuário, propriedade do card, preset, política e nível Hype atual ao listar, resgatar e aplicar; não confiar no perfil em cache. A recalculação de Hype deve atualizar os direitos e invalidar as listagens e composições afetadas. Uma cópia do card/look ou transferência de propriedade não concede o direito ao usuário anterior ou a outro card.

Recompensas visuais podem coexistir com benefícios limitados de FAI Points, conforme a política da atividade.

## Aceite para implementação

- [ ] Desbloqueio validado adiciona a arte uma única vez a Minhas Artes.
- [ ] A coleção permanece após sair e entrar novamente.
- [ ] Aplicar salva o vínculo entre card e arte no servidor.
- [ ] Remover preserva o direito enquanto elegível e revela a arte-base anterior.
- [ ] Reaplicar não exige pontos ou nova conquista.
- [ ] Trocar arte preserva a anterior na coleção.
- [ ] Reaplicação funciona apenas no card que possui o direito.
- [ ] Queda abaixo do nível Hype exigido retira o preset de Minhas Artes e de sua aplicação no card.
- [ ] Tentativa de resgate com uma tela antiga é recusada se o nível já caiu.
- [ ] Recuperação do nível revalida o direito sem sobrescrever arte manual.
- [ ] Escopo e elegibilidade são verificados no servidor.
- [ ] Modo automático não sobrescreve escolhas manuais ou remoções explícitas.
- [ ] Prévia e resultado salvo usam a mesma composição visual, com redução de movimento e foto da peça preservada.
