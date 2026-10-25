# Desenho da peça no molde do corpo — jaquetas, casacos e calças (2026-10-25)

Capturas do provador 3D (modo "Prévia: foto da peça no molde do corpo") mostraram, em peças de várias marcas (Gap, Nike,
G-Star, Rip Curl, Brooks Brothers, J.Crew): mangas de jaqueta infladas, chão e sapato da foto na barra da calça, linhas
brancas nas costuras e nos bolsos, costas sem o desenho da peça, manga sem desenho, uma foto de costas usada como frente,
e muitas peças "só com cor" ou com "a textura não carregou". Este documento registra a causa de cada sintoma, o que mudou
e como foi validado.

## Causa raiz comum: nenhuma foto do catálogo chegava a `photoSet READY`

O provador usa a foto **isolada** da peça (`texture-image?isolated=true` → `photoSet.wholeUrl`) e só cai na foto crua,
isolada no navegador, quando ela não existe. O `photoSet` só fica `READY` com preflight `PASS`, e o preflight exige
atestações (`complete`, `occluded`, `measurement_verified`, isolação verificada) que nenhum provedor automático dava: na
medição de 24/10, 100 % das 1 388 fotos ficaram em `REVIEW`. Resultado: quase todas as peças usavam o caminho de
emergência (foto com pessoa, chão e sapato) ou ficavam sem textura.

Correção (`scripts/catalog/fashn_open.py`, `process_local_sd.py --photo-set`, `process_photo_sets.py --export-rows /
--from-lot`): o engine `fashn-open` (parser humano da FASHN + BiRefNet + LaMa) atesta os campos com evidência medida —
peça não encosta na borda; corpo visível por dentro da peça ≤ 12 %; mão/bolsa/óculos/joia sobre o tecido ≤ 5 %; parser
separou pessoa e peça (ou não viu pessoa e o BiRefNet isolou o produto solto) — e descarta fios e cascalhos pelo mesmo
critério do preflight. Validado em CPU com fotos reais: jeans e top `READY`/`PASS`; vestido com a mão sobre o tecido
medido em 2,4 %. O `whole.png` sai em RGBA (RGB sobre branco + matte no alfa): o provador recebe o recorte pronto.

## Sintoma → causa → mudança

| Sintoma | Causa | Mudança | Teste |
| --- | --- | --- | --- |
| Mangas de jaqueta/casaco infladas | folga radial do braço = folga da camada de baixo + folga inteira da peça (jaqueta 2,1 cm, casaco 2,5 cm) + abertura + 2 mm, num braço de 4–5 cm de raio | `sleeveEase(sp)`: na manga a folga própria é 60 % da do tronco, nunca abaixo de 1 cm nem do mínimo de afastamento (55 %); a folga de camada continua inteira | `garments.test.ts` "a folga da manga é menor…": antebraço da jaqueta < 1,6 cm (antes ≥ 2 cm) |
| Manga sem desenho (camisa, jaqueta) | por desenho, a manga só recebia cor/trama ("projetada de frente viraria um retalho") | `photoSleeves(photo)`: em cada linha, o que fica entre a borda da peça e o tronco (`torsoWidthAt`) é manga; se a manga cai ao lado do tronco (≥ 30 % da altura, faixa contínua), `texturedGeometry` mapeia a manga 3D nela (borda externa → borda externa, ombro → punho). Manga aberta (flat lay) ou colada ao tronco segue no tecido | "a manga caída ao lado do tronco na foto vai para a manga 3D…" e "sem manga separada… segue no tecido" |
| Linhas brancas em costuras, bolsos e barra | o recorte vem opaco sobre branco; o pixel misto da borda (tecido + fundo) projetado no molde vira linha clara | `cutoutGarment`: alfa pela projeção da cor entre o fundo e o tecido vizinho (pixel meio denim, meio branco → alfa 0,5) e cor descontaminada; e o `whole.png` do lote já traz o alfa do BiRefNet | `garment-photo.test.ts` "o pixel misto da borda…" |
| Boca do tênis/meia na barra da calça (foto crua) | o filtro de pessoa cortava a calça só 5 % do tronco acima do tornozelo | corte a 12 % do tronco acima do tornozelo (`person-filter.ts`) | suíte `garment-photo-person.test.ts` (sem regressão) |
| Costas e laterais lisas, sem o desenho; costura lateral visível | sem ladrilho periódico (`fabricTile`), o painel do tecido caía num degradê liso | `fabricPatch`: janela opaca de menor variância entre as texturizadas (≥ 3 janelas parecidas, textura de alta frequência — logo e estampa grande não passam), espelhada 2×2 no painel das costas/laterais | "fabricPatch: trama real vira ladrilho espelhado; tecido liso e logo isolado não" |
| Foto de costas como frente (Rip Curl) | a seleção da foto de textura e da verificação não olhava o tipo da imagem | `viewRank`: FRONT/sem tipo antes de DETAIL/TOP, SIDE e BACK/SOLE em `texturePhoto` e `verifySelection` | `CatalogImagePipelineServiceTest.fotoDeFrenteVemAntesDaDeCostasNaTexturaIsolada` |
| "Prévia só com cor" / "a textura não carregou" / "as fotos não permitem o enquadramento" | sem `photoSet READY` não há foto isolada; sem imagem canônica aprovada o endpoint de textura falha; `ensurePreview` roda a verificação estrita do enquadramento | com `photoSet READY` importado do lote, a textura vem da foto isolada e `ensurePreview` não roda a verificação | `test_process_local_sd` (photo-set READY/REVIEW), `test_photo_set_lot` (exportar/importar) |

## Como aplicar no catálogo

```bash
python -m scripts.catalog.process_photo_sets --export-rows rows.json          # fotos sem photoSet atual
# lote em GPU (scripts/cloud/packshot_gpu_vm.py) ou local:
python scripts/catalog/process_local_sd.py --engine fashn-open --weights W --input rows.json --photo-set --dry-run --out-dir lote
python -m scripts.catalog.process_photo_sets --from-lot lote                  # ensaio
python -m scripts.catalog.process_photo_sets --from-lot lote --apply          # grava (upload conferido + CAS)
```

## Limites conhecidos

- A manga só recebe a foto quando aparece separada do tronco na silhueta; manga colada ao corpo continua no tecido.
- `fabricPatch` espelha um trecho da trama: estampas localizadas não se repetem (de propósito); tecido liso continua na cor medida.
- Oclusão por mão/bolsa acima de 5 % da área da peça e corpo por dentro acima de 12 % ficam em `REVIEW` (limiares medidos em três fotos; ajustar com o lote completo).
- Validação desta entrega por testes unitários (geometria, foto, filtro, Java) e pelo lote em CPU; captura visual do provador fica para o ambiente com WebGL.
