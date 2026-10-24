"""Build the shared FAI reference-asset map and colour palette (no product photographs)."""
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def build():
    manifest = json.loads((ROOT/'lib/assets/asset-manifest.json').read_text())['defaultPieceImages']
    thumbs = json.loads((ROOT/'lib/assets/piece-thumbs.json').read_text())
    def url(entry):
        original = entry['url']
        return thumbs.get(original, {}).get('640', original)
    for alias, target in {'top':'crop_top','boots':'ankle_boots'}.items():
        manifest['bySubcategory'].setdefault(alias, manifest['bySubcategory'][target])
    colors = dict(re.findall(r'\{"[^"\n]+", "([a-z_]+)", "(#[0-9A-Fa-f]{6})"\}',
        (ROOT/'fai-application/src/main/java/br/com/fashionai/application/taxonomy/Taxonomy.java').read_text()))
    return {'version':'FAI_DEFAULT_COLOURS_V1', 'colors':colors,
        'categories':{k:url(v) for k,v in manifest['byCategory'].items()},
        'subcategories':{k:{'category':v['category'],'url':url(v)} for k,v in manifest['bySubcategory'].items()},
        'generic':url(manifest['generic'])}

if __name__ == '__main__':
    (ROOT/'lib/assets/default-garments.json').write_text(json.dumps(build(),ensure_ascii=False,indent=2)+'\n')
