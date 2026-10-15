# Política de concessão de FAI XP

**Status:** proposta de padronização
**Escopo:** ações verificáveis no Fashion AI, incluindo criações, jogos FLAIR e cenários de marcas ou celebridades.

Esta política define uma escala única para recompensar ações de valor crescente. Os valores são referências para configurar
regras de produto; a concessão efetiva deve ser registrada pelo servidor e não depender de cliques, animações ou valores
informados pelo navegador.

Documentos relacionados: [RF41 — concessão de FAI Points](../novos-rf/RF41_v2_Concessao_FAI_Points_Todos_RFs.md),
[RF48 — resgate e doações](../novos-rf/RF48_FAI_Points_Resgate_e_Doacoes.md) e
[Central FLAIR](../flair/CENTRAL_FLAIR.md).

## 1. Escala padrão

| Faixa | FAI XP | Tipo de valor | Exemplos |
|---|---:|---|---|
| Inicial | 5 | contribuição breve e validada | feedback útil sobre uma experiência |
| Básica | 10 | marco simples, concedido uma vez | concluir uma etapa inicial de orientação |
| Intermediária | 25 | contribuição aceita ou melhoria verificável | corrigir informação aceita na curadoria |
| Criação de peça | **50** | criação concluída e válida | cadastrar uma peça própria com os dados mínimos completos |
| Criação de look | **100** | criação composta e válida | salvar um look com peças reais do acervo |
| Jogo concluído | **200** | desafio completo, com resultado validado | completar um FLAIR Card Building Challenge (CBC), incluindo CBC Metamorfose |

As faixas não são cumulativas por padrão: uma ação recebe a recompensa da regra correspondente. Recompensas adicionais
exigem eventos distintos, previamente definidos e com limite próprio. Ações de maior esforço ou validação podem receber
valores diferentes, mas devem permanecer na escala e ter justificativa registrada.

## 2. Configuração de jogos FLAIR e CBC

- Cada jogo ou cenário de CBC publicado por um perfil de marca ou celebridade deve ter uma recompensa de conclusão
  configurada, visível antes de começar. O padrão para completar um CBC ou CBC Metamorfose é **200 FAI XP**.
- O criador do cenário pode escolher a faixa de recompensa permitida para aquele jogo; não pode ultrapassar o teto
  definido pela plataforma. A configuração fica congelada enquanto o jogo estiver ativo. Mudanças passam a valer apenas
  para novas tentativas.
- A recompensa de conclusão só é concedida após o servidor confirmar todos os requisitos do desafio. Abrir, iniciar,
  abandonar ou falhar não concede o bônus de conclusão.
- Se um jogo também recompensar participação, vitória ou marcos intermediários, cada evento deve ter regra e limite
  explícitos. O mesmo resultado não pode ser pago como participação e conclusão usando a mesma chave de evento.
- A recompensa é para a pessoa que concluiu o desafio. A publicação de um cenário pelo perfil criador é um evento
  independente e não concede automaticamente a recompensa destinada aos participantes.

## 3. Critérios de elegibilidade

1. Premiar resultados úteis, não navegação, abertura de tela ou repetição de chamadas.
2. Confirmar no servidor que a ação foi concluída e que os critérios de qualidade mínimos foram atendidos.
3. Conceder cada recompensa uma única vez por pessoa e por referência da ação (peça, look, desafio ou período).
4. Aplicar limites por regra e um limite diário global configurável; exibir quando uma recompensa não foi concedida por
   limite ou inelegibilidade.
5. Não conceder XP por compras, consumo de créditos, resgate de cupons, consentimentos, autointeração ou ações
   inválidas/removidas.
6. Repetições, duplicatas, contas vinculadas ou tentativas automatizadas devem ser tratadas por mecanismos de
   idempotência e prevenção a abuso, sem bloquear a funcionalidade legítima do app.
7. O valor, o critério, o limite e a versão da regra devem constar no histórico para auditoria e suporte.

## 4. Evolução e compatibilidade

Novas ações devem ser classificadas em uma das faixas antes do lançamento, com critério verificável, chave de idempotência,
limite e texto de transparência. A calibração deve considerar XP emitido, conclusão legítima, repetição suspeita e
impacto na progressão; mudanças de valor não devem alterar lançamentos passados.

**FAI XP** é o nome da progressão definida nesta política. Não deve ser tratado como saldo resgatável ou confundido com
**FAI Points**, que já possuem regras próprias de concessão, extrato e resgate. Se a decisão de produto for usar FAI XP
como sinônimo do saldo atual de FAI Points, essa equivalência e a migração dos valores devem ser aprovadas e documentadas
antes de implementar as recompensas acima.
