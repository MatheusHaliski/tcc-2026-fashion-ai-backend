ALTER TABLE wardrobe_items
  ADD COLUMN negotiation_partner_id CHAR(36),
  ADD CONSTRAINT fk_wardrobe_negotiation_partner FOREIGN KEY (negotiation_partner_id)
    REFERENCES users(id) ON DELETE SET NULL;

UPDATE wardrobe_items w
JOIN marketplace_negotiations n ON n.id = w.negotiation_id AND n.piece_id = w.id
SET w.negotiation_partner_id = n.counterparty_user_id
WHERE n.status = 'ACCEPTED' AND n.owner_user_id = w.user_id;
