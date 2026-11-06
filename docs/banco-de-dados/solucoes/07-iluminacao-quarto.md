# Exercício 07 — Tipo de iluminação e temperatura do quarto

**Situação na revisão `9f5512a77`:** Parcial: kelvin/intensidade/on já são guardados em modules_json; falta a FK TipoIluminacao exigida.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Criar `tipos_iluminacao` e referências/temperatura nullable no RoomLayout, conforme SQL. Em [RoomLayout.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/RoomLayout.java#L28), os módulos JSON já contêm a configuração de luz; não criar outra entidade de quarto nem copiar o usuário.

2. **Entidade/repository.** Criar `TipoIluminacao`/repository com código, nome e ativo. Acrescentar `tipoIluminacao` e `temperaturaKelvin` em RoomLayout; usar [RoomLayoutRepository.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/RoomLayoutRepository.java#L15) e novo `TipoIluminacaoRepository.findAllByAtivoTrueOrderByNomeAsc`.

3. **Service.** Extrair `RoomLightingWriter` do bloco [RoomService.java:424](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L424). Reavaliar nível/permissão existentes, resolver FK ativa e validar 2700–6500K. Definir os campos relacionais como fonte principal e derivar o JSON devolvido para a cena; legado sem FK continua lendo o JSON anterior. Não manter dois valores divergentes após salvar. Preservar o comportamento de clientes antigos com somente kelvin, explicitando qualquer mudança futura da regra de clamp.

4. **Controller.** Acrescentar `tipoIluminacaoId` ao `LightRequest` em [RoomController.java:140](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/RoomController.java#L140); manter `PUT /api/me/room/light`, sem aceitar userId arbitrário no corpo. Novo `GET /api/opcoes/tipos-iluminacao` em controller curto de referências.

5. **UI e leitura.** Em [room-settings-panel.tsx:30](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/room3d/room-settings-panel.tsx#L30), acrescentar seleção e temperatura; carregar opções antes de habilitar a escolha. A cena em [room-scene.tsx:86](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/room3d/room-scene.tsx#L86) deve usar o GET confirmado após reload. Manter erro/retry, permissão por nível e estado legado sem classificação.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/TipoIluminacao.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/TipoIluminacaoRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/RoomLightingWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/RoomReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex07.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/07-iluminacao-quarto.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `tipos_iluminacao` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'AMBIENTE','Ambiente',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'DIRECIONADA','Direcionada',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'DIFUSA','Difusa',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE room_layouts ADD COLUMN tipo_iluminacao_id CHAR(36) NULL,
  ADD COLUMN temperatura_kelvin INT NULL;
ALTER TABLE room_layouts ADD CONSTRAINT fk_room_layout_tipo_iluminacao
  FOREIGN KEY(tipo_iluminacao_id) REFERENCES tipos_iluminacao(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT ck_room_layout_kelvin
  CHECK(temperatura_kelvin IS NULL OR temperatura_kelvin BETWEEN 2700 AND 6500);
SELECT user_id,tipo_iluminacao_id,temperatura_kelvin,modules_json
FROM room_layouts WHERE user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

FK proposta RESTRICT: não remover o tipo utilizado por um quarto; desativá-lo mantém o vínculo e permite leitura. A FK de room_layouts.user_id não autoriza editar outro quarto. SET NULL com fallback documentado é alternativa se perder a classificação for aceitável; CASCADE para excluir o quarto não é apropriado. CHECK da temperatura protege somente a faixa, não comprova correspondência física com uma lâmpada. Não aplicar NOT NULL antes de resolver os layouts legados.

## Contrato HTTP

Proposto: `PUT /api/me/room/light`, `{"tipoIluminacaoId":"<UUID>","kelvin":4000,"intensity":0.75,"on":true}`; `GET /api/me/room` retorna a luz confirmada.

Resposta/projeção a conferir: `"light": {"tipoIluminacao":{"id":"...","codigo":"DIFUSA","nome":"Difusa"},"kelvin":4000,"intensity":0.75,"on":true}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Faixa válida, fora da faixa no novo contrato, FK inexistente/inativa, usuário sem nível, legado JSON sem FK. Recarregar confirma o mesmo tipo/temperatura no painel e na cena; falha de envio não deve parecer salvamento bem-sucedido.

- **E1 a produzir:** Painel com tipo e temperatura selecionados.
- **E2 a produzir:** Cena e painel após reload mantendo os valores.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
