# Peças base por subcategoria (GLB)

O editor 3D da peça e o Atelier partem sempre de uma **peça base da subcategoria**. Enquanto não existir um GLB publicado
aqui, a base é gerada proceduralmente (`lib/atelier3d/base-pieces*.ts`). Para substituir a base procedural de uma
subcategoria por uma modelagem real, publique o arquivo nesta pasta:

```
public/garment-templates/<subcategoria>.glb      # ex.: hoodie.glb, coat.glb, boots.glb, handbag.glb
```

Os códigos de subcategoria são os da taxonomia (`fai-application/src/main/resources/taxonomy/taxonomy.json`) e a lista
aceita pelo editor está em `BASE_PIECE_CATEGORIES` (`lib/atelier3d/base-pieces.ts`) e `BasePieceCatalog.java`.

## Requisitos do GLB

- glTF 2.0 binário (`.glb`), até 8 MB, sem imagens embutidas obrigatórias, sem skins/rig e sem animações
  (o editor bloqueia edição de vértices em modelos rigados/animados).
- Unidades em **metros**, eixo **Y para cima**, chão em **y = 0**, peça centrada em x = z = 0, orientada com a frente
  para +Z.
- Uma malha por parte, com **nome legível** (`Body`, `Sleeve left`, `Hood`, `Sole`, `Strap`…): o inspetor edita cor,
  material e transformação por parte.
- Materiais `MeshStandardMaterial` (PBR metallic-roughness). A cor base é a cor da peça; o editor recolore por parte.
- `extras` do nó raiz: `{ "origin": "FAI_BASE_PIECE", "sizeCertified": false, "rigged": false }`. Peças base são volumes
  de exploração de forma: não são moldes de costura, tamanhos certificados nem roupas aprovadas para o provador.

## Versão

`BASE_PIECE_VERSION` (`base-pieces.ts`) e `BasePieceCatalog.VERSION` (Java) identificam a geração da base na chave
gravada com a personalização (`template:<subcategoria>@<versão>`). Ao trocar a geometria de forma incompatível com
personalizações já salvas, incremente as duas versões juntas.
