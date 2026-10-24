# Passaporte da peça e segunda vida — MVP

O passaporte identifica um registro de uma unidade física, ligado à peça pessoal do proprietário atual. A criação é uma ação explícita na peça do guarda-roupa; reaproveita origem, material e cuidados existentes. Produto global, GTIN, fotografia e registros semelhantes não fundem peças nem comprovam que duas contas possuem a mesma unidade física.

## Histórico e proveniência

`/pieces/{id}/passport` permite atualizar origem, composição e cuidados; cada atualização registra um snapshot no histórico. Compras declaradas, cuidados, reparos, alterações e correções são eventos acrescentados, com data não futura. Uma correção aponta ao evento próprio anterior e preserva o original. As anotações e snapshots detalhados são privados do autor; o novo proprietário recebe apenas tipo/data dos eventos antigos.

Todos os dados deste piloto são `OWNER_DECLARED`. Uma foto de comprovante tem estado `PRESENTED_UNVERIFIED`, sem conferir autenticidade, compra validada, sustentabilidade ou verificação por marca. Não existe endpoint para autoaprovar alegações nem emissor/verificador implementado. Selos Hype, licenças de Aura, pontos e conquistas continuam com seus serviços atuais; registrar cuidado ou transferir uma peça não concede recompensa.

## Documentos privados e retenção

Recibos de compra/reparo e etiquetas de cuidados aceitam somente imagens PNG/JPEG reais, de até 2 MB, no máximo 6.000 pixels por dimensão e 12 milhões de pixels. O servidor verifica assinatura e decodificação, regrava os pixels como PNG e descarta metadados e nome original. PDFs, outros formatos e arquivos inválidos são recusados.

O conteúdo fica em `passport_evidence.content_ciphertext`, cifrado pelo conversor AES-GCM existente e `DATA_ENCRYPTION_KEY`. Não há URL pública, upload em armazenamento público ou troca da chave antiga. Download autenticado verifica o controlador do documento a cada pedido, inclusive contra outro proprietário ou administrador, e usa `Cache-Control: no-store`, `nosniff` e nome de arquivo fixo. Documentos anteriores continuam privados do remetente após a transferência. Ao abrir o passaporte da peça antiga, o ex-dono pode baixar/apagar apenas seus comprovantes históricos, sem acessar declarações ou documentos do novo proprietário; o vínculo histórico é conferido no servidor.

Documentos expiram em 365 dias. O download recusa conteúdo expirado imediatamente; o job diário de 03:25 remove o payload e o hash expirados. Apagar um documento remove seu conteúdo e hash. O hook `PassportAccountDataCleanup`, chamado no expurgo da conta, remove documentos e anotações do usuário mesmo após transferências, anonimiza seus vínculos históricos, cancela ofertas pendentes e revoga seus links. O passaporte, os dados de composição/cuidados e os links de um novo proprietário são preservados. O hook e a limpeza agendada permanecem ativos mesmo com o piloto desligado.

## Compartilhamento e QR

O escopo começa vazio. O proprietário pode compartilhar nome, origem, composição, cuidados e/ou histórico resumido por 1 a 720 horas. Histórico público contém apenas tipo, data e proveniência: nenhum recibo, anotação privada, foto pessoal, endereço, identidade de proprietário ou ID de peça integra essa projeção. Textos de composição/cuidados escolhidos para publicação são transmitidos como declarados; devem conter apenas informações da roupa.

O token aleatório tem 256 bits; somente seu SHA-256 é persistido. O token e o link completo são revelados na criação. O QR é gerado localmente com `qrcode` 1.5.4 e aponta à rota pública `/passport/{token}`. Ele pode ser copiado e não autentica o objeto físico. A página não exige sessão de conta, solicita a API sem `Authorization` e inclui metadados `noindex` e `no-referrer`.

A API pública recusa tokens inválidos, expirados ou revogados, contas inativas, mudança de dono e peça arquivada. A resposta usa `no-store`, `no-referrer` e `X-Robots-Tag`; há limite de 120 consultas por IP em dez minutos. Revogar um link é definitivo. O evento existente `PieceDeleted` também revoga links e cancela a oferta pendente na mesma transação do arquivamento, sem afetar o passaporte já transferido de uma peça histórica.

## Transferência e revenda

A oferta exige destinatário específico ativo, e-mail confirmado, ausência de bloqueio e prazo de até 168 horas. A interface usa 48 horas. O código privado de aceite é revelado uma única vez ao remetente, que o entrega ao destinatário. O aceite exige a conta destinatária autenticada, o código, a versão e uma oferta vigente; substituição ou cancelamento invalida ofertas anteriores.

O aceite trava passaporte e transferência, encerra a posse anterior e cria exatamente uma peça privada para o destinatário. A peça anterior permanece arquivada com seu autor histórico e seus looks. Comprovantes pessoais, notas da peça, local de compra, fotos pessoais, selos, contagem de usos, Aura e recompensas não passam ao destinatário. Imagem de catálogo pode ser reaproveitada; foto pessoal é substituída pela referência padrão. Links públicos antigos são revogados. Restrição única no banco garante uma posse ativa e tentativas repetidas retornam a mesma peça recebida.

O resumo de revenda consulta `forSale`/`forDonation`, disponibilidade, estado, preço e moeda do cadastro atual; recusa peça arquivada, indisponível ou sem anúncio. Retorna composição, cuidados, origem e histórico resumido com `NOT_VERIFIED`, sem publicar automaticamente nem abrir outro anúncio, catálogo ou checkout.

## API e operação

`fashionai.passport.enabled` é `true` por padrão; `false` interrompe acesso e comandos do piloto sem apagar dados ou reverter transferências. A migração `V80__garment_passports.sql` cria seis tabelas, versões otimistas, hashes únicos e restrições de idempotência. Não insere passaportes ou comprovantes de demonstração.

| Rotas | Finalidade |
| --- | --- |
| `GET/POST /api/pieces/{pieceId}/passport` | Leitura/criação pelo dono da peça |
| `PUT /api/passports/{id}` | Atualização de declaração com `version` |
| `POST /api/passports/{id}/events` | Novo evento privado, com `version` |
| `POST /api/passports/{id}/evidence` | Multipart `file` e `kind` |
| `GET /api/passports/{id}/my-evidence` | Documentos do próprio controlador |
| `GET /api/passport-evidence/{id}/content` | Download privado autenticado |
| `DELETE /api/passport-evidence/{id}` | Exclusão privada |
| `POST /api/passports/{id}/shares` | Projeção escolhida com `version`, `fields`, `expiresInHours` |
| `DELETE /api/passports/{id}/shares/{shareId}` | Revogação |
| `GET /api/passport-shares/{token}` | Somente projeção pública |
| `GET /api/passports/{id}/resale-draft` | Resumo a partir do anúncio existente |
| `POST /api/passports/{id}/transfers` | Oferta com `version`, `recipientUsername`, `expiresInHours` |
| `DELETE /api/passports/{id}/transfers/{transferId}` | Cancelamento pelo remetente |
| `GET /api/me/passport-transfers` | Ofertas recebidas |
| `POST /api/passport-transfers/{id}/accept` | Aceite com `version` e `token` |

Criação, eventos, uploads, ofertas e aceite exigem `Idempotency-Key` de 8 a 80 caracteres alfanuméricos, `_` ou `-`. Reenvio com a mesma chave não duplica o registro. Tokens de oferta não são recuperáveis em retry; uma nova oferta gera novo código. Conflitos de versão devolvem 409 para recarregar o estado atual. A leitura de uma peça já transferida devolve 409 `PASSPORT_TRANSFERRED` com somente o ID do passaporte ligado à posse histórica própria; a interface usa esse ID para listar os comprovantes do controlador autenticado.

## Validação e limites

`GarmentPassportServiceTest` cobre dono/admin, declarações sem autoaprovação, versões, correções, escopo público, tokens, assinatura/tamanho de imagens, documentos privados, ofertas e transferências, arquivamento e expurgo de contas. `PassportPersistenceTest` usa Hibernate/H2 para verificar ciphertext real, remoção do ciphertext do ex-dono, restrição de posse ativa e aceite simultâneo. `components/passport/passport.test.tsx` cobre criação explícita, compartilhamento seletivo/QR local, revogação, reparo privado, aceite pelo código e leitura pública anônima.

Os testes não demonstram autenticidade física, procedência certificada ou valorização na revenda. Verificação por emissor, disputas entre posses declaradas e comercialização/pagamento ficam fora deste MVP.
