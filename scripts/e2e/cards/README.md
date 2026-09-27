# Cards de peça e detail modal — como reproduzir a verificação

Tudo roda localmente, sem banco: o pipeline de imagem é o do backend (Java) e a tela usa a API simulada.

```bash
OUT=/tmp/cards && mkdir -p $OUT
# 1) uploads simulados: 5 camisetas + 5 calças com fundo, escala, posição, rotação, tamanho e compressão diferentes
python3 scripts/e2e/cards/make_uploads.py $OUT/uploads
# 2) pipeline de verdade (flat lay local → estúdio → feed por template) sobre os uploads
mvn -q -DskipTests -pl fai-application -am install
mvn -q dependency:build-classpath -pl fai-application -Dmdep.outputFile=$OUT/cp.txt
CP=fai-application/target/classes:$(cat $OUT/cp.txt)
javac -d $OUT/harness -cp $CP scripts/e2e/cards/Harness.java
java -cp $OUT/harness:$CP br.com.fashionai.application.imaging.Harness $OUT/uploads $OUT/pipeline
for f in $OUT/uploads/*.jpg; do cp $f $OUT/pipeline/$(basename $f .jpg).upload.jpg; done
# 3) camiseta vermelha vestida: foto de teste do MediaPipe recolorida + estampa; remoção de pessoa no navegador
curl -so $OUT/pessoa.jpg https://storage.googleapis.com/mediapipe-assets/male_full_height_hands.jpg
python3 scripts/e2e/cards/red_person.py $OUT/pessoa.jpg $OUT/pessoa_camiseta_vermelha.jpg
node scripts/avatar3d/copy-mediapipe.mjs && DEV_GATE_ENABLED=false npx next dev -p 3100 &
node scripts/e2e/cards/strip-person.mjs http://localhost:3100 $OUT/pessoa_camiseta_vermelha.jpg $OUT/sem-pessoa
# 4) capturas + conferências (dono/visitante × desktop/celular, estados do 3D, Editar imagem)
BASE=http://localhost:3100 MEDIA=$OUT/pipeline node scripts/e2e/verify-cards.mjs $OUT/capturas
```

`verify-cards.mjs … antes` roda o mesmo roteiro contra o código anterior (um `git worktree` do commit de base em
outra porta), para as capturas "antes".
