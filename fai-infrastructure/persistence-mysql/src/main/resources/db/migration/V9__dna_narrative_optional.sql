-- RF13 (bloco 12): o Esquema de DNA segue o mesmo construtor do RF5. Na etapa 4 o usuário escolhe uma anatomia da
-- Seção A (Ampliado, Em grade, Na horizontal, Na lateral) OU uma narrativa da Seção B (só com elemento-alvo
-- DNA_COMPLETO). Sem narrativa escolhida, o card usa apenas a anatomia base, então a coluna passa a aceitar NULL.
ALTER TABLE dna_schemes MODIFY COLUMN narrative_type VARCHAR(40) NULL DEFAULT NULL;
