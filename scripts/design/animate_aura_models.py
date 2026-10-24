#!/usr/bin/env python3
"""Create silent six-second looping MP4s from local original AURA compositions.
Motion is a restrained periodic camera drift, not generative garment reconstruction.
"""
import argparse,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--overwrite',action='store_true');args=parser.parse_args()
 folder=ROOT/'media/aura/fashion-curated';path=folder/'catalog.json';catalog=json.loads(path.read_text());created=[]
 for preset in catalog['presets']:
  if preset.get('license')!='ORIGINAL':continue
  target=folder/f"{preset['id']}.mp4"
  if not target.exists() or args.overwrite:
   source=folder/f"{preset['id']}.webp"
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-i',str(source),'-vf',"zoompan=z='1.025+0.0125*cos(2*PI*on/144)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=144:s=432x648:fps=24",'-t','6','-an','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True,timeout=60)
  preset['video']=f"/aura/fashion-curated/{preset['id']}.mp4";preset['durationSeconds']=6;created.append(preset['id'])
 catalog['version']+=1;temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
 print(json.dumps({'animated':created,'format':'H264 MP4','durationSeconds':6,'fps':24}))
if __name__=='__main__':main()
