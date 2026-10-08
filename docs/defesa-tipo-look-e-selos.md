# Defesa: TipoLook e verificação de selos (RF5/RF13)

## Tipo de look no Espelho

A migração Flyway V56 cria a tabela `TipoLook` com Feminino, Masculino e Unisex. `mirror_states.tipo_look_id` e `schemes.tipo_look_id` são chaves estrangeiras para esse catálogo. Looks anteriores ficam sem classificação até que o usuário escolha uma opção.

1. Abra `/mirror` e escolha **Tipo de look**. As opções são carregadas do banco.
2. Recarregue a página: a escolha deve continuar selecionada.
3. Insira pelo menos duas peças e salve o look.
4. Abra `/schemes/{id}`: o tipo aparece no card do look. Também aparece nas listas que utilizam esse card.
5. Escolher outro tipo e salvar as mesmas peças cria outro look, preservando a classificação do anterior.

### Postman

Use a URL da API como `{{baseUrl}}` e Authorization → Bearer Token com o `accessToken` da autenticação. Envie JSON com `Content-Type: application/json`.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/tipos-look` | Catálogo do banco (`id`, `codigo`, `nome`) |
| PUT | `/api/me/mirror/tipo-look` | Persistir a escolha |
| GET | `/api/me/mirror` | Conferir `tipoLook` após recarregar |
| POST | `/api/me/mirror/pieces` | Adicionar peça ao Espelho |
| POST | `/api/me/mirror/save` | Salvar o look com o tipo escolhido |
| GET | `/api/schemes/{id}` | Conferir `tipoLook` no look salvo |

Corpo do PUT (use o ID retornado pelo catálogo):

```json
{"tipoLookId":"56000000-0000-4000-8000-000000000001"}
```

Adicionar peça: `{"pieceId":"UUID_DA_PECA"}`. Salvar: `{"title":"Look da defesa","publish":false}`. Um ID de tipo inexistente deve retornar HTTP 400; não cria uma opção nova.

## Selos nos criadores

No RF5 (`/schemes/new` ou edição), **Detalhes → Selos do look** consulta os selos possíveis e oferece **Verificar selos** para tentar novamente. Alterar peças, estilo ou ocasião invalida escolhas antigas. Celebridades exigem consentimento de imagem. Os pedidos selecionados são enviados depois que o look é salvo; apenas envios bem-sucedidos entram na contagem da mensagem.

No RF13 (`/dna-schemes/new` ou edição), **Detalhes → Verificação de selos dos looks** consulta cada look referenciado, com suas próprias peças, estilo, ocasião e Hype atual. Mostra vínculos aprovados e pendentes e não oferece pedido duplicado para esses emissores. Os novos pedidos escolhidos são enviados aos looks correspondentes depois que o DNA é salvo. Selos pertencem aos looks que compõem o DNA; a consulta não concede um selo independente ao DNA.

| Método | Rota | Uso |
| --- | --- | --- |
| POST | `/api/seal-suggestions/preview` | RF5: consulta sem salvar o look |
| GET | `/api/schemes/{id}/seal-preview` | RF13: consulta sem alterar vínculos do look salvo; somente dono/administrador |
| POST | `/api/schemes/{id}/seal-bonds` | Enviar pedido após salvar |

Corpo da consulta RF5:

```json
{"pieceIds":["UUID_PECA_1","UUID_PECA_2"],"occasion":[],"style":[]}
```

Corpo do pedido de celebridade (para marca, omita o consentimento):

```json
{"targetOwnerId":"UUID_DO_EMISSOR","imageRightsConsent":true}
```

Uma sugestão indica elegibilidade. Aprovação, revisão pelo emissor e revalidação continuam seguindo as políticas existentes do backend.
