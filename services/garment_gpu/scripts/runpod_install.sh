#!/usr/bin/env bash
# Instalação do runpod_start.sh (carregado com `source`; usa WS, LOGS, RUN, VENV, SVC e as funções say/die dele):
# redis-server no disco do contêiner, RustFS 1.0.4 e a venv no network volume. Cada passo é refeito só quando falta.
# Não rode sozinho: bash runpod_start.sh [start|restart] chama estas funções.

ensure_redis() {
  command -v redis-server >/dev/null && return 0
  say "instalando redis-server (disco do contêiner; refeito a cada pod novo, ~20 s)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null && apt-get install -y -qq redis-server >/dev/null
}

ensure_rustfs() {
  [ -x "$RUSTFS_BIN" ] && return 0
  command -v unzip >/dev/null || { apt-get update -qq >/dev/null && apt-get install -y -qq unzip >/dev/null; }
  say "baixando RustFS $RUSTFS_VERSION para o volume"
  local tmp
  tmp=$(mktemp -d)
  curl -fsSL --retry 3 -o "$tmp/rustfs.zip" "$RUSTFS_URL"
  echo "$RUSTFS_SHA256  $tmp/rustfs.zip" | sha256sum -c --quiet - || die "SHA-256 do RustFS não confere"
  unzip -q -o "$tmp/rustfs.zip" -d "$tmp"
  install -m 755 "$tmp/rustfs" "$RUSTFS_BIN"
  rm -rf "$tmp"
}

# Índice do PyTorch que o driver aguenta (nvidia-smi mostra a CUDA máxima): 13.x → cu130, 12.8+ → cu128, resto → cu126.
torch_channel() {
  local cuda
  cuda=$(nvidia-smi 2>/dev/null | grep -o 'CUDA Version: [0-9.]*' | awk '{print $3}')
  [ -n "$cuda" ] || die "nvidia-smi não mostra a GPU: o pod precisa de uma GPU NVIDIA"
  case "$cuda" in
    1[3-9].*) echo cu130 ;;
    12.[89]*) echo cu128 ;;
    *) echo cu126 ;;
  esac
}

ensure_venv() {
  # Com torch na imagem (Dockerfile.worker, imagens PyTorch antigas do RunPod), a venv o herda por
  # --system-site-packages. A imagem runpod/pytorch 1.4.0 não o tem no python3: aí torch e torchvision vão juntos
  # para a venv, do índice certo para o driver (separados, o pip trouxe torch sem torchvision em 03/11/2026).
  local want system_torch=1 channel=system
  python3 -c 'import torch, torchvision' 2>/dev/null || { system_torch=0; channel=$(torch_channel); }
  want=$( { echo "venv-rev-2 $channel"; python3 -V
            python3 -c 'import torch; print(torch.__version__)' 2>/dev/null || true
            cat "$SVC"/requirements-api.txt "$SVC"/requirements-segment.txt "$SVC"/requirements-reconstruct.txt; } \
          | sha256sum | cut -c1-16)
  if [ -x "$VENV/bin/python" ] && [ "$(cat "$VENV/.fai-installed" 2>/dev/null)" = "$want" ]; then
    return 0
  fi
  say "instalando dependências na venv do volume (torch: $channel; log em $LOGS/install.log)"
  rm -f "$VENV/.fai-installed"   # só volta a existir no fim: instalação interrompida é refeita na próxima subida
  python3 -m venv --system-site-packages "$VENV" >>"$LOGS/install.log" 2>&1 \
    || die "python3 -m venv falhou (veja $LOGS/install.log)"
  "$VENV/bin/pip" install -q --upgrade pip >>"$LOGS/install.log" 2>&1
  if [ "$system_torch" = 0 ]; then
    "$VENV/bin/pip" install -q torch torchvision --index-url "https://download.pytorch.org/whl/$channel" \
      >>"$LOGS/install.log" 2>&1 || die "instalação do torch ($channel) falhou (veja $LOGS/install.log)"
  fi
  "$VENV/bin/python" -m pip freeze 2>/dev/null | grep -iE '^(torch|torchvision)==' > "$RUN/constraints.txt" || true
  "$VENV/bin/pip" install -q -c "$RUN/constraints.txt" -r "$SVC/requirements-segment.txt" \
    -r "$SVC/requirements-reconstruct.txt" hf_transfer >>"$LOGS/install.log" 2>&1 \
    || die "pip install falhou (veja $LOGS/install.log)"
  "$VENV/bin/python" -c "import torch, torchvision, transformers, diffusers, peft, hf_transfer
assert torch.cuda.is_available(), 'torch não enxerga a GPU (driver x versão do torch)'
print('torch', torch.__version__, 'cuda', torch.version.cuda, torch.cuda.get_device_name(0))" 2>&1 \
    | tee -a "$LOGS/install.log" || die "a venv não passou na verificação (veja $LOGS/install.log)"
  echo "$want" > "$VENV/.fai-installed"
}
