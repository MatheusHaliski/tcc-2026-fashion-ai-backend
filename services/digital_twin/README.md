# Núcleo numérico de digital twin

Módulos experimentais para fitting de rosto/corpo, geometria de fios, limpeza de
colisões e ancoragem de acessórios/calçados. Não foram incluídos pesos FLAME,
SMPL-X, detector facial ou assets humanos. Os adaptadores exigem modelos reais e
licenças apropriadas; sem eles não há geração de avatar fotorrealista.

`hair_manager.py` gera fios individuais e oferece PBD em PyTorch. A taxonomia
1A–4C não infere etnia ou gênero. Tranças, locs e penteados complexos exigem guias
específicos; curvas procedurais genéricas não são apresentadas como esses estilos.

As funções NumPy de limpeza, calçados e restrições inferiores possuem testes:

```bash
python3 -m unittest discover -s services/digital_twin/tests -v
```

Esses testes não executam os módulos PyTorch/FLAME/SMPL-X. Não houve teste CUDA,
validação com fotografias reais ou comprovação de fidelidade milimétrica.
