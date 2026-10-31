-- RF23 — customização da interface salva por usuário: ordem dos grupos do menu lateral e dos itens dentro de cada grupo
-- ({"groups": ["nav.group.wardrobe", ...], "items": {"nav.group.wardrobe": ["/closet", ...]}}). NULL = ordem padrão.
ALTER TABLE user_preferences ADD COLUMN nav_order_json JSON NULL;
