# Exercício 16 — CBC: modalidade/cenário preferido

**Situação na revisão `9f5512a77`:** Parcial: desafios têm scenario e validação própria; preferência individual não deve reescrever o desafio global.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Definir o alcance.** Em [FlairChallenge.java:47](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairChallenge.java#L47), scenario é configuração do desafio. Resolver este exercício como preferência por usuário+desafio entre cenários autorizados, sem mudar janela, pontos, dificuldade ou requisitos oficiais.

2. **Schema/entidades.** Criar `CbcScenario`, associação desafio×cenários e `CbcPreference`, com chave usuário+desafio. A FK composta de preferência para a associação prova que o cenário está permitido naquele desafio. Usar nomes e tipos do SQL; não adicionar uma preferência global em FlairChallenge.

3. **Repositories.** Reutilizar [FlairChallengeRepository.java:11](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/FlairChallengeRepository.java#L11); criar `CbcScenarioRepository`, `CbcChallengeScenarioRepository` e `CbcPreferenceRepository.findByUserIdAndChallengeId`. O ID composto pode ser Embeddable/IdClass, mantendo os dois tipos UUID.

4. **Service.** Criar `CbcPreferenceService`: validar desafio visível, opção ativa, associação permitida e cenário suportado pelo renderer. O código atual valida o formato de scenario em [FlairChallengeService.java:905](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairChallengeService.java#L905), mas formato sintático não prova que haja arte/cenário implementado. Preferência não concede pontos nem altera submissões existentes.

5. **Controller.** Em controller específico curto: `GET /api/flair/challenges/{id}/scenarios`, `PUT /api/flair/challenges/{id}/preference`, `GET` da mesma preferência. Integrar à leitura da central existente no [FlairChallengeController.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/FlairChallengeController.java#L24). Usar CurrentUser; não aceitar userId do corpo.

6. **Tela.** Em [cbc.tsx:149](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/cbc.tsx#L149), escolher apenas alternativas autorizadas e tratar loading/retry/nenhuma preferência; [cbc-scene.tsx:74](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/cbc-scene.tsx#L74) renderiza o cenário conhecido. A central deve recarregar a preferência; um código novo no banco sem implementação visual fica indisponível, não vira rota arbitrária.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcScenario.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcChallengeScenario.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcPreference.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcChallengeScenarioId.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcPreferenceId.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CbcScenarioRepository.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CbcChallengeScenarioRepository.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CbcPreferenceRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CbcPreferenceService.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/CbcPreferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex16.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/16-preferencia-cbc.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `cbc_scenarios` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ipanema','Ipanema',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'gala','Gala',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'livre','Livre',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

CREATE TABLE cbc_challenge_scenarios (
  challenge_id CHAR(36) NOT NULL,scenario_id CHAR(36) NOT NULL,
  PRIMARY KEY(challenge_id,scenario_id),
  CONSTRAINT fk_ccs_challenge FOREIGN KEY(challenge_id) REFERENCES flair_challenges(id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_ccs_scenario FOREIGN KEY(scenario_id) REFERENCES cbc_scenarios(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE cbc_preferences (
  user_id CHAR(36) NOT NULL,challenge_id CHAR(36) NOT NULL,scenario_id CHAR(36) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(user_id,challenge_id),
  CONSTRAINT fk_cbcp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_cbcp_allowed FOREIGN KEY(challenge_id,scenario_id)
    REFERENCES cbc_challenge_scenarios(challenge_id,scenario_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
-- Associar opções a desafios somente depois de conferir compatibilidade com o renderer/regras.
SELECT c.id,c.scenario,c.status FROM flair_challenges c WHERE c.id=@challenge_id;
```

## Integridade referencial: restrições e alternativas

A FK composta impede escolher um cenário cadastrado mas não permitido no desafio. RESTRICT impede retirar uma associação usada; migrar/limpar as preferências antes de removê-la ou apenas desativar a opção para novas escolhas. Embora o desafio tenha CASCADE para a associação, o RESTRICT das preferências pode bloquear a exclusão em cascata: encerrar/arquivar desafio é alternativa segura; se a exclusão for necessária em teste, remover preferências, depois associações e só então o desafio, com política para entregas/histórico. A FK user_id CASCADE remove a preferência quando a conta é excluída.

## Contrato HTTP

Novo `PUT /api/flair/challenges/{id}/preference` com `{"scenarioId":"<UUID permitido>"}`. GET de opções é contextual ao desafio.

Resposta/projeção a conferir: `"challengeId":"...", "scenario":{"id":"...","codigo":"gala","nome":"Gala"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Cenário permitido passa; cadastrado mas não associado falha; inativo/desafio privado/encerrado conforme regra; ausência de preferência; alteração em um usuário não muda o outro. Confirmar que nenhum Point, slot ou submissão é modificado. Testar restrição composta no MySQL.

- **E1 a produzir:** Central CBC com cenário permitido selecionado.
- **E2 a produzir:** Central e cena recarregadas preservando somente a preferência do usuário.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
