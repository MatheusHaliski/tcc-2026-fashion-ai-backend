# Exercício 19 — Modalidade visual da peça na AURA

**Situação na revisão `9f5512a77`:** Parcial: existe aura.format no contrato da Aura comum; explicitar validação/persistência sem criar modalidade paralela.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Definição do exercício.** Usar modalidade visual `aura.format=IMAGEM_UNICA|MOSAICO`, já declarada no [background-studio.tsx:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/background-studio.tsx#L24). Isso não é categoria da roupa, enquadramento tecido/total frame ou tier Bronze/Ouro. Não criar outro campo chamado mode para a mesma escolha.

2. **Schema/repository.** Reutilizar `wardrobe_items.background_config_json` e [WardrobeItemRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/WardrobeItemRepository.java#L19). Não há nova tabela exigida: o enunciado permite config validada. Guardar o formato dentro do objeto aura existente, preservando variantId e o restante da arte.

3. **Service.** Na validação pura de [StudioArtworkRules.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/StudioArtworkRules.java#L19), acrescentar/confirmar allowlist do formato e tipo do objeto aura. O endpoint de [BackgroundStudioService.java:620](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/BackgroundStudioService.java#L620) já exige permissão e dono. Não remover `requireAuraAccess` nem a checagem da configuração completa de artes licenciadas ao editar só o formato.

4. **Controller.** Reutilizar [BackgroundController.java:77](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/BackgroundController.java#L77); o corpo é a configuração, não um wrapper background. Validar preset/variantId em catálogo autorizado e rejeitar tipo/formato inválido. Se o endpoint espera config inteira, enviar cópia atual com o formato alterado para não apagar os demais campos.

5. **UI/leitura.** O seletor já está em [background-studio.tsx:181](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/background-studio.tsx#L181); manter blocos acessíveis e conservar rascunho no erro. No render de [card-art.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/card-art.tsx#L14) e [expanded-piece.tsx:63](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L63), derivar do background confirmado pelo GET. Tratar animação carregando/falha e alternativa identificada; não só trocar uma classe local sem persistência.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/19-modalidade-aura.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT id,user_id,
  JSON_EXTRACT(background_config_json,'$.aura.variantId') AS variant_id,
  JSON_EXTRACT(background_config_json,'$.aura.format') AS formato
FROM wardrobe_items WHERE id=@piece_id AND user_id=@owner_id;
SELECT id FROM wardrobe_items
WHERE JSON_EXTRACT(background_config_json,'$.aura.format') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(background_config_json,'$.aura.format')) NOT IN ('IMAGEM_UNICA','MOSAICO');
-- Sem ALTER; a API deve validar e salvar a configuração inteira necessária. Não escrever artes licenciadas por SQL.
```

## Integridade referencial: restrições e alternativas

JSON é estruturalmente válido como tipo MySQL, mas variantId/entitlement dentro dele não são FKs automáticas. Alternativas: manter validação de catálogo/licença no backend; ou normalizar a seleção/licença em tabela própria se for necessária FK SQL. Preset removido deve ter estado de indisponibilidade/fallback definido; nunca substituir arte comprada por outra silenciosamente. Só adicionar CHECK de formato depois de inspecionar dados legados e o contrato, sem bloquear configs antigas sem aura.

## Contrato HTTP

Existente: `PUT /api/pieces/{id}/background`; recorte `{"aura":{"variantId":"<variante autorizada>","format":"MOSAICO"}}`. Enviar também os demais campos que devam permanecer na configuração.

Resposta/projeção a conferir: `"background":{"aura":{"variantId":"...","format":"MOSAICO"}}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Dois formatos; formato inválido/tipo errado; peça alheia; preset/licença incompatíveis; edição conserva borda/paleta compradas; escolha sobrevive ao GET e é igual em Feed/detalhe. Distinguir controle de enquadramento de fotografia desta modalidade visual.

- **E1 a produzir:** Editor de Aura comum escolhendo Mosaico.
- **E2 a produzir:** Feed e detalhe recarregados exibindo o mesmo formato.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
