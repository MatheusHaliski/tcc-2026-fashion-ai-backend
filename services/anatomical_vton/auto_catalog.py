"""Automatic annotation with strict typed outputs and small, audited mask repairs."""
from enum import Enum
from typing import Protocol
import base64
import io
import numpy as np
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, model_validator
from scipy import ndimage
from .models import Anchor, Observation, AlignmentError
from .profiles import rules_for


class Category(str, Enum):
    top='top'; bottom='bottom'; dress='dress'; outerwear='outerwear'
    jumpsuit='jumpsuit'; footwear='footwear'; headwear='headwear'; gloves='gloves'
    neckwear='neckwear'; belt='belt'; eyewear='eyewear'; watch='watch'


class GarmentAttributeSchema(BaseModel):
    model_config = ConfigDict(extra='forbid')
    category: Category
    subcategory: str = Field(min_length=1, max_length=80, pattern=r'^[a-z0-9_]+$')
    neckline_type: str = Field(pattern=r'^(none|round|v_neck|polo_collar|turtleneck|off_shoulder|hood|strapless|other)$')
    sleeve_length: str = Field(pattern=r'^(sleeveless|short_sleeve|elbow_length|long_sleeve|3_4_sleeve)$')
    closure_type: str = Field(pattern=r'^(none|front_buttons|zip|wrap|tie)$')
    waistline_type: str = Field(pattern=r'^(none|high_waist|mid_waist|low_waist|elastic|drawstring)$')
    fit_type: str = Field(pattern=r'^(tight|regular|oversized|relaxed)$')
    confidence: float = Field(ge=.8, le=1)

    @property
    def family(self):
        if self.category == Category.bottom:
            if self.subcategory.startswith('skirt'): return 'SKIRT'
            if self.subcategory in {'shorts','bermuda','shorts_denim'}: return 'SHORTS'
            return 'TROUSERS'
        return self.category.value.upper()

    @property
    def sleeve_profile(self):
        if self.sleeve_length == 'sleeveless': return 'NONE'
        return 'LONG' if self.sleeve_length in {'long_sleeve','3_4_sleeve','elbow_length'} else 'SHORT'

    @model_validator(mode='after')
    def applicable_sleeves(self):
        if self.category not in {Category.top,Category.outerwear,Category.dress,Category.jumpsuit} and self.sleeve_length != 'sleeveless':
            raise ValueError('Sleeves are not applicable to this category')
        if self.subcategory in {'skirt','skirt_long','shorts','jeans'} and self.category != Category.bottom:
            raise ValueError('Subcategory contradicts category')
        return self


class Point(BaseModel):
    model_config = ConfigDict(extra='forbid')
    x: float = Field(allow_inf_nan=False)
    y: float = Field(allow_inf_nan=False)
    confidence: float = Field(ge=.8, le=1)


class Annotation(BaseModel):
    model_config = ConfigDict(extra='forbid')
    attributes: GarmentAttributeSchema
    keypoints: dict[str, Point] = Field(min_length=3, max_length=96)
    neckline_curve: list[Point] = Field(default_factory=list, max_length=24)
    placket: list[Point] = Field(default_factory=list, max_length=12)
    mask_png: str = Field(max_length=8_000_000)
    provider: str = Field(min_length=1, max_length=80)
    model_version: str = Field(min_length=1, max_length=80)
    repairs: list[str] = Field(default_factory=list, max_length=20)


def decode_image(data: bytes, mode='RGBA'):
    if not data or len(data) > 6_000_000:
        raise AlignmentError('IMAGE_BYTE_LIMIT')
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.width > 1536 or im.height > 1536 or min(im.size)<16:
                raise AlignmentError('IMAGE_DIMENSION_LIMIT')
            return np.asarray(im.convert(mode)).copy()
    except (OSError, ValueError) as exc:
        raise AlignmentError('INVALID_IMAGE') from exc


def png_bytes(image):
    out=io.BytesIO();Image.fromarray(np.asarray(image,dtype=np.uint8)).save(out,format='PNG');return out.getvalue()


class AnnotationProvider(Protocol):
    def annotate(self, image_png: bytes, schema: dict, feedback: str | None = None) -> dict: ...


class GarmentAutoAnnotator:
    def __init__(self, provider: AnnotationProvider | None, version: str):
        if not version or len(version)>80: raise AlignmentError('INVALID_ANNOTATOR_VERSION')
        self.provider=provider; self.version=version

    def annotate(self, garment_rgba, feedback=None) -> Annotation:
        if self.provider is None:
            raise AlignmentError('ANNOTATION_MODEL_NOT_CONFIGURED')
        raw=self.provider.annotate(png_bytes(garment_rgba),Annotation.model_json_schema(),feedback)
        annotation=Annotation.model_validate(raw)
        if annotation.model_version != self.version:
            raise AlignmentError('ANNOTATOR_VERSION_MISMATCH')
        mask=decode_image(base64.b64decode(annotation.mask_png,validate=True),'L')
        if mask.shape != garment_rgba.shape[:2]: raise AlignmentError('MASK_IMAGE_SIZE_MISMATCH')
        binary=mask>=128
        if binary.mean()<.005 or binary.mean()>.98: raise AlignmentError('IMPLAUSIBLE_GARMENT_MASK')
        labels,count=ndimage.label(binary)
        sizes=np.bincount(labels.ravel()); sizes[0]=0
        # Only remove isolated raster specks <= .02% of image pixels. Do not fill
        # holes or erase real openings, logos, mesh fabric or garment topology.
        tiny=(sizes>0)&(sizes<=max(1,int(binary.size*.0002)))
        clean=binary&~tiny[labels]
        changed=int(np.count_nonzero(clean!=binary))
        if changed/binary.size > .005: raise AlignmentError('MASK_REQUIRES_MODEL_REANNOTATION')
        if changed: annotation.repairs.append(f'REMOVED_ISOLATED_MASK_PIXELS:{changed}')
        edge=clean^ndimage.binary_erosion(clean)
        distance=ndimage.distance_transform_edt(~edge)
        rules=rules_for(annotation.attributes.family,annotation.attributes.sleeve_profile)
        for rule in rules:
            point=annotation.keypoints.get(rule.name)
            if point is None: raise AlignmentError(f'MISSING_GARMENT_KEYPOINT:{rule.name}')
            x,y=int(round(point.x)),int(round(point.y))
            if not 0<=x<mask.shape[1] or not 0<=y<mask.shape[0]: raise AlignmentError('KEYPOINT_OUTSIDE_IMAGE')
            # Interior anchors (crotch, knee, chest, closure) need not touch silhouette.
            if any(name in rule.name for name in ('hem_','cuff_','neck_','shoulder_','axilla_')) and distance[y,x]>max(3,min(mask.shape)*.025):
                raise AlignmentError(f'KEYPOINT_TOO_FAR_FROM_EDGE:{rule.name}')
        attr=annotation.attributes
        if attr.neckline_type!='none' and attr.category in {Category.top,Category.outerwear,Category.dress,Category.jumpsuit} and len(annotation.neckline_curve)<3:
            raise AlignmentError('NECKLINE_CURVE_REQUIRED')
        if attr.closure_type=='front_buttons' and len(annotation.placket)<2:
            raise AlignmentError('BUTTON_LINE_REQUIRED')
        if attr.closure_type=='zip' and not annotation.placket:
            # A zip is not necessarily centered/front. The detector must locate it;
            # only an explicitly mapped front closure is constrained to sagittal line.
            annotation.repairs.append('ZIP_LOCATION_NOT_MAPPED')
        for point in [*annotation.neckline_curve,*annotation.placket]:
            if not 0<=point.x<mask.shape[1] or not 0<=point.y<mask.shape[0]: raise AlignmentError('CURVE_OUTSIDE_IMAGE')
        annotation.mask_png=base64.b64encode(png_bytes(clean.astype(np.uint8)*255)).decode()
        return annotation

    @staticmethod
    def observation(annotation):
        mask=decode_image(base64.b64decode(annotation.mask_png,validate=True),'L')/255
        return Observation({k:Anchor(v.x,v.y,v.confidence) for k,v in annotation.keypoints.items()},mask,
                           f'{annotation.provider}:{annotation.model_version}')
