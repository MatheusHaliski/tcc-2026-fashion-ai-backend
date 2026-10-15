"""Real MediaPipe pose/segmentation probe; deliberately NOT full BodyEvidence.

33 pose joints do not measure garment seams, cervical contours or arm cross
sections. This result cannot be passed to the anatomical warper as certified fit.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from .auto_catalog import decode_image,png_bytes
from .models import AlignmentError

NAMES=('nose','left_eye_inner','left_eye','left_eye_outer','right_eye_inner','right_eye',
       'right_eye_outer','left_ear','right_ear','mouth_left','mouth_right',
       'left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist',
       'left_pinky','right_pinky','left_index','right_index','left_thumb','right_thumb',
       'left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle',
       'left_heel','right_heel','left_foot_index','right_foot_index')
EDGES=((11,12),(11,13),(13,15),(12,14),(14,16),(11,23),(12,24),(23,24),
       (23,25),(25,27),(24,26),(26,28),(27,29),(29,31),(28,30),(30,32))


def pose_result(landmarks,mask,width,height,model_hash):
    if len(landmarks)!=33:raise AlignmentError('POSE_REQUIRES_33_LANDMARKS')
    points=[]
    for name,landmark in zip(NAMES,landmarks):
        x,y=float(landmark.x),float(landmark.y)
        visibility=float(landmark.visibility or 0);presence=float(landmark.presence or 0)
        if not np.isfinite([x,y,visibility,presence]).all():raise AlignmentError('NONFINITE_POSE_LANDMARK')
        if not 0<=visibility<=1 or not 0<=presence<=1:raise AlignmentError('INVALID_POSE_CONFIDENCE')
        points.append({'name':name,'x':x*(width-1),'y':y*(height-1),
                       'visibility':visibility,'presence':presence,'inFrame':0<=x<=1 and 0<=y<=1})
    mask=np.asarray(mask,dtype=float)
    # Tasks 0.10.35 returns H×W×1; older versions returned H×W.
    if mask.shape==(height,width,1):mask=mask[:,:,0]
    if mask.shape!=(height,width) or not np.isfinite(mask).all() or np.any((mask<0)|(mask>1)):
        raise AlignmentError('INVALID_PERSON_SEGMENTATION')
    if not np.any(mask>.5):raise AlignmentError('EMPTY_PERSON_SEGMENTATION')
    return {'status':'POSE_ONLY','provider':'MEDIAPIPE_POSE_LANDMARKER','device':'CPU',
        'modelSha256':model_hash,'width':width,'height':height,'landmarks':points,
        'visibleLandmarks':sum(p['inFrame'] and min(p['visibility'],p['presence'])>=.8 for p in points),
        'body_mask':base64.b64encode(png_bytes(np.rint(mask*255).astype(np.uint8))).decode(),
        'anatomicalAnchorsComplete':False,'physicalFitCertified':False,
        'missingEvidence':['garment_seam_correspondence','neckline_contour','limb_cross_sections','foreground_skin_occlusion']}


class MediaPipeBodyPoseProbe:
    def __init__(self,model_path):
        path=Path(model_path).resolve()
        if not path.is_file():raise AlignmentError('POSE_MODEL_NOT_CONFIGURED')
        self.model_hash=hashlib.sha256(path.read_bytes()).hexdigest()
        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        self.mp=mp
        self.landmarker=vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(path),delegate=python.BaseOptions.Delegate.CPU),
            running_mode=vision.RunningMode.IMAGE,num_poses=2,
            min_pose_detection_confidence=.5,min_pose_presence_confidence=.5,
            output_segmentation_masks=True))

    def detect(self,person_rgb):
        image=np.asarray(person_rgb)
        if image.dtype!=np.uint8 or image.ndim!=3 or image.shape[2]!=3 or min(image.shape[:2])<16 or max(image.shape[:2])>1536:
            raise AlignmentError('INVALID_PERSON_IMAGE')
        result=self.landmarker.detect(self.mp.Image(image_format=self.mp.ImageFormat.SRGB,data=np.ascontiguousarray(image)))
        if len(result.pose_landmarks)!=1:raise AlignmentError('EXACTLY_ONE_VISIBLE_PERSON_REQUIRED')
        if not result.segmentation_masks or len(result.segmentation_masks)!=1:raise AlignmentError('PERSON_MASK_NOT_RETURNED')
        return pose_result(result.pose_landmarks[0],result.segmentation_masks[0].numpy_view(),image.shape[1],image.shape[0],self.model_hash)

    def close(self):self.landmarker.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model',required=True);parser.add_argument('--image',required=True)
    parser.add_argument('--output-dir',required=True,help='Private diagnostic output, not the original photo path')
    args=parser.parse_args();image=decode_image(Path(args.image).read_bytes(),'RGB')
    probe=MediaPipeBodyPoseProbe(args.model)
    try:result=probe.detect(image)
    finally:probe.close()
    output=Path(args.output_dir);output.mkdir(parents=True,exist_ok=True)
    mask=base64.b64decode(result.pop('body_mask'));(output/'person-mask.png').write_bytes(mask)
    (output/'pose.json').write_text(json.dumps(result,indent=2)+'\n')
    overlay=Image.fromarray(image);draw=ImageDraw.Draw(overlay)
    points=result['landmarks']
    for left,right in EDGES:
        a,b=points[left],points[right]
        if all(p['inFrame'] and min(p['visibility'],p['presence'])>=.8 for p in (a,b)):
            draw.line((a['x'],a['y'],b['x'],b['y']),fill='#00e5ff',width=3)
    for point in points:
        if point['inFrame']:
            x,y=point['x'],point['y'];color='#00e5ff' if min(point['visibility'],point['presence'])>=.8 else '#ffb347'
            draw.ellipse((x-3,y-3,x+3,y+3),fill=color)
    overlay.save(output/'pose-overlay.png')
    print(json.dumps({key:value for key,value in result.items() if key not in ('landmarks',)},ensure_ascii=False))

if __name__=='__main__':main()
