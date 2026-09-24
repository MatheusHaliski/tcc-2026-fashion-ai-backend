-- Correção: host_rf tinha 10 caracteres e capacidades que atendem vários RFs ("RF4/RF5/RF13", "RF4/RF14/RF26")
-- não conseguiam gravar o registro da inferência (RNF5). Amplia a coluna.
ALTER TABLE ai_inference_log MODIFY COLUMN host_rf VARCHAR(40) NULL;
