#!/usr/bin/env bash
# Gera o par de chaves RSA do JWT próprio (RS256) da API: chave privada PKCS#8 e chave pública X.509 (SubjectPublicKeyInfo),
# ambas em PEM — o formato que JWT_PRIVATE_KEY_PEM e JWT_PUBLIC_KEY_PEM esperam (JwtConfig).
#
# Uso: scripts/keys/generate_jwt_keys.sh [diretório_de_saída] [bits]
#   diretório padrão: ./keys/jwt-<data UTC> (ignorado pelo git); bits padrão: 3072 (mínimo aceito: 2048)
#
# Segurança: umask 077 (só o dono lê), o diretório não pode existir (nunca sobrescreve um par em uso) e o script
# imprime só os caminhos — nunca o conteúdo das chaves. Apague a cópia local depois de gravar no provedor.
set -euo pipefail
umask 077

if ! command -v openssl >/dev/null 2>&1; then
  echo "erro: openssl não encontrado no PATH" >&2
  exit 1
fi

OUT="${1:-./keys/jwt-$(date -u +%Y%m%dT%H%M%SZ)}"
BITS="${2:-3072}"
case "$BITS" in
  '' | *[!0-9]*) echo "erro: número de bits inválido: $BITS" >&2; exit 2 ;;
esac
if [ "$BITS" -lt 2048 ]; then
  echo "erro: use pelo menos 2048 bits (recomendado: 3072)" >&2
  exit 2
fi
if [ -e "$OUT" ]; then
  echo "erro: $OUT já existe; escolha outro diretório (o script nunca sobrescreve chaves)" >&2
  exit 2
fi

mkdir -p "$OUT"
chmod 700 "$OUT"
PRIV="$OUT/jwt-private.pem"
PUB="$OUT/jwt-public.pem"

# genpkey já grava em PKCS#8 ("BEGIN PRIVATE KEY"); a pública sai em X.509 ("BEGIN PUBLIC KEY")
openssl genpkey -algorithm RSA -pkeyopt "rsa_keygen_bits:$BITS" -out "$PRIV" 2>/dev/null
openssl pkey -in "$PRIV" -pubout -out "$PUB" 2>/dev/null
chmod 600 "$PRIV"
chmod 644 "$PUB"

# confere o par sem imprimir nada dele: a pública derivada da privada tem de ser igual à gravada
if ! openssl pkey -in "$PRIV" -pubout 2>/dev/null | cmp -s - "$PUB"; then
  echo "erro: o par gerado não confere; apague $OUT e rode de novo" >&2
  exit 1
fi

cat <<INFO
Par RSA-$BITS gerado:
  privada: $PRIV   (PKCS#8, permissão 600)
  pública: $PUB    (X.509)

Próximos passos (o conteúdo das chaves nunca precisa aparecer no terminal):
  1. Grave cada arquivo como variável do serviço da API, com as quebras de linha:
       JWT_PRIVATE_KEY_PEM  <- conteúdo de $PRIV
       JWT_PUBLIC_KEY_PEM   <- conteúdo de $PUB
     Railway (CLI logada no projeto):
       railway variables --service api --skip-deploys --set "JWT_PRIVATE_KEY_PEM=\$(cat '$PRIV')"
       railway variables --service api --set "JWT_PUBLIC_KEY_PEM=\$(cat '$PUB')"
     Depois, sele JWT_PRIVATE_KEY_PEM (Variables -> menu da variável -> Seal): o valor deixa de ser exibido.
  2. Mantenha JWT_REQUIRE_KEYS=true (já é o padrão da imagem Dockerfile.backend).
  3. Trocar o par invalida os tokens de acesso emitidos com o anterior (os usuários entram de novo).
  4. Apague a cópia local quando terminar:  rm -rf '$OUT'
INFO
