"""Vertex /predict contract, one in-flight inference for the shared T4."""
from contextlib import asynccontextmanager
import json
import os
import threading
from typing import Literal
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from starlette.concurrency import run_in_threadpool
from ..models import AlignmentError
from .bundle import SharedGpuBundle

PAYLOAD_LIMIT=1_400_000  # Headroom below the shared endpoint's 1.5 MB limit.


class Instance(BaseModel):
    model_config=ConfigDict(extra='forbid')
    task:Literal['garment_annotation','body_evidence','virtual_try_on']
    garment_image:str|None=None
    category:Literal['tops','bottoms','one-pieces']|None=None
    garment_photo_type:Literal['auto','model','flat-lay']='auto'
    num_timesteps:int=Field(default=30,ge=20,le=50)
    seed:int=Field(default=42,ge=0,le=2**31-1)
    image_png:str|None=None
    person_image:str|None=None
    attributes:dict|None=None
    response_schema:dict|None=None  # Compatibility only; output uses our canonical schemas.
    quality_feedback:str|None=Field(default=None,max_length=160)
    @model_validator(mode='after')
    def task_input(self):
        if self.task=='virtual_try_on':
            if not self.garment_image or not self.person_image or not self.category or self.image_png is not None or self.attributes is not None or self.response_schema is not None or self.quality_feedback is not None:
                raise ValueError('PERSON_GARMENT_AND_CATEGORY_REQUIRED')
            return self
        if self.garment_image is not None or self.category is not None:raise ValueError('UNEXPECTED_GARMENT_INPUT')
        if self.task=='garment_annotation':
            if not self.image_png or self.person_image is not None or self.attributes is not None:
                raise ValueError('GARMENT_IMAGE_REQUIRED')
        elif not self.person_image or self.attributes is None or self.image_png is not None:
            raise ValueError('PERSON_IMAGE_AND_ATTRIBUTES_REQUIRED')
        return self


class PredictionRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    instances:list[Instance]=Field(min_length=1,max_length=1)


def create_app(runtime=None,loader=None):
    state={'runtime':runtime};capacity=threading.BoundedSemaphore(1)
    payload_limit=int(os.getenv('VTON_VERTEX_MAX_PAYLOAD',str(PAYLOAD_LIMIT)))
    if not PAYLOAD_LIMIT<=payload_limit<=9_000_000:raise ValueError('INVALID_VERTEX_PAYLOAD_LIMIT')
    @asynccontextmanager
    async def lifespan(_app):
        if state['runtime'] is None:
            if loader:factory=loader
            elif os.getenv('VTON_MODEL_ENGINE')=='fashn':
                from ..fashn_runtime import NativeFashnRuntime
                factory=lambda:NativeFashnRuntime(os.getenv('VTON_FASHN_WEIGHTS','/models/fashn'))
            else:factory=lambda:SharedGpuBundle(os.getenv('VTON_MODEL_BUNDLE','/models'))
            # Missing/untrusted weights or unavailable CUDA fail startup. Never serve a mock.
            state['runtime']=await run_in_threadpool(factory)
        yield
    app=FastAPI(title='FashionAI Vertex GPU',lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
    @app.get('/health')
    def health():
        model=state['runtime']
        if model is None or not model.ready:return JSONResponse({'status':'MODEL_NOT_READY'},status_code=503)
        return {'status':'ready','tasks':list(getattr(model,'tasks',('garment_annotation','body_evidence'))),'maxConcurrency':1}
    @app.post('/predict')
    async def predict(request:Request):
        model=state['runtime']
        if model is None or not model.ready:raise HTTPException(503,'MODEL_NOT_READY')
        data=bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data)>payload_limit:raise HTTPException(413,'VERTEX_PAYLOAD_LIMIT')
        try:body=PredictionRequest.model_validate_json(data)
        except (ValidationError,ValueError):raise HTTPException(422,'INVALID_PREDICTION_INPUT')
        if body.instances[0].task not in getattr(model,'tasks',('garment_annotation','body_evidence')):raise HTTPException(422,'TASK_NOT_SUPPORTED_BY_MODEL')
        if not capacity.acquire(blocking=False):raise HTTPException(429,'GPU_BUSY_RETRY_LATER')
        try:
            result=await run_in_threadpool(model.predict,body.instances[0].model_dump(exclude_none=True))
            encoded=json.dumps({'predictions':[result]},separators=(',',':'),allow_nan=False).encode()
            if len(encoded)>payload_limit:raise HTTPException(413,'VERTEX_RESPONSE_LIMIT')
            return Response(encoded,media_type='application/json')
        except HTTPException:raise
        except AlignmentError as error:
            # Only allow short diagnostic codes, no upstream exception bodies.
            code=str(error)
            if not code or len(code)>160 or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_:-' for c in code):code='MODEL_EVIDENCE_REJECTED'
            raise HTTPException(422,code)
        except Exception:
            raise HTTPException(503,'GPU_PREDICTION_FAILED')
        finally:capacity.release()
    return app

app=create_app()
