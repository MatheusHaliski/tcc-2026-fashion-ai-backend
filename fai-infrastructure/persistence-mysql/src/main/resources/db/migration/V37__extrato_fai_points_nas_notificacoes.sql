-- Extrato dos FAI Points na central de notificações (RF30/RF39): cada lançamento do ledger passa a gerar uma
-- notificação FAI_POINTS (categoria POINTS) em FaiPointsService. Aqui entram os lançamentos que já existiam, dentro
-- da retenção das notificações (90 dias), já lidos: o histórico aparece na central sem acender o sino.
-- Título e corpo usam o marcador adiado de Msg.k ("§i18n:chave<US>arg§", US = CHAR(31)), traduzido para o idioma de
-- quem lê. resource_id guarda o id do lançamento: rodar de novo não duplica.
INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, category, resource_type, resource_id, title, body,
                           payload_json, is_read, read_at, delivered, version, created_at, updated_at)
SELECT UUID(), l.user_id, NULL, 'FAI_POINTS', 'POINTS', 'FAI_POINTS', l.id,
       CONCAT('§i18n:faiPoints.extrato.', IF(l.delta >= 0, 'credito', 'debito'), CHAR(31), ABS(l.delta), '§'),
       CASE
         WHEN l.action_code = 'SHOP_PURCHASE'
           THEN CONCAT('§i18n:faiPoints.extrato.SHOP_PURCHASE', CHAR(31), COALESCE(c.name, l.ref_id, ''), '§')
         WHEN l.action_code IN ('ACHIEVEMENT', 'CHALLENGE_COMPLETED', 'COMMENT_RECEIVED', 'FLAIR_QUEST', 'FORGOTTEN_RESCUED',
                                'GAME_PLAYED', 'GAME_WON', 'LIKE_RECEIVED', 'PIECE_3D', 'PIECE_CATALOGED', 'PIECE_COMPLETED',
                                'REMIX_RECEIVED', 'ROOM_ORGANIZED', 'SCHEME_CREATED', 'VISTA_ME_DAILY_LOOK')
           THEN CONCAT('§i18n:faiPoints.extrato.', l.action_code, '§')
         ELSE CONCAT('§i18n:faiPoints.extrato.outro', CHAR(31), LOWER(REPLACE(l.action_code, '_', ' ')), '§')
       END,
       JSON_OBJECT('delta', l.delta, 'action', l.action_code, 'href', '/points'),
       TRUE, NOW(6), TRUE, 0, l.created_at, NOW(6)
  FROM fai_points_ledger l
  JOIN users u ON u.id = l.user_id
  LEFT JOIN room_catalog c ON l.action_code = 'SHOP_PURCHASE' AND c.sku = l.ref_id
 WHERE l.created_at >= NOW(6) - INTERVAL 90 DAY
   AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.type = 'FAI_POINTS' AND n.resource_id = l.id);
