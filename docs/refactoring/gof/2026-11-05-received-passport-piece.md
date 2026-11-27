# Cópia segura da peça recebida

O serviço de passaporte misturava a transação de transferência com a construção da nova peça. A cópia também fixava uma imagem de camiseta para qualquer categoria.

Extração: `ReceivedPassportPiece.create` concentra a política de campos transferíveis e usa `AssetCatalogService` para resolver imagens. `GarmentPassportService` mantém transação, autorização, sequência, auditoria e persistência.

**GoF: NENHUM.** Uma função de construção estática basta; não há subclasses escolhendo o produto criado, portanto não é Factory Method GoF. Não introduzimos hierarquia ou um catálogo novo de estratégias para uma regra já atendida pelo resolver de assets.

A referência de conservação/lavagem acompanha a peça física; notas, fotos pessoais, selos, localização de compra e contadores não acompanham. A foto de catálogo mantém o comportamento anterior. Referências inativas existentes não são convertidas para outra condição.

Verificação: 20 testes de caracterização do serviço passam na base e na implementação; cinco novos casos verificam categoria, dados privados, conservação/lavagem e fallback. Testes com banco real permanecem separados.
