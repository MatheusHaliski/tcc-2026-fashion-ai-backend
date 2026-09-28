-- Correções de concorrência e privacidade (auditoria de segurança):
-- 1) Loja do quarto (RF35): room_catalog ganha @Version. Compras simultâneas do mesmo item de edição limitada não
--    passam as duas com o mesmo sold_count (a compra também trava a linha do item e a do comprador).
ALTER TABLE room_catalog ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- 2) Avatar 3D (RF40): a textura do rosto não passa pelo filtro de upload; agora só aparece para outras pessoas depois
--    de aprovada na moderação. Avatares já salvos começam pendentes (a moderação roda quando o dono o torna público
--    de novo ou salva outra textura).
ALTER TABLE user_avatars_3d ADD COLUMN texture_moderation VARCHAR(30) NOT NULL DEFAULT 'PENDING';

-- 3) Desafios (RF36): um voto por pessoa em cada batalha. A regra era conferida só na aplicação (dois cliques
--    simultâneos em looks diferentes passavam); agora o banco garante. Votos duplicados antigos: fica o primeiro.
DELETE v1 FROM challenge_votes v1
  JOIN challenge_votes v2
    ON v1.instance_id = v2.instance_id AND v1.voter_user_id = v2.voter_user_id
   AND (v1.created_at > v2.created_at OR (v1.created_at = v2.created_at AND v1.id > v2.id));
ALTER TABLE challenge_votes ADD CONSTRAINT uq_ch_vote_voter UNIQUE (instance_id, voter_user_id);
