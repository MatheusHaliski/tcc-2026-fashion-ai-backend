# Atualização do acervo durante importações

O criador de peças e o provador consultam novamente marcas, contagens e a seleção atual a cada 30 segundos enquanto a aba está visível, e ao retornar à aba. Os resultados existentes permanecem durante a consulta; falhas temporárias mantêm a última resposta e são tentadas novamente. Fotos reenquadradas também são recarregadas na resposta do catálogo. Não há reinício dos filtros, da página ou das variantes escolhidas.

A coleta `collect_official.py` gera arquivos: eles precisam ser importados antes de aparecerem no banco. O importador grava os produtos como `VALIDATED`; o serviço aceita `VALIDATED`, `PERSISTABLE` e `REFERENCE_ONLY`. Registros ainda não confirmados pela transação ou fora desses estados não são publicados pela atualização da interface. O índice de busca textual precisa acompanhar os dados importados; `rebuild_search_index.py` recompõe esse texto. Navegação por categoria/marca e busca textual mantêm seus filtros.

O reenquadramento atualiza fotos de produtos existentes. `--limit 100` restringe a execução a 100 registros; omita `--limit` para o acervo completo. As alterações da interface precisam ser implantadas para que a atualização automática funcione no site publicado.
