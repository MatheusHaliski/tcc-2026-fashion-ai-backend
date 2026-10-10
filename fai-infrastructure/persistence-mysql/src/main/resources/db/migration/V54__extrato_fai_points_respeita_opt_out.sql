-- Corrige o backfill de V37 (extrato dos FAI Points na central): ele gravou delivered = TRUE para todo mundo, mas
-- NotificationService.enabled() não entrega FAI_POINTS a quem desligou as notificações (notification_push_master =
-- FALSE) ou só esse tipo (notification_prefs_json.FAI_POINTS = false) — e inbox() só lista as entregues. Sem isto, a
-- atualização expunha até 90 dias de extrato a quem optou por não receber. V37 já pode ter rodado (checksum), então a
-- correção vem aqui e não lá.
-- Só as linhas do backfill: já lidas e nunca tocadas pela aplicação (version = 0). As criadas pelo app nascem não
-- lidas e, ao serem lidas, passam pela entidade (@Version sobe), então nenhuma notificação viva é escondida.
UPDATE notifications n
  JOIN user_preferences p ON p.user_id = n.recipient_user_id
   SET n.delivered = FALSE
 WHERE n.type = 'FAI_POINTS'
   AND n.is_read = TRUE
   AND n.version = 0
   AND n.delivered = TRUE
   AND (p.notification_push_master = FALSE
        OR JSON_EXTRACT(p.notification_prefs_json, '$.FAI_POINTS') = CAST('false' AS JSON));
