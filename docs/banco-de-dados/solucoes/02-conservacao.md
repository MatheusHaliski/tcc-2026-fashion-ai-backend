# Exercício 02 — Estado de conservação da peça

**Situação na revisão `9f5512a77`:** FK, opções, service e formulário já implementados; reutilizar a estrutura existente.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Usar [V77__wardrobe_conservation_and_wash_references.sql:3](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V77__wardrobe_conservation_and_wash_references.sql#L3) e [V83__conservation_options.sql:3](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V83__conservation_options.sql#L3) para `ativo` e opções iniciais; não criar `estados_conservacao` ou `estado_conservacao_id`. Os nomes reais são `EstadoConservacao` e `wardrobe_items.estado_de_conservacao`.

2. **Entidades/DTO.** Reutilizar [EstadoConservacao.java:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/EstadoConservacao.java#L16) e [WardrobeItem.java:167](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L167). `item_condition` continua legado. No contrato [WardrobeService.java:337](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L337), manter `estadoConservacaoId` e `clearEstadoConservacao`; limpar é uma ação explícita.

3. **Repository.** Reutilizar [EstadoConservacaoRepository.java:9](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/EstadoConservacaoRepository.java#L9) e a consulta de opções ativas. Não eliminar a possibilidade de carregar por ID uma referência antiga inativa.

4. **Service.** Preservar a semântica em [PieceConservationService.java:21](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceConservationService.java#L21): ID omitido mantém; clear limpa; ID igual ao salvo permanece mesmo inativo; escolha nova exige opção ativa. A chamada está em [PieceFormWriter.java:77](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceFormWriter.java#L77), após autorização do dono no WardrobeService.

5. **Controller.** Já há alias `GET /api/opcoes/estados-conservacao` em [PieceReferenceController.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/PieceReferenceController.java#L24); a edição passa pelo `PUT /api/pieces/{id}` em [WardrobeController.java:99](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/WardrobeController.java#L99). Sem endpoint novo para editar o catálogo pelo proprietário da peça.

6. **Tela/leitura.** Reutilizar [piece-conservation-field.tsx:9](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-conservation-field.tsx#L9) e [piece-form.tsx:124](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-form.tsx#L124); a edição do modal inicializa o ID em [expanded-piece.tsx:107](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L107). [piece-card-panels.tsx:47](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-card-panels.tsx#L47) mostra a conservação no card. Manter loading, erro/retry, nenhuma seleção e valor salvo indisponível.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/02-conservacao.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE `EstadoConservacao`;
SHOW CREATE TABLE wardrobe_items;
SELECT id,codigo,nome,ativo FROM `EstadoConservacao` ORDER BY nome;
SELECT w.id,w.item_condition,w.estado_de_conservacao,e.codigo,e.nome
FROM wardrobe_items w LEFT JOIN `EstadoConservacao` e ON e.id=w.estado_de_conservacao
WHERE w.id=@piece_id AND w.user_id=@owner_id;
-- Alternativa administrativa em laboratório: desativar, sem remover referências.
UPDATE `EstadoConservacao` SET ativo=FALSE,updated_at=CURRENT_TIMESTAMP(6) WHERE id=@option_id;
```

## Integridade referencial: restrições e alternativas

A V77 define ON DELETE SET NULL / ON UPDATE CASCADE. Excluir a opção apaga a referência da peça, embora não apague a peça; mudar o UUID propaga à FK, mas pode invalidar links/caches. Prefira `ativo=FALSE` e IDs estáveis. `codigo` é UNIQUE: não pode duplicar um código. O catálogo pode já ter opções cadastradas manualmente: preservar IDs e nomes, e não preencher todos os legados com BOA, pois GOOD pode ter sido apenas default do código. Reativar uma opção ou mapear referências após análise são alternativas à exclusão.

## Contrato HTTP

Existente: `PUT /api/pieces/{id}`, campos relevantes `{"estadoConservacaoId":"<UUID>","clearEstadoConservacao":false}`; para limpar, ID null e clear true. O GET do detalhe deve devolver a referência.

Resposta/projeção a conferir: `"estadoConservacao": {"id":"...","codigo":"BOA","nome":"Boa"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Testar cada opção realmente cadastrada; UUID inexistente; ID inativo novo rejeitado; referência inativa inalterada aceita ao editar nome; limpar; peça alheia; legado sem escolha. Conferir conservação no card e modal, sem expor fallback GOOD como escolha informada.

- **E1 a produzir:** Editar peça escolhendo opção real.
- **E2 a produzir:** Card e modal recarregados com o mesmo ID/nome.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
