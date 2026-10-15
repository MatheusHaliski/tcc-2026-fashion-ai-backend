"""Private worker API. Authenticated Java backend owns users, catalog and media rights."""
import base64
import hmac
import json
import os
import threading
from typing import Annotated
import httpx
import numpy as np
from fastapi import FastAPI,Depends,Header,HTTPException,Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel,ConfigDict,Field,model_validator
from .models import Observation,Anchor,AlignmentError
from .auto_catalog import Point,decode_image,png_bytes
from .dynamic import DynamicAnatomicalWarper
from .monitor import configured_store,configured_annotator


class BodyEvidence(BaseModel):
    model_config=ConfigDict(extra='forbid')
    anchors:dict[str,Point]=Field(min_length=3,max_length=128)
    body_mask:str=Field(max_length=8_000_000)
    foreground_skin_mask:str=Field(max_length=8_000_000)
    wearable_region_mask:str=Field(max_length=8_000_000)
    neckline_target:list[Point]=Field(default_factory=list,max_length=24)
    sagittal_target:list[Point]=Field(default_factory=list,max_length=12)
    provenance:str=Field(pattern=r'^(ANNOTATED_2D|DENSEPOSE_PROJECTED|SMPLX_PROJECTED)$')


class CatalogInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    garment_image:str=Field(max_length=8_000_000)


class TryOnInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    garment_id:str|None=Field(default=None,max_length=80,pattern=r'^[A-Za-z0-9_:-]+$')
    garment_image:str|None=Field(default=None,max_length=8_000_000)
    person_image:str=Field(max_length=8_000_000)
    body_evidence:BodyEvidence|None=None
    mirror:bool=False
    @model_validator(mode='after')
    def garment_input(self):
        if (self.garment_id is None)==(self.garment_image is None):raise ValueError('Provide exactly one garment_id or garment_image')
        return self


def b64_image(value,mode='RGBA'):
    try:return decode_image(base64.b64decode(value,validate=True),mode)
    except Exception as exc:raise AlignmentError('INVALID_ENCODED_IMAGE') from exc


def mirror_result(image,anchors=None):
    # Pixel centers are [0,W-1], hence W-1-x (W-x is one pixel out of bounds).
    transformed=None if anchors is None else {key:{**point,'x':image.shape[1]-1-point['x']} for key,point in anchors.items()}
    return np.ascontiguousarray(image[:,::-1]),transformed


class RequestSizeLimit:
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        size=0
        async def limited_receive():
            nonlocal size
            message=await receive()
            if message['type']=='http.request':
                size+=len(message.get('body',b''))
                if size>32_000_000:raise HTTPException(413,'REQUEST_TOO_LARGE')
            return message
        await self.app(scope,limited_receive,send)


def create_app(store=None,annotator=None,token=None):
    app=FastAPI(title='FashionAI Anatomical VTON',docs_url=None,redoc_url=None)
    expected=token if token is not None else os.getenv('VTON_WORKER_TOKEN','')
    capacity=threading.BoundedSemaphore(2)
    # Lazy initialization: importing app does not create a database or contact S3.
    resources={};lock=threading.Lock()
    def resources_for_request():
        with lock:
            if not resources:resources.update(store=store or configured_store(),annotator=annotator or configured_annotator())
        return resources
    def authenticate(authorization:Annotated[str|None,Header()]=None):
        if not expected:raise HTTPException(503,'WORKER_AUTH_NOT_CONFIGURED')
        if not authorization or not hmac.compare_digest(authorization,f'Bearer {expected}'):raise HTTPException(401,'UNAUTHORIZED')
    @app.exception_handler(AlignmentError)
    async def alignment_error(_request,exc):return JSONResponse(status_code=422,content={'code':str(exc)[:160]})
    @app.exception_handler(ValueError)
    async def invalid_request(_request,exc):return JSONResponse(status_code=422,content={'code':'INVALID_INPUT'})
    app.add_middleware(RequestSizeLimit)
    @app.get('/health')
    def health():return {'status':'ok','space':'PROJECTED_2D','physicalFitCertified':False}
    @app.post('/v1/catalog/{garment_id}',dependencies=[Depends(authenticate)])
    def enqueue(garment_id:str,body:CatalogInput):
        r=resources_for_request();result=r['store'].enqueue(garment_id,b64_image(body.garment_image),r['annotator'].version)
        return result
    @app.get('/v1/catalog/{garment_id}',dependencies=[Depends(authenticate)])
    def status(garment_id:str):
        r=resources_for_request();row=r['store'].get(garment_id)
        if row is None:raise HTTPException(404,'GARMENT_NOT_FOUND')
        return {'state':row['state'],'jobKey':row['job_key'],'attempts':row['attempts'],'errorCode':row['error_code'],'modelVersion':row['model_version']}
    @app.get('/v1/monitor',dependencies=[Depends(authenticate)])
    def monitor():return {'queue':resources_for_request()['store'].stats()}
    @app.post('/try-on',dependencies=[Depends(authenticate)])
    def try_on(body:TryOnInput):
        if not capacity.acquire(blocking=False):raise HTTPException(429,'WORKER_BUSY')
        try:
            r=resources_for_request();catalog=r['store']
            if body.garment_image:
                from .store import content_key
                image=b64_image(body.garment_image);garment_id='upload:'+content_key(png_bytes(image))
                catalog.enqueue(garment_id,image,r['annotator'].version)
            else:garment_id=body.garment_id
            row=catalog.get(garment_id)
            if row is None:raise HTTPException(404,'GARMENT_NOT_INGESTED')
            if row['state']!='READY':return JSONResponse(status_code=202,content={'status':row['state'],'garmentId':garment_id,'jobKey':row['job_key'],'code':'GARMENT_ANNOTATION_NOT_READY'})
            annotation=catalog.annotation(row);garment=decode_image(catalog.artifacts.get(row['image_key']))
            person=b64_image(body.person_image,'RGB');evidence=body.body_evidence
            if evidence is None and os.getenv('VTON_BODY_PROVIDER') == 'vertex':
                from .google_cloud import predict_body
                evidence=BodyEvidence.model_validate(predict_body(body.person_image, annotation.attributes.model_dump(mode='json'), BodyEvidence.model_json_schema()))
            if evidence is None:
                url=os.getenv('VTON_BODY_MODEL_URL');body_token=os.getenv('VTON_BODY_MODEL_TOKEN')
                if not url or not body_token:raise HTTPException(503,'BODY_MODEL_NOT_CONFIGURED')
                with httpx.Client(timeout=httpx.Timeout(60,connect=5),follow_redirects=False) as client:
                    with client.stream('POST',url,headers={'Authorization':f'Bearer {body_token}'},json={'person_image':body.person_image,'attributes':annotation.attributes.model_dump(mode='json'),'response_schema':BodyEvidence.model_json_schema()}) as response:
                        response.raise_for_status();data=bytearray()
                        for chunk in response.iter_bytes():
                            data.extend(chunk)
                            if len(data)>25_000_000:raise AlignmentError('BODY_MODEL_RESPONSE_LIMIT')
                        evidence=BodyEvidence.model_validate_json(data)
            body_mask=b64_image(evidence.body_mask,'L')/255
            obs=Observation({k:Anchor(v.x,v.y,v.confidence) for k,v in evidence.anchors.items()},body_mask,evidence.provenance)
            output,diagnostics=DynamicAnatomicalWarper().warp(annotation,garment,person,obs,
                foreground_skin_mask=b64_image(evidence.foreground_skin_mask,'L')/255,
                wearable_region_mask=b64_image(evidence.wearable_region_mask,'L')/255,
                neckline_target=evidence.neckline_target or None,sagittal_target=evidence.sagittal_target or None)
            if body.mirror:output,_=mirror_result(output)
            return {'status':'READY','image_png':base64.b64encode(png_bytes(output)).decode(),'diagnostics':{**diagnostics,'mirror':body.mirror,'garmentId':garment_id,'modelVersion':row['model_version']}}
        finally:capacity.release()
    return app

app=create_app()
