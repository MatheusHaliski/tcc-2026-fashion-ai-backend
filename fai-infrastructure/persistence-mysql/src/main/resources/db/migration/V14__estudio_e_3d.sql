-- RF4 · Estúdio: foto de produto gerada depois do Flat Lay (fundo de estúdio, reiluminação e sombra). O recorte sem
-- fundo continua em image_url (provador, cards, quarto); a foto de estúdio é a vitrine da peça.
ALTER TABLE wardrobe_items
  ADD COLUMN studio_image_url VARCHAR(1024) NULL,
  ADD COLUMN studio_backdrop VARCHAR(30) NULL;

-- RF16: o worker de 3D busca jobs por tipo + estado (fila) e o estado da peça por job mais recente
CREATE INDEX idx_pipeline_jobs_type_status ON pipeline_jobs(type, status, created_at);
CREATE INDEX idx_pipeline_jobs_type_input ON pipeline_jobs(type, input_resource_id, created_at);
