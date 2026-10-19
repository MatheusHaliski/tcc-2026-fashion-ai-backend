# Loja, destaque de perfil e Metamorfose

## Item 35 — escopo confirmado

A loja usa somente FAI Points, sem monetização. Cada célula apresenta ícone do item, ícone oficial dos pontos, preço e botão de informações sobre finalidade e aplicação. A compra exige confirmação. Saldo insuficiente deve rejeitar a operação com modal, inclusive quando o saldo mudou no servidor desde a abertura da página.

O débito e a entrega devem ocorrer na mesma transação de banco. A loja de quarto trava comprador e SKU, nesta ordem; a loja de licenças AURA trava comprador e oferta. A licença é única por comprador/preset. Os testes unitários verificam essas regras, mas não substituem testes MySQL de concorrência e rollback.

Destinos obrigatórios: peças em Minhas peças; móveis no inventário/quarto 3D; artes em Minhas Artes. O fluxo atual de móveis exige escolher um módulo compatível para montar após comprar. A loja de artes implementada nesta etapa vende licenças para emissores aprovados; não representa ainda o direito de arte de todo participante. A entrega automática de todas as categorias ainda precisa de comprovação integrada.

## Política de destaque de perfil

O emissor define se o alvo é peça, look ou ambos, e quais características precisa atender. Pode não exigir selo anterior, exigir um selo específico, qualquer um de uma lista (ANY), ou todos de uma combinação (ALL). A condição de selos é adicional às condições da peça/look, sem substituir essas condições. A seleção manual deve listar somente selos ativos da própria marca/celebridade, excluindo selos de perfil como pré-requisito. Seleção obrigatória vazia deve ser rejeitada, nunca convertida silenciosamente em política aberta.

O editor manual agora permite vários selos e ALL/ANY; o backend já avalia essas duas operações e valida a propriedade dos pré-requisitos. Ainda é necessário comprovar o fluxo completo de concessão e destaque com contas persistidas.

## Dois conceitos distintos

- **FLAIR Metamorfose:** transforma a arte da fotografia dentro dos cenários e modalidades de jogos FLAIR. Não habilita automaticamente uma arte de perfil fora do jogo.
- **AURA Metamorfose:** reage a consequências do sistema. Aumento de Hype sinaliza verde; queda sinaliza vermelho, apenas durante o evento. O primeiro carregamento não conta como ganho. Um destaque concedido por selo de perfil deve ativar um efeito de holofotes na borda enquanto o destaque for válido, respeitando redução de movimento.

O efeito de holofotes deve derivar de destaque efetivamente concedido pelo backend, e não da presença de qualquer selo ou de uma configuração livre do cliente. Esse vínculo e seu teste completo continuam pendentes nesta etapa.

## Repasse ao criador

A compra da loja do quarto agora identifica o criador do SKU e trava as carteiras de comprador/vendedor em ordem de UUID antes do item. O método usa READ_COMMITTED: a leitura prévia da identidade do vendedor não congela o saldo em um snapshot antigo. Se a identidade mudou antes da trava do SKU, a oferta deve ser atualizada. Débito SHOP_PURCHASE, crédito SHOP_SALE, estoque e inventário pertencem à mesma transação. Taxa zero; itens de fábrica sem criador não geram crédito a usuário. Compra própria é rejeitada. Receitas de venda não aumentam pontos vitalícios. O painel do criador mostra créditos reais de venda, não uma estimativa com o preço atual. Testes unitários passaram; concorrência e rollback em MySQL continuam pendentes.
