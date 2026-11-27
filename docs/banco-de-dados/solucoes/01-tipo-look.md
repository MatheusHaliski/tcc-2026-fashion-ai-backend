# Exercício 01 — TipoLook no espelho e no detalhe do look

**Situação na revisão `9f5512a77`:** Base implementada para espelho → look; o builder manual ainda tem contrato distinto.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Reutilizar [V60__tipo_look_no_espelho.sql:3](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V60__tipo_look_no_espelho.sql#L3). Já existem `TipoLook`, `mirror_states.tipo_look_id` e `schemes.tipo_look_id`. Não criar outra tabela `tipos_look`.

2. **Entidades/DTO de leitura.** Conferir [Scheme.java:43](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Scheme.java#L43) e [Views.java:206](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L206). O espelho deve copiar a referência ao salvar, não converter o nome em texto.

3. **Repository.** Reutilizar [TipoLookRepository.java:8](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/TipoLookRepository.java#L8) e `findAllByOrderByNomeAsc`; `findById` resolve o UUID. `SchemeRepository` e o repository do espelho já persistem a relação; nenhuma query nova é necessária para este exercício.

4. **Service.** Em [MirrorService.java:332](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/MirrorService.java#L332), manter resolução do ID e estado do usuário. Em [MirrorService.java:1166](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/MirrorService.java#L1166), manter a cópia para o look salvo. Não inferir gênero da pessoa a partir desse campo. Para ampliar ao cadastro manual, acrescentar `tipoLookId`/clear explícito ao `SchemeForm` em [SchemeService.java:417](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L417) e extrair um `SchemeLookTypeWriter`; esse complemento não é requisito para duplicar o fluxo do espelho.

5. **Controller.** Reutilizar [TipoLookController.java:12](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/TipoLookController.java#L12) para opções e [MirrorController.java:30](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/MirrorController.java#L30) para `PUT /api/me/mirror/tipo-look`. O detalhe usa o `SchemeController` existente em [SchemeController.java:29](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SchemeController.java#L29).

6. **Tela.** Em [mirror-controls.tsx:161](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/mirror/mirror-controls.tsx#L161), manter GET de opções e seleção deliberada; em [scheme-card.tsx:266](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-card.tsx#L266), mostrar o valor retornado após GET. Desabilitar a seleção durante envio e conservar o valor quando uma gravação falhar. Se estender ao builder, inicializar/serializar o ID em [scheme-builder.tsx:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-builder.tsx#L71) sem substituir referências existentes por null silenciosamente.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/01-tipo-look.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE TipoLook;
SELECT id,codigo,nome FROM TipoLook ORDER BY nome;
SELECT s.id,s.tipo_look_id,t.codigo,t.nome
FROM schemes s LEFT JOIN TipoLook t ON t.id=s.tipo_look_id
WHERE s.id=@scheme_id;
SELECT m.user_id,m.tipo_look_id FROM mirror_states m WHERE m.user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

A V60 não declara ON DELETE/UPDATE: no InnoDB a referência impede apagar ou trocar o ID de uma opção em uso (RESTRICT/NO ACTION). Alterar `nome` não viola a FK; trocar `codigo` pode quebrar contratos mesmo preservando o UUID. Alternativas: manter o UUID, corrigir apenas o nome; acrescentar `ativo` em migration futura e retirar a opção somente de novas seleções; ou migrar referências com decisão explícita. Apagar e recriar a tabela perde a continuidade e não é solução. Registros antigos com NULL continuam sem escolha.

## Contrato HTTP

Existente: `GET /api/tipos-look`; `PUT /api/me/mirror/tipo-look` com `{"tipoLookId":"<id da opção>"}`; salvar o look pela ação já usada no espelho e reler seu detalhe.

Resposta/projeção a conferir: `"tipoLook": {"id":"...","codigo":"UNISEX","nome":"Unisex"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Verificar as três opções; UUID inexistente; acesso sem sessão; isolamento entre usuários; look antigo com NULL. Em banco de teste, tentar DELETE de TipoLook referenciado deve falhar com1451. Corrigir o nome deve refletir na leitura sem mudar o ID.

- **E1 a produzir:** Seleção no espelho com a opção da API.
- **E2 a produzir:** Look salvo, página recarregada, TipoLook no detalhe.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
