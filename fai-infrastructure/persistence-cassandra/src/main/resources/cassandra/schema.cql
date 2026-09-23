-- Fashion AI — projeções NoSQL (Cassandra). Criadas automaticamente pelo adaptador; aqui para documentação.
CREATE KEYSPACE IF NOT EXISTS fashionai_feed WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

-- Timeline materializada por seguidor: uma partição por usuário, ordenada da publicação mais recente para a mais antiga.
-- TTL de 90 dias: entradas antigas expiram sozinhas (sem varredura de exclusão).
CREATE TABLE IF NOT EXISTS fashionai_feed.timeline_by_user (
  user_id uuid,
  published_at timestamp,
  scheme_id uuid,
  author_id uuid,
  PRIMARY KEY (user_id, published_at, scheme_id)
) WITH CLUSTERING ORDER BY (published_at DESC, scheme_id ASC) AND default_time_to_live = 7776000;

CREATE TABLE IF NOT EXISTS fashionai_feed.notifications_by_user (
  user_id uuid,
  created_at timestamp,
  notification_id uuid,
  PRIMARY KEY (user_id, created_at, notification_id)
) WITH CLUSTERING ORDER BY (created_at DESC, notification_id ASC) AND default_time_to_live = 2592000;
