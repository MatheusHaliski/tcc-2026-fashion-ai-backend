-- RF4 · Várias peças numa foto: a pessoa pode trocar a foto da peça por uma cópia recriada por IA. A peça guarda essa
-- origem para o app mostrar o selo "gerada por IA" em todo lugar (a própria imagem também leva o selo gravado).
ALTER TABLE wardrobe_items ADD COLUMN is_ai_generated_image BOOLEAN NOT NULL DEFAULT FALSE;
