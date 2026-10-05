-- Estado "Para doar" da peça (RF31 + RF53, subaba do Guarda-roupa): como "à venda", é um estado público da peça e
-- exclusivo com ele (marcar uma desmarca a outra em WardrobeService.toggles). Peças existentes começam fora.
ALTER TABLE wardrobe_items
  ADD COLUMN for_donation BOOLEAN NOT NULL DEFAULT FALSE AFTER for_sale;
