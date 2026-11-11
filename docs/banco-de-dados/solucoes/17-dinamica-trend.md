# Exercício 17 — Tipo de dinâmica da Trend

**Situação na revisão `9f5512a77`:** Base implementada: kind validado contra cinco códigos, com lista filtrável e publicação separada.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Reutilizar [CommunityTrend.java:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CommunityTrend.java#L14) e [V63__community_trends.sql:2](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V63__community_trends.sql#L2). Campo `kind` é VARCHAR validado; não é FK e não existe uma tabela de dinâmicas obrigatória pelo enunciado.

2. **Repository.** Reutilizar [CommunityTrendRepository.java:13](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CommunityTrendRepository.java#L13), consultas por status/janela e por kind. Preservar paginação; o filtro não deve incluir rascunhos de outras pessoas.

3. **DTO/service.** Códigos permitidos em [CommunityTrendService.java:22](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/CommunityTrendService.java#L22); `Create` recebe kind e create valida antes de gravar. Reutilizar [CommunityTrendService.java:53](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/CommunityTrendService.java#L53) para publicar e conceder pontos uma vez, sem dar prêmio pela simples criação/seleção.

4. **Controller.** [CommunityTrendController.java:12](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/CommunityTrendController.java#L12) já tem POST, GET com kind e POST `{id}/publish`. Não criar outro `/api/trends` incompatível. Se a atividade exigir edição do rascunho, criar PUT específico com dono/status DRAFT e revalidar kind; não liberar update irrestrito de trend publicada.

5. **UI/leitura.** Reutilizar [community-trends.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/challenges/community-trends.tsx#L14): oferecer somente os códigos reais e traduzir labels, serializar kind e filtrar a lista da comunidade. Loading, erro/retry e confirmação de publicação devem ser distintos do rascunho.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/17-dinamica-trend.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE community_trends;
SELECT kind,COUNT(*) AS quantidade FROM community_trends GROUP BY kind;
SELECT id,title,kind,status,published_at,ends_at FROM community_trends
WHERE status='PUBLISHED' AND ends_at>CURRENT_TIMESTAMP(6)
  AND kind='COR_EM_COMUM' ORDER BY published_at DESC;
-- Sem nova tabela/FK: o tipo validado já atende ao exercício.
-- Se for escolhido um CHECK futuro, validar antes todos os kind legados.
```

## Integridade referencial: restrições e alternativas

`kind` não tem FK no modelo; a FK de autor e a política de publicação continuam separadas. Remover um código da allowlist pode tornar rascunhos legados impossíveis de publicar; manter leitura/edição assistida ou criar equivalência explícita é alternativa. Uma tabela de opções é viável em evolução futura, com FK nullable e migração apenas de códigos conhecidos. Não apagar a trend para corrigir kind: eventos/recompensas e referência histórica devem ser preservados, e reenvio não pode duplicar ledger.

## Contrato HTTP

Existente: `POST /api/challenges/trends` com `{"title":"Azul em comum","description":"Uma composição por pessoa","kind":"COR_EM_COMUM","durationDays":7}`; depois `POST /api/challenges/trends/{id}/publish`.

Resposta/projeção a conferir: `"kind":"COR_EM_COMUM", "status":"PUBLISHED"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Cinco códigos válidos; inválido rejeitado; duração fora da regra; publicar trend de outro usuário; reenvio e concorrência não duplicam pontos. GET filtrado só retorna publicadas na janela; criar rascunho não concede recompensa.

- **E1 a produzir:** Criação da trend com dinâmica explícita.
- **E2 a produzir:** Lista da comunidade recarregada com tipo e publicação persistidos.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
