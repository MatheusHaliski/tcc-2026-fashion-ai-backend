"""De onde veio o .glb importado como modelo de vitrine (catalog_product_models_3d.generator e metrics_json.import).

Cada gerador conhecido tem a família gravada em ``metrics_json.import.generator`` e a nota de revisão. Gerador fora da
lista é recusado na linha de comando: o nome vai para o banco e precisa ser estável para a auditoria e a comparação.
"""
from __future__ import annotations

from dataclasses import dataclass

SCOPE = "sem esqueleto: vitrine do produto (manequim, quarto, visualizador), não veste o avatar. " \
        "Escala relativa, sem medida da marca."
GENERATORS = {
    "meshy-6-lite": ("meshy", "Meshy (lote do Codex)"),
    "hunyuan3d-2.1": ("hunyuan3d", "Hunyuan3D 2.1 (flat lay aprovado, frente)"),
    "hunyuan3d-2mv+2.1": ("hunyuan3d", "Hunyuan3D-2mv (forma: frente e costas do flat lay aprovado) + 2.1 (textura PBR)"),
    "trellis.2-4b": ("trellis", "TRELLIS.2 4B (flat lay aprovado, frente)"),
}
ORIGINS = ("codex", "runpod")


@dataclass(frozen=True)
class GlbSource:
    generator: str = "meshy-6-lite"
    origin: str = "codex"

    def __post_init__(self):
        if self.generator not in GENERATORS:
            raise ValueError(f"gerador desconhecido: {self.generator} (conhecidos: {', '.join(GENERATORS)})")
        if self.origin not in ORIGINS:
            raise ValueError(f"origem desconhecida: {self.origin} (conhecidas: {', '.join(ORIGINS)})")

    @property
    def family(self) -> str:
        return GENERATORS[self.generator][0]

    @property
    def notes(self) -> str:
        return f"{GENERATORS[self.generator][1]} {SCOPE}"


MESHY_CODEX = GlbSource()
