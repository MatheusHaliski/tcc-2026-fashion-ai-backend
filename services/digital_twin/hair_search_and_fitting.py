"""Select cleared hairstyle guide assets using supplied/classified attributes, not ethnicity."""
import json
from pathlib import Path
import numpy as np


def search_hair_assets(attributes,assets):
    # Texture taxonomy is a styling parameter. Do not infer race or gender.
    texture=attributes['texture'];style=attributes['style_id'];color=np.asarray(attributes['linear_rgb'],float)
    if color.shape!=(3,) or not np.isfinite(color).all() or np.any(color<0) or np.any(color>1):raise ValueError('INVALID_HAIR_COLOR')
    result=[]
    for asset in assets:
        if not asset.get('rights_cleared') or not asset.get('license') or asset.get('geometry')!='INDIVIDUAL_STRANDS':continue
        if texture not in asset['textures'] or style!=asset['style_id']:continue
        result.append({**asset,'colorDistance':float(np.linalg.norm(color-np.asarray(asset['linear_rgb'])))})
    return sorted(result,key=lambda a:a['colorDistance'])


def fit_hair_to_scalp(guide_strands,asset_landmarks,scalp_landmarks):
    source=np.asarray(asset_landmarks,float);target=np.asarray(scalp_landmarks,float);strands=np.asarray(guide_strands,float)
    if source.shape!=target.shape or source.ndim!=2 or source.shape[1]!=3 or len(source)<4 or not np.isfinite(source).all() or not np.isfinite(target).all():raise ValueError('CALIBRATED_SCALP_LANDMARKS_REQUIRED')
    a,b=source-source.mean(0),target-target.mean(0);u,_,vt=np.linalg.svd(a.T@b);rotation=vt.T@u.T
    if np.linalg.det(rotation)<0:vt[-1]*=-1;rotation=vt.T@u.T
    scale=np.sqrt((b*b).sum()/max((a*a).sum(),1e-9))
    fitted=(strands-source.mean(0))@rotation.T*scale+target.mean(0)
    return fitted,{'scale':float(scale),'units':'metres','geometry':'INDIVIDUAL_STRANDS'}
