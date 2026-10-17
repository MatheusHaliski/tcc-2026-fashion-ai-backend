"""Bounded catalog QA. Missing ground truth never becomes a passing score."""
import asyncio
import json
import time
import numpy as np
from scipy.ndimage import gaussian_filter
from .profiles import PROFILES


def mask_iou(predicted,expected):
    a,b=np.asarray(predicted,bool),np.asarray(expected,bool)
    if a.shape!=b.shape or a.ndim!=2:raise ValueError('MASK_SHAPE_MISMATCH')
    union=np.count_nonzero(a|b)
    return float(np.count_nonzero(a&b)/union) if union else None


def structural_similarity(rendered,ground_truth):
    a,b=np.asarray(rendered,float)/255,np.asarray(ground_truth,float)/255
    if a.shape!=b.shape or a.ndim!=3 or a.shape[2]!=3 or min(a.shape[:2])<11 or not np.isfinite(a).all() or not np.isfinite(b).all():raise ValueError('ALIGNED_RGB_GROUND_TRUTH_REQUIRED')
    # Local SSIM: only meaningful against an aligned reference for this pose.
    means_a=gaussian_filter(a,(1.5,1.5,0));means_b=gaussian_filter(b,(1.5,1.5,0))
    va=gaussian_filter(a*a,(1.5,1.5,0))-means_a**2;vb=gaussian_filter(b*b,(1.5,1.5,0))-means_b**2
    cov=gaussian_filter(a*b,(1.5,1.5,0))-means_a*means_b
    result=((2*means_a*means_b+.01**2)*(2*cov+.03**2))/((means_a**2+means_b**2+.01**2)*(va+vb+.03**2))
    return float(result[5:-5,5:-5].mean())


def reevaluate_catalog_pipeline(rendered,predicted_mask,*,ground_truth=None,expected_mask=None,cloth_body_signed_distances=None):
    if ground_truth is None or expected_mask is None or cloth_body_signed_distances is None:return {'status':'UNVERIFIED','reason':'GROUND_TRUTH_MASK_AND_COLLISION_EVIDENCE_REQUIRED'}
    distances=np.asarray(cloth_body_signed_distances,float)
    if not distances.size or not np.isfinite(distances).all():raise ValueError('INVALID_CLIPPING_EVIDENCE')
    iou=mask_iou(predicted_mask,expected_mask);ssim=structural_similarity(rendered,ground_truth)
    clipping=float(np.mean(distances<-.001))
    passed=iou is not None and iou>=.90 and ssim>=.85 and clipping<=.005
    return {'status':'PASS' if passed else 'REJECTED','maskIoU':iou,'ssim':ssim,'clippingLoss':clipping,'thresholdPolicy':'INITIAL_QA_V1_NOT_PHYSICAL_CERTIFICATION'}


def auto_fix_subcategory_pipeline(category,subcategory,attributes=None):
    """Propose a generic profile; never enable unknown semantic anchors on its own."""
    mapping={'top':'TOP','outerwear':'OUTERWEAR','dress':'DRESS','jumpsuit':'JUMPSUIT','footwear':'FOOTWEAR','headwear':'HEADWEAR','gloves':'GLOVES','neckwear':'NECKWEAR','belt':'BELT','eyewear':'EYEWEAR','watch':'WATCH'}
    family=mapping.get(category)
    if category=='bottom':family='SKIRT' if subcategory.startswith('skirt') else 'SHORTS' if subcategory.startswith('short') else 'TROUSERS'
    rules=PROFILES.get(family,[])
    return {'category':category,'subcategory':subcategory,'family':family,
            'status':'REQUIRES_PIPELINE_GENERATION','active':False,
            'candidateAnchors':[rule.name for rule in rules],
            'requiredValidation':['model_landmarks','body_mapping','representative_avatar_QA'],
            'reason':'No unvalidated generic profile is activated automatically.'}


class CatalogHealthScanner:
    def __init__(self,store):self.store=store
    def scan_page(self,after='',limit=100):
        if not 1<=limit<=1000:raise ValueError('INVALID_SCAN_PAGE_SIZE')
        events=[]
        with self.store.connection() as db:
            rows=self.store.execute(db,'SELECT job_key,state,result_json,error_code FROM vton_annotation_jobs WHERE job_key>? ORDER BY job_key LIMIT ?', (after,limit)).fetchall()
            for row in rows:
                code=None
                if row['state']=='READY':
                    try:
                        result=json.loads(row['result_json']);family=result['attributes']['category'].upper()
                        if family=='BOTTOM':family='TROUSERS'
                        if family not in PROFILES or not result.get('keypoints') or not result.get('mask_key'):code='REQUIRES_PIPELINE_GENERATION'
                    except (KeyError,ValueError,TypeError):code='BROKEN_ANNOTATION'
                elif row['state']=='DEAD':code='REQUIRES_PIPELINE_GENERATION' if 'PIPELINE' in (row['error_code'] or '') else 'RETRY_LIMIT_REACHED'
                if code:events.append({'jobKey':row['job_key'],'status':code})
        return {'cursor':rows[-1]['job_key'] if rows else None,'events':events,'scanned':len(rows)}
    async def run(self,interval_seconds=60):
        cursor=''
        while True:
            result=await asyncio.to_thread(self.scan_page,cursor)
            print(json.dumps({'event':'catalog_health',**result}),flush=True)
            cursor=result['cursor'] or ''
            await asyncio.sleep(0 if result['scanned']==100 else max(1,interval_seconds))

ReevaluateCatalogPipeline=reevaluate_catalog_pipeline
AutoFixSubcategoryPipeline=auto_fix_subcategory_pipeline

if __name__=='__main__':
    from .monitor import configured_store
    asyncio.run(CatalogHealthScanner(configured_store()).run())
