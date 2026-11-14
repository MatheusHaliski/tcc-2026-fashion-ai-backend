#!/usr/bin/env bash
# Roda NO POD da RunPod (terminal web ou SSH), uma vez por volume: instala o Hunyuan3D 2.1 oficial no commit fixado.
# Requisitos do README oficial: Python 3.10, PyTorch 2.5.1 + cu124; 29 GB de VRAM para forma + textura (10 + 21).
# Licença: Tencent Hunyuan 3D 2.1 Community License (não vale na UE, Reino Unido e Coreia do Sul; > 1 mi MAU pede
# licença). Os pesos (tencent/Hunyuan3D-2.1, facebook/dinov2-giant) baixam do Hugging Face no primeiro uso.
#
#   bash /workspace/runner/runpod_setup_hunyuan.sh
set -euo pipefail

COMMIT=82920d643c0dc2f7bfd7255f45f62d386edfe60c
ROOT=${HUNYUAN_ROOT:-/workspace/Hunyuan3D-2.1}
export HF_HOME=${HF_HOME:-/workspace/hf-cache}   # pesos no volume: sobrevivem ao pod parado

if [ ! -d "$ROOT/.git" ]; then
  git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1.git "$ROOT"
fi
cd "$ROOT"
git fetch --quiet origin "$COMMIT" || true
git checkout --quiet "$COMMIT"

python -c 'import sys; assert sys.version_info[:2] >= (3, 10), sys.version'
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

pip install --quiet torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124
pip install --quiet -r requirements.txt
(cd hy3dpaint/custom_rasterizer && pip install --quiet --no-build-isolation -e .)
(cd hy3dpaint/DifferentiableRenderer && bash compile_mesh_painter.sh)
mkdir -p hy3dpaint/ckpt
[ -s hy3dpaint/ckpt/RealESRGAN_x4plus.pth ] || wget -q \
  https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -P hy3dpaint/ckpt

python - <<'EOF'
import torch
print("torch", torch.__version__, "cuda", torch.version.cuda, "gpu", torch.cuda.get_device_name(0),
      f"{torch.cuda.get_device_properties(0).total_memory / 1e9:.0f} GB")
EOF
echo "Hunyuan3D 2.1 pronto em $ROOT (commit $COMMIT)"
