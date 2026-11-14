#!/usr/bin/env bash
# Roda NO POD da RunPod (terminal web ou SSH), uma vez por volume: instala os dois repositórios oficiais, fixados.
#  - Hunyuan3D-2 (pacote hy3dgen): forma com o Hunyuan3D-2mv, frente + costas. 6 GB de VRAM (README).
#  - Hunyuan3D-2.1 (hy3dpaint): textura PBR. 21 GB de VRAM (README). Python 3.10, PyTorch 2.5.1 + cu124.
# Cada etapa roda num processo, então o pico é o da textura (~21 GB): GPU de 24 GB serve.
# Licenças: Tencent Hunyuan 3D 2.0 e 2.1 Community License (não valem na UE, Reino Unido e Coreia do Sul; acima de
# 1 milhão de MAU pede licença). Os pesos (tencent/Hunyuan3D-2mv, tencent/Hunyuan3D-2.1, facebook/dinov2-giant) baixam
# do Hugging Face no primeiro uso, para o volume.
#
#   bash /workspace/runner/runpod_setup_hunyuan.sh
set -euo pipefail

MV_COMMIT=f8db63096c8282cb27354314d896feba5ba6ff8a
PAINT_COMMIT=82920d643c0dc2f7bfd7255f45f62d386edfe60c
export HF_HOME=${HF_HOME:-/workspace/hf-cache}   # pesos no volume: sobrevivem ao pod parado

checkout() {   # repositório, pasta, commit
  [ -d "$2/.git" ] || git clone "https://github.com/Tencent-Hunyuan/$1.git" "$2"
  git -C "$2" fetch --quiet origin "$3" || true
  git -C "$2" checkout --quiet "$3"
}
checkout Hunyuan3D-2.1 /workspace/Hunyuan3D-2.1 "$PAINT_COMMIT"
checkout Hunyuan3D-2 /workspace/Hunyuan3D-2 "$MV_COMMIT"

python -c 'import sys; assert sys.version_info[:2] >= (3, 10), sys.version'
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

pip install --quiet torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124
cd /workspace/Hunyuan3D-2.1
pip install --quiet -r requirements.txt
(cd hy3dpaint/custom_rasterizer && pip install --quiet --no-build-isolation -e .)
(cd hy3dpaint/DifferentiableRenderer && bash compile_mesh_painter.sh)
mkdir -p hy3dpaint/ckpt
[ -s hy3dpaint/ckpt/RealESRGAN_x4plus.pth ] || wget -q \
  https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -P hy3dpaint/ckpt

# só a parte de forma do Hunyuan3D-2 (sem as extensões de textura dele); --no-deps preserva as versões do 2.1
pip install --quiet --no-deps -e /workspace/Hunyuan3D-2

python - <<'EOF'
import torch
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline  # noqa: F401 - falha aqui = dependência faltando
print("torch", torch.__version__, "cuda", torch.version.cuda, "gpu", torch.cuda.get_device_name(0),
      f"{torch.cuda.get_device_properties(0).total_memory / 1e9:.0f} GB")
EOF
echo "Hunyuan3D-2mv ($MV_COMMIT) + 2.1 ($PAINT_COMMIT) prontos em /workspace"
