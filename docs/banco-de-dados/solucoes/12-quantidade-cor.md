# Exercício 12 — Política do selo: quantidade mínima por cor

**Situação na revisão `9f5512a77`:** Estrutura rules/count/color já existe e é validada; usar a política estruturada, não texto livre.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Persistência.** A política estruturada é colocada em `background_config_json.policy`, conforme [SealFormWriter.java:125](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealFormWriter.java#L125); `policy_text` é descrição, não a coluna JSON das regras. Não adicionar uma suposta `policy_json` sem necessidade.

2. **DTO/repository.** Reutilizar o formulário de selo e [SealRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/SealRepository.java#L19). O contrato Rule em [SealPolicies.java:54](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicies.java#L54) já possui quantifier/count/color. Nenhuma tabela de cor nova é exigida pelo exercício.

3. **Service de validação.** Em [SealPolicyNormalizer.java:51](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyNormalizer.java#L51), preservar o limite atual AT_LEAST1–4 e cores da taxonomia. Se o requisito didático exigir count estritamente inteiro, rejeitar número fracionário antes de `intValue()` em vez de truncar2,8 para2. Não ampliar limites só na UI.

4. **Avaliação.** Em [SealPolicyEvaluator.java:100](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyEvaluator.java#L100), conferir que a quantidade seja de peças distintas que passam na mesma regra, e não a soma de peças de outras cores. Uma regra2blue não deve ser atendida por1blue+1red.

5. **Controller.** Reutilizar `SealController` em [SealController.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealController.java#L27); prévia de elegibilidade deve chamar o mesmo avaliador do pedido real, com autorização do dono do look/peça. Não liberar edição da política pelo visitante.

6. **Tela/leitura.** [seal-policy-editor.tsx:115](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/seal-policy-editor.tsx#L115) e [manual-seal-policy.tsx:11](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/manual-seal-policy.tsx#L11) devem emitir a regra estruturada. Mostrar na prévia as peças contadas e motivo de falha, tratar loading/erro e preservar rascunho. Não converter toda política antiga sem rules em condição obrigatória.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/12-quantidade-cor.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT id,JSON_EXTRACT(background_config_json,'$.policy') AS policy FROM seals WHERE id=@seal_id;
SELECT s.id,r.quantifier,r.minimum_count,r.color FROM seals s
JOIN JSON_TABLE(COALESCE(JSON_EXTRACT(s.background_config_json,'$.policy.rules'),JSON_ARRAY()),
  '$[*]' COLUMNS(quantifier VARCHAR(20) PATH '$.quantifier',
                minimum_count INT PATH '$.count',color VARCHAR(80) PATH '$.color')) AS r ON TRUE
WHERE s.id=@seal_id;
-- Não há alteração de schema para count/color; validar e salvar via service existente.
```

## Integridade referencial: restrições e alternativas

IDs/códigos dentro de JSON não têm FK SQL. A presença de `Taxonomy.COLORS` é validação de aplicação; desativar ou renomear um código pode afetar políticas antigas. Alternativas: códigos estáveis com alias de leitura; nova versão da política; ou normalizar regras/cor em tabelas com FK se a integridade relacional for requisito. Não tentar criar FOREIGN KEY diretamente para `$.policy.rules[*].color`. Uma alteração nas regras deve respeitar a política de revalidação dos vínculos já concedidos.

## Contrato HTTP

Recorte do formulário existente: `{"policy":{"rules":[{"quantifier":"AT_LEAST","count":2,"color":"blue"}]}}`. Em modo manual, manter os demais campos de geração/referência que o editor atual exige.

Resposta/projeção a conferir: `"policy": {"rules":[{"quantifier":"AT_LEAST","count":2,"color":"blue"}]}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

2 azuis passam;1 azul+1 vermelha falha; color inválida, count 0/5/2.5 rejeitados conforme contrato inteiro; peça repetida não dobra contagem; visitante não altera. Testar prévia e pedido real com o mesmo conjunto de IDs.

- **E1 a produzir:** Editor da política com mínimo2 azuis.
- **E2 a produzir:** Prévia recarregada mostrando contagem e elegibilidade das peças.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
