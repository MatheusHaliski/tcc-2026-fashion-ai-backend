-- Os níveis de FAI XP passam a ser três: Básico (ESTREIA) → Studio → Loft.
-- O que era Closet abre no Studio; Atelier, Penthouse e Maison viram Loft. O nível do quarto acompanha os pontos.
UPDATE room_layouts SET level = 'LOFT' WHERE level IN ('CLOSET', 'ATELIER', 'PENTHOUSE', 'MAISON');
UPDATE room_catalog SET required_level = 'STUDIO' WHERE required_level = 'CLOSET';
UPDATE room_catalog SET required_level = 'LOFT' WHERE required_level IN ('ATELIER', 'PENTHOUSE', 'MAISON');
UPDATE physical_store_listings SET required_level = 'STUDIO' WHERE required_level = 'CLOSET';
UPDATE physical_store_listings SET required_level = 'LOFT' WHERE required_level IN ('ATELIER', 'PENTHOUSE', 'MAISON');
