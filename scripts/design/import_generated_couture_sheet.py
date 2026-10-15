#!/usr/bin/env python3
"""Split an original generated 3x2 couture-tech contact sheet into six common AURA presets.
Usage: python3 scripts/design/import_generated_hype_sheet.py --image /path/sheet.png
Only use artwork owned or generated for this project. Updates the local modal catalog.
"""
import argparse,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
MODELS=[('couture-fiber-satin','Cetim fotônico',['#65d9ef','#86b7d7']),('couture-titanium','Titânio violeta',['#be94ee','#b9ccd8']),('couture-holo-organza','Organza holográfica',['#88def0','#bba9e3']),('couture-gold-pleats','Plissado constelar',['#e8c791','#a9987f']),('couture-mint-glass','Vidro mint',['#92d8c4','#c1d0ca']),('couture-holo-mesh','Malha holográfica',['#c4a0e6','#e7b0bd'])]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--image',type=Path,required=True);a=p.parse_args()
 output=ROOT/'public/aura/fashion-curated';output.mkdir(parents=True,exist_ok=True)
 catalog=json.loads((output/'catalog.json').read_text());by_id={r['id']:r for r in catalog['presets']}
 with Image.open(a.image) as im:
  w,h=im.size
  for n,(id,name,palette) in enumerate(MODELS):
   im.crop((round(n%3*w/3),round(n//3*h/2),round((n%3+1)*w/3),round((n//3+1)*h/2))).convert('RGB').save(output/f'{id}.webp',quality=88)
   by_id[id]=dict(id=id,name=name,family='COMMON',palette=palette,image=f'/aura/fashion-curated/{id}.webp',license='ORIGINAL',source='Composição original gerada para FashionAI')
 catalog['presets']=list(by_id.values());catalog['version']+=1
 temp=output/'catalog.json.tmp';temp.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');temp.replace(output/'catalog.json')
 print(json.dumps({'inserted':len(MODELS),'total':len(by_id),'family':'COMMON'}))
if __name__=='__main__':main()
