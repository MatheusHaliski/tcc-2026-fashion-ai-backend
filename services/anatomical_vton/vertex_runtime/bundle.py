"""Versioned, licensed TorchScript artifacts; no guessed landmarks or fake weights.

Models take float RGB [1,3,H,W] in [0,1]. They return Dict[str,Tensor]. Anchors
are [N,3] normalized x/y and calibrated confidence; masks are probabilities.
Training/export is a separate process. This loader cannot turn unrelated model
weights (SAM, FLAME, a text LLM) into a garment-landmark network.
"""
import base64
import hashlib
import json
from pathlib import Path
from typing import Literal
import numpy as np
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, model_validator
from ..auto_catalog import GarmentAttributeSchema, GarmentAutoAnnotator, decode_image, png_bytes
from ..models import AlignmentError


ATTRIBUTE_NAMES=('category','subcategory','neckline_type','sleeve_length',
                 'closure_type','waistline_type','fit_type')


class ModelSpec(BaseModel):
    model_config=ConfigDict(extra='forbid')
    file:str=Field(pattern=r'^[a-zA-Z0-9_/-]+\.pt$')
    sha256:str=Field(pattern=r'^[a-f0-9]{64}$')
    license:str=Field(min_length=1,max_length=200)
    anchor_names:list[str]=Field(min_length=3,max_length=96)
    labels:dict[str,list[str]]=Field(default_factory=dict)
    supported_categories:list[str]=Field(min_length=1,max_length=30)
    @model_validator(mode='after')
    def unique_names(self):
        if len(set(self.anchor_names))!=len(self.anchor_names):raise ValueError('DUPLICATE_ANCHOR_NAMES')
        for labels in self.labels.values():
            if not labels or len(labels)!=len(set(labels)):raise ValueError('INVALID_LABEL_MAP')
        return self


class BundleManifest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    schema_version:Literal[1]
    model_version:str=Field(min_length=1,max_length=80)
    input_size:int=Field(ge=128,le=1024)
    calibration_report:str=Field(min_length=1,max_length=240)
    calibration_sha256:str=Field(pattern=r'^[a-f0-9]{64}$')
    garment:ModelSpec
    body:ModelSpec
    @model_validator(mode='after')
    def garment_label_contract(self):
        for spec in (self.garment,self.body):
            if set(spec.labels)!=set(ATTRIBUTE_NAMES):raise ValueError('MODEL_ATTRIBUTE_LABEL_MAP_REQUIRED')
        return self


def contained_file(root,name):
    path=(root/name).resolve()
    if not path.is_relative_to(root):raise AlignmentError('MODEL_PATH_OUTSIDE_BUNDLE')
    if not path.is_file():raise AlignmentError('MODEL_ARTIFACT_MISSING')
    return path


def verify_digest(path,expected):
    digest=hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda:file.read(1024*1024),b''):digest.update(chunk)
    if digest.hexdigest()!=expected:raise AlignmentError('MODEL_ARTIFACT_HASH_MISMATCH')


def validate_bundle(path):
    root=Path(path).resolve()
    manifest_path=contained_file(root,'manifest.json')
    if manifest_path.stat().st_size>100_000:raise AlignmentError('MODEL_MANIFEST_LIMIT')
    manifest=BundleManifest.model_validate_json(manifest_path.read_bytes())
    for spec in (manifest.garment,manifest.body):
        verify_digest(contained_file(root,spec.file),spec.sha256)
    verify_digest(contained_file(root,manifest.calibration_report),manifest.calibration_sha256)
    # Presence/integrity is not verification that the report's claims are true.
    return root,manifest


def image_input(encoded):
    try:return decode_image(base64.b64decode(encoded,validate=True),'RGB')
    except Exception as exc:raise AlignmentError('INVALID_MODEL_IMAGE') from exc


def points_from_tensor(values,names,width,height):
    values=np.asarray(values,dtype=float)
    if values.shape!=(len(names),3) or not np.isfinite(values).all():raise AlignmentError('INVALID_MODEL_ANCHORS')
    if np.any(values<0) or np.any(values>1):raise AlignmentError('MODEL_ANCHORS_EXPECTED_NORMALIZED')
    if np.any(values[:,2]<.8):raise AlignmentError('MODEL_LANDMARK_CONFIDENCE_TOO_LOW')
    return {name:{'x':float(v[0]*(width-1)),'y':float(v[1]*(height-1)),
                  'confidence':float(v[2])} for name,v in zip(names,values)}


def curve_from_tensor(values,width,height):
    values=np.asarray(values,dtype=float)
    if values.size==0:return []
    if values.ndim!=2 or values.shape[1]!=3 or len(values)>24:raise AlignmentError('INVALID_MODEL_CURVE')
    return list(points_from_tensor(values,[str(i) for i in range(len(values))],width,height).values())


def mask_from_tensor(values,width,height):
    values=np.asarray(values,dtype=float)
    if values.ndim!=2 or min(values.shape)<2 or not np.isfinite(values).all() or np.any((values<0)|(values>1)):
        raise AlignmentError('INVALID_MODEL_MASK')
    mask=Image.fromarray((values*255).round().astype(np.uint8)).resize((width,height),Image.Resampling.BILINEAR)
    return base64.b64encode(png_bytes(np.asarray(mask))).decode()


class SharedGpuBundle:
    def __init__(self,path):
        root,self.manifest=validate_bundle(path)
        import torch
        if not torch.cuda.is_available():raise AlignmentError('CUDA_REQUIRED_FOR_VERTEX_GPU_MODEL')
        self.torch=torch;self.device=torch.device('cuda:0')
        # Only trusted, hash-verified exports packaged by the model owner.
        self.garment=torch.jit.load(str(contained_file(root,self.manifest.garment.file)),map_location=self.device).eval()
        self.body=torch.jit.load(str(contained_file(root,self.manifest.body.file)),map_location=self.device).eval()
        # Warm both exports before readiness; no semantic accuracy claim is made.
        probe=np.zeros((self.manifest.input_size,self.manifest.input_size,3),np.uint8)
        self._run(self.garment,probe);self._run(self.body,probe,[0]*len(ATTRIBUTE_NAMES))
        self.ready=True

    def _run(self,model,image,attribute_indexes=None):
        resized=np.asarray(Image.fromarray(image).resize((self.manifest.input_size,)*2,Image.Resampling.BILINEAR)).copy()
        tensor=self.torch.from_numpy(resized).permute(2,0,1).unsqueeze(0).float().to(self.device)/255
        with self.torch.inference_mode():
            if attribute_indexes is None:result=model(tensor)
            else:
                features=self.torch.tensor([attribute_indexes],dtype=self.torch.long,device=self.device)
                result=model(tensor,features)
        if not isinstance(result,dict):raise AlignmentError('MODEL_OUTPUT_MUST_BE_TENSOR_DICTIONARY')
        return {key:value.detach().float().cpu().numpy() for key,value in result.items()}

    def annotate(self,image_png,schema=None,feedback=None):
        image=decode_image(image_png,'RGB');h,w=image.shape[:2];output=self._run(self.garment,image)
        attributes={};confidence=1.
        for name in ATTRIBUTE_NAMES:
            scores=output.get(name);labels=self.manifest.garment.labels[name]
            if scores is None:raise AlignmentError('MODEL_ATTRIBUTE_MISSING')
            scores=np.asarray(scores,dtype=float)
            if scores.shape!=(len(labels),) or not np.isfinite(scores).all() or np.any((scores<0)|(scores>1)) or abs(scores.sum()-1)>.01:
                raise AlignmentError('MODEL_ATTRIBUTE_PROBABILITIES_REQUIRED')
            index=int(np.argmax(scores));confidence=min(confidence,float(scores[index]));attributes[name]=labels[index]
        if confidence<.8:raise AlignmentError('MODEL_ATTRIBUTE_CONFIDENCE_TOO_LOW')
        attributes['confidence']=confidence
        if attributes['category'] not in self.manifest.garment.supported_categories:raise AlignmentError('MODEL_CATEGORY_NOT_SUPPORTED')
        return {'attributes':attributes,'keypoints':points_from_tensor(output['anchors'],self.manifest.garment.anchor_names,w,h),
                'mask_png':mask_from_tensor(output['mask'],w,h),
                'neckline_curve':curve_from_tensor(output.get('neckline_curve',[]),w,h),
                'placket':curve_from_tensor(output.get('placket',[]),w,h),
                'provider':'VERTEX_TORCHSCRIPT','model_version':self.manifest.model_version,'repairs':[]}

    def predict(self,instance):
        if instance['task']=='garment_annotation':
            image=image_input(instance['image_png'])
            # Apply existing edge/curve/profile validation before returning evidence.
            return GarmentAutoAnnotator(self,self.manifest.model_version).annotate(image).model_dump(mode='json')
        attributes=GarmentAttributeSchema.model_validate(instance['attributes'])
        if attributes.category.value not in self.manifest.body.supported_categories:raise AlignmentError('BODY_MODEL_CATEGORY_NOT_SUPPORTED')
        image=image_input(instance['person_image']);h,w=image.shape[:2]
        attribute_values=attributes.model_dump(mode='json')
        try:indexes=[self.manifest.body.labels[name].index(attribute_values[name]) for name in ATTRIBUTE_NAMES]
        except ValueError as exc:raise AlignmentError('BODY_MODEL_ATTRIBUTE_NOT_SUPPORTED') from exc
        output=self._run(self.body,image,indexes)
        from ..api import BodyEvidence
        evidence=BodyEvidence.model_validate({'anchors':points_from_tensor(output['anchors'],self.manifest.body.anchor_names,w,h),
            'body_mask':mask_from_tensor(output['body_mask'],w,h),
            'foreground_skin_mask':mask_from_tensor(output['foreground_skin_mask'],w,h),
            'wearable_region_mask':mask_from_tensor(output['wearable_region_mask'],w,h),
            'neckline_target':curve_from_tensor(output.get('neckline_target',[]),w,h),
            'sagittal_target':curve_from_tensor(output.get('sagittal_target',[]),w,h),
            'provenance':'ANNOTATED_2D'})
        return evidence.model_dump(mode='json')
