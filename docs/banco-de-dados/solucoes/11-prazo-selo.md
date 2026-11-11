# Exercício 11 — Prazo de disponibilidade do selo

**Situação na revisão `9f5512a77`:** Base implementada com available_from/available_until e validação de ordem.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Reutilizar [Seal.java:58](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Seal.java#L58) e `availableUntil`. O prazo para solicitar o selo é diferente de `grantValidityDays`, que trata validade do vínculo concedido. Não criar outra tabela de prazos.

2. **Repository.** Reutilizar [SealRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/SealRepository.java#L19). Filtros novos do mercado devem considerar início/fim com parâmetros de Instant; não armazenar um booleano expirado que fique desatualizado.

3. **Service/DTO.** O formulário e a persistência já passam pelo SealService/SealFormWriter. Conferir [SealFormWriter.java:137](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealFormWriter.java#L137); aceita limites nulos e rejeita fim anterior ao início. Validar também no instante de solicitação de vínculo, não apenas ocultar o selo na lista. Se mudar a regra para duração estritamente positiva, atualizar service, CHECK e testes em conjunto.

4. **Controller.** Reutilizar as rotas de criar/editar selo em [SealController.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealController.java#L27). A sessão define emissor/dono; usuário comum não pode alterar disponibilidade de selo de outra marca.

5. **UI/leitura.** Em [seal-wizard.tsx:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/seal-wizard.tsx#L27), conferir datas locais convertidas para UTC e campos já existentes. Na leitura do mercado, mostrar início/fim e estado agendado/encerrado calculado pelo servidor. Erro de validação mantém datas preenchidas; null não deve aparecer como1970.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex11.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/11-prazo-selo.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE seals;
SELECT id,available_from,available_until FROM seals
WHERE available_from IS NOT NULL AND available_until IS NOT NULL
  AND available_until<available_from;
-- Opcional, apenas se ainda não houver CHECK equivalente e a consulta acima vier vazia:
ALTER TABLE seals ADD CONSTRAINT ck_seals_availability_order
  CHECK(available_from IS NULL OR available_until IS NULL OR available_until>=available_from);
SELECT id,name,available_from,available_until,
  CASE WHEN available_from>CURRENT_TIMESTAMP(6) THEN 'AGENDADO'
       WHEN available_until<CURRENT_TIMESTAMP(6) THEN 'ENCERRADO'
       ELSE 'DISPONIVEL_NO_PERIODO' END AS periodo
FROM seals WHERE id=@seal_id;
```

## Integridade referencial: restrições e alternativas

Datas não são FKs. Alterar o prazo não autoriza excluir o selo: vínculos e promoções podem referenciá-lo; as ações reais devem ser consultadas no SQL00. Um CHECK novo falha se houver períodos inválidos legados. Corrigir apenas registros confirmados em uma migration de dados revisada, ou manter o CHECK para uma segunda etapa. Prefira encerrar/pausar a disponibilidade a apagar o registro. Não estender/revogar vínculos anteriores por efeito colateral sem regra explícita.

## Contrato HTTP

Recorte das rotas existentes de selo: `{"availableFrom":"2026-12-01T12:00:00Z","availableUntil":"2026-12-10T12:00:00Z"}`; enviar o restante do formulário exigido.

Resposta/projeção a conferir: `"availableFrom":"2026-12-01T12:00:00Z", "availableUntil":"2026-12-10T12:00:00Z"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Ordem válida/invertida, null parcial/total, limites de instante e fuso, emissor alheio; tentativa de solicitar selo depois de vencer deve ser revalidada no backend. Testar mudança de disponibilidade sem destruir vínculos antigos.

- **E1 a produzir:** Wizard com o intervalo configurado.
- **E2 a produzir:** Mercado recarregado exibindo o mesmo intervalo e estado correspondente.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
