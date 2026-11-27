#!/usr/bin/env bash
# Desenhos animados dos Desafios de Montagem dinâmicos (docs/flair/cbc/MONTAGEM_DINAMICA.md), gerados só com ffmpeg a
# partir das referências já versionadas em public/flair/elencos (sem IA, sem GPU). Cada saída fica abaixo de 2 MB.
#   caleidoscopio.mp4 — a cena azul do Firefly (azul-tech.mp4, só o quadrante dela) espelhada em quatro
#                       (caleidoscópio), com a matiz girando e ida e volta (laço sem emenda);
#   logo-deriva.mp4   — logo-teal.webp à deriva: zoom e passeio em círculo, balanço leve e a matiz dando uma volta
#                       inteira em 8 s (laço sem emenda);
#   *.webp            — pôsteres (primeiro quadro) para "reduzir movimento" e para antes de o vídeo carregar.
# Uso: bash scripts/flair-modes/montagem-desenhos.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
E=public/flair/elencos
O=public/flair/montagem
mkdir -p "$O"

ffmpeg -v error -y -i "$E/azul-tech.mp4" -filter_complex \
  "[0]scale=240:240,split=2[a][b];[b]hflip[bh];[a][bh]hstack,split=2[top][t2];[t2]vflip[bot];\
[top][bot]vstack,hue=h='60*t':s=1.15,format=yuv420p,split=2[f][r0];[r0]reverse[r];[f][r]concat=n=2:v=1:a=0" \
  -an -c:v libx264 -preset slow -crf 30 -movflags +faststart -r 24 "$O/caleidoscopio.mp4"

ffmpeg -v error -y -loop 1 -framerate 24 -t 8 -i "$E/logo-teal.webp" -vf \
  "scale=960:960,zoompan=z='1.25+0.2*sin(2*PI*on/192)':x='iw/2-(iw/zoom/2)+60*sin(2*PI*on/192)':\
y='ih/2-(ih/zoom/2)+60*cos(2*PI*on/192)':d=1:s=480x480:fps=24,rotate='0.08*sin(2*PI*t/8)':fillcolor=white,\
hue=h='45*t',format=yuv420p" \
  -an -c:v libx264 -preset slow -crf 28 -movflags +faststart "$O/logo-deriva.mp4"

for f in caleidoscopio logo-deriva; do
  ffmpeg -v error -y -i "$O/$f.mp4" -frames:v 1 -vf scale=480:-1 -c:v libwebp -quality 70 "$O/$f.webp"
done
ls -la "$O"
