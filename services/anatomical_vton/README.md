# Anatomical VTON — worker e runtime GPU

Este módulo implementa validação de evidências, warping TPS com pontos rígidos e
elásticos, restrição de linha frontal, composição de máscaras e processamento
incremental do catálogo. O espaço da imagem é **PROJECTED_2D**. Uma projeção não
comprova ajuste físico, precisão milimétrica ou geometria escondida pela fotografia.

## Fluxo

`backend autorizado → fila de anotação → modelo de roupa → validação geométrica →
evidência corporal → warping → oclusão → PNG destinado ao dono da solicitação`

- `auto_catalog.py`: atributos tipados, máscaras, curvas e rejeição de evidência insuficiente.
- `store.py` / `monitor.py`: cache por conteúdo e versão, leases, retries limitados e ingestão incremental.
- `api.py`: API privada, consentimento/propriedade sob responsabilidade do backend chamador.
- `bottomwear.py`: restrições 360° em metros para malhas e perímetros efetivamente fornecidos; não reconstrói volumes invisíveis de uma foto.
- `health.py`: métricas de QA; sem referência alinhada/máscara/colisão, o resultado é `UNVERIFIED`.
- `vertex_runtime`: container compartilhado para os dois contratos de inferência, uma requisição por vez.

## Execução e verificação local

```bash
pip install -r services/anatomical_vton/requirements.txt
python3 -m unittest discover -s services/anatomical_vton/tests -v
python3 -m services.anatomical_vton.monitor --once --batch 1
```

Sem provedor configurado, o monitor retorna `MODEL_NOT_CONFIGURED` e preserva
itens pendentes. SQLite e disco local servem para desenvolvimento; múltiplos
workers exigem MySQL 8 e armazenamento de artefatos apropriado. A capacidade para
milhões de registros não foi aferida por benchmark nesta alteração.

O produtor `backend_feed.py` usa `/api/admin/vton/catalog-feed`; essa rota e a
ponte `/api/admin/vton/annotate` precisam existir no backend publicado. Os clientes
nunca recebem o JWT administrativo. Downloads têm origens permitidas e não
encaminham o JWT do backend a hosts de object storage.

## Google Cloud

Veja [configuração e estado do projeto](deploy/google-cloud/README.md) e
[contrato dos artefatos do modelo](vertex_runtime/MODEL_BUNDLE.md).

Os testes usam imagens geométricas e doubles explicitamente identificados.
Eles validam restrições e contratos; não comprovam detecção automática em fotos
reais, geração FLAME/SMPL-X, execução CUDA ou desempenho de um modelo treinado.

## Diagnóstico corporal com modelo real

A rota privada `/v1/body/pose` usa MediaPipe quando `VTON_POSE_MODEL_PATH` está
configurado e as dependências de `requirements-pose.txt` estão instaladas.
Ela retorna `POSE_ONLY`, sem preencher automaticamente o contrato anatômico
completo. A ponte Java publica `/api/try-on/body-pose` com propriedade da foto e
consentimento por solicitação; as rotas do catálogo são administrativas.

[Evidência real e configuração do backend](../../docs/provador/vton-backend-2026-10-15/README.md).
[Modelos pesquisados e adaptações ainda necessárias](MODEL_CANDIDATES.md).
