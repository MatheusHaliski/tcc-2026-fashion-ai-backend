# FLAIR Marketplace

O perfil verificado é vinculado à marca do catálogo por slug e domínio oficial. Esse vínculo disponibiliza os produtos
e endereços que já pertencem à marca. A localização no catálogo tem endereço obrigatório. Endereços em lote são
importados por identificador estável, sem interferir na publicação de produtos nas vitrines.

A peça digital nasce no guarda-roupa. A opção **À venda** em perfis verificados cria uma referência comercial com
identidade própria. A foto, o GLB e as métricas continuam associados à peça de origem. Ao escolher uma loja no Criador,
a peça recebe `physical_store_item_id` e entra na vitrine dessa loja. O registro opcional de venda informa o valor em
FAI Points recebido pela loja e entra no relatório do período.

A marca pode publicar uma oferta diretamente com **À venda**, com data de expiração opcional no horário de Brasília.
Uma proposta entre duas partes só é publicada após o aceite da versão atual. Na expiração, ambas as modalidades
saem dos canais de venda, e a peça volta ao Closet de origem. As propostas preservam o histórico. O bônus de parceria
só é creditado uma vez por peça.

A Loja FAI vende itens digitais. A compra usa o saldo FAI Points e registra a entrega na mesma transação. Presets seguem
o licenciamento de arte existente. A compra de um design de selo libera seu uso no Criador de Selos.

## Decisões de estrutura

- O diretório compõe repositórios distintos para lojas, mapas e perfis em `MarketplaceDirectoryService` (Facade).
- A estrutura do card de peça é compartilhada por composição em `PieceCardFrame`. As ações do Criador e do Provador
  seguem o contexto de entrada.
- A separação de constantes SQL e de normalização da configuração de e-mail mantém colaboradores coesos. Nenhum padrão
  GoF adicional.

## Origem do diretório inicial

O CSV em `data/catalog/physical-stores/adidas-sp.csv` contém 19 lojas Adidas da página oficial de localização consultada
em 28/11/2026. Cada linha conserva a URL oficial da unidade. Os registros de shopping e ruas agrupam lojas por local.
Sem planta publicada, a interface apresenta um mapa esquemático. O importador também aceita uma planta HTTPS e as
coordenadas normalizadas de cada loja quando a fonte fornece esses dados.

[Localizador oficial da Adidas](https://www.adidas.com.br/stores)
