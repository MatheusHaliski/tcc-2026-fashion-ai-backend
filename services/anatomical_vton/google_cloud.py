"""Private Vertex AI custom-model prediction using Application Default Credentials.

The endpoint must host our typed annotation/body contract. Merely enabling Vertex
or deploying a text model does not install DensePose, FLAME or SMPL-X weights.
"""
import base64
import json
import os
import re
import threading
import httpx
from .models import AlignmentError


# Códigos curtos que o servidor da GPU devolve no "detail" (vertex_runtime/server.py, fashn_runtime.py): o motivo de
# recusar a foto ou a peça. Só estes voltam ao app; qualquer outro corpo é descartado (pode ecoar imagens em base64).
SERVER_CODES=frozenset({
    'INVALID_PREDICTION_INPUT','TASK_NOT_SUPPORTED_BY_MODEL','INVALID_VTON_IMAGE','EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED',
    'INSUFFICIENT_SHARED_BODY_LANDMARKS','VISIBLE_LANDMARK_OUTSIDE_IMAGE','NONFINITE_DWPOSE','INVALID_PERSON_DETECTION',
    'GENERATED_POSE_DRIFT_REJECTED','DEGENERATE_GENERATED_IMAGE','ONE_GENERATED_IMAGE_REQUIRED','INVALID_GARMENT_POSE',
    'MULTIPLE_GARMENT_MODELS_REJECTED','FASHN_CATEGORY_NOT_SUPPORTED','GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD',
    'GPU_BUSY_RETRY_LATER','GPU_PREDICTION_FAILED','MODEL_NOT_READY',
    # Medidas do corpo (sam3d_runtime.py, body_measure.py).
    'FULL_BODY_NOT_VISIBLE','ONE_BODY_RECONSTRUCTION_REQUIRED','INVALID_BODY_MESH','INVALID_BODY_KEYPOINTS',
    'IMPLAUSIBLE_BODY_SCALE','IMPLAUSIBLE_BODY_PROPORTIONS','DEGENERATE_BODY_FRAME',
})


def server_code(response, limit=2048):
    """O código da allowlist no corpo de erro da GPU ({"detail": "CODIGO"}), lendo no máximo `limit` bytes; senão None."""
    data=bytearray()
    try:
        for chunk in response.iter_bytes():
            data.extend(chunk)
            if len(data)>limit:return None
        detail=json.loads(data).get('detail')
    except Exception:
        return None
    return detail if isinstance(detail,str) and detail in SERVER_CODES else None


class VertexPredictionClient:
    def __init__(self, project, location, endpoint_id, *, credentials=None, transport=None, dedicated_host=None):
        if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]|[0-9]{6,20}', project or ''):
            raise AlignmentError('INVALID_GOOGLE_CLOUD_PROJECT')
        if not re.fullmatch(r'[a-z]+-[a-z]+[0-9]', location or ''):
            raise AlignmentError('INVALID_GOOGLE_CLOUD_LOCATION')
        if not re.fullmatch(r'[0-9]{1,30}', endpoint_id or ''):
            raise AlignmentError('INVALID_VERTEX_ENDPOINT_ID')
        if dedicated_host and not re.fullmatch(r'[a-z0-9][a-z0-9.-]*\.prediction\.vertexai\.goog',dedicated_host):
            raise AlignmentError('INVALID_VERTEX_DEDICATED_HOST')
        self.payload_limit=9_000_000 if dedicated_host else 1_400_000
        self.timeout=600 if dedicated_host else 120
        self.endpoint_id=endpoint_id
        host=dedicated_host or f'{location}-aiplatform.googleapis.com'
        self.url = (f'https://{host}/v1/projects/'
                    f'{project}/locations/{location}/endpoints/{endpoint_id}:predict')
        self.credentials = credentials
        self.transport = transport
        self.lock = threading.Lock()

    def _headers(self):
        # Token refresh is serialized; never store a bearer token in config/logs.
        with self.lock:
            import google.auth
            from google.auth.transport.requests import Request
            if self.credentials is None:
                self.credentials, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
            headers = {}
            self.credentials.before_request(Request(), 'POST', self.url, headers)
            return headers

    def predict(self, instance, max_response_bytes=25_000_000):
        # Shared Vertex endpoints accept at most 1.5 MB; preserve coordinates by
        # rejecting oversized images rather than silently resizing them.
        payload=json.dumps({'instances':[instance]},separators=(',',':'),ensure_ascii=False).encode()
        if len(payload)>self.payload_limit:raise AlignmentError('VERTEX_REQUEST_LIMIT_REDUCE_IMAGE_SIZE')
        max_response_bytes=min(max_response_bytes,self.payload_limit)
        try:
            headers = self._headers()
            with httpx.Client(timeout=httpx.Timeout(self.timeout, connect=10), follow_redirects=False,
                              transport=self.transport) as client:
                with client.stream('POST', self.url, headers={**headers,'Content-Type':'application/json','X-Vertex-AI-Endpoint-Id':self.endpoint_id}, content=payload) as response:
                    if response.status_code != 200:
                        # Model errors can contain private images/prompts: never log or echo the body. Only a short
                        # code from the GPU server's own allowlist (why the photo was refused) goes back to the app.
                        raise AlignmentError(server_code(response) or f'VERTEX_PREDICTION_HTTP_{response.status_code}')
                    data = bytearray()
                    for chunk in response.iter_bytes():
                        data.extend(chunk)
                        if len(data) > max_response_bytes:
                            raise AlignmentError('VERTEX_RESPONSE_LIMIT')
            predictions = json.loads(data).get('predictions')
            if not isinstance(predictions, list) or len(predictions) != 1 or not isinstance(predictions[0], dict):
                raise AlignmentError('INVALID_VERTEX_PREDICTION_CONTRACT')
            return predictions[0]
        except AlignmentError:
            raise
        except Exception as exc:
            # Do not leak credential paths, tokens, user media or upstream bodies.
            raise AlignmentError('VERTEX_PREDICTION_UNAVAILABLE') from exc


def configured_vertex_client(endpoint_variable):
    return VertexPredictionClient(os.getenv('GOOGLE_CLOUD_PROJECT'), os.getenv('GOOGLE_CLOUD_LOCATION'),
                                  os.getenv(endpoint_variable))


class VertexAnnotationProvider:
    def __init__(self, client): self.client = client

    def annotate(self, image_png, schema, feedback=None):
        return self.client.predict({'task': 'garment_annotation',
            'image_png': base64.b64encode(image_png).decode(), 'response_schema': schema,
            'quality_feedback': feedback}, max_response_bytes=9_000_000)


def predict_body(person_image, attributes, schema):
    return configured_vertex_client('VTON_VERTEX_BODY_ENDPOINT_ID').predict({
        'task': 'body_evidence', 'person_image': person_image,
        'attributes': attributes, 'response_schema': schema})


def dedicated_gpu_client():
    endpoint=os.getenv('VTON_VERTEX_TRYON_ENDPOINT_ID')
    host=os.getenv('VTON_VERTEX_TRYON_DEDICATED_HOST')
    if not host:raise AlignmentError('FASHN_DEDICATED_ENDPOINT_REQUIRED')
    return VertexPredictionClient(os.getenv('GOOGLE_CLOUD_PROJECT'),os.getenv('GOOGLE_CLOUD_LOCATION'),endpoint,dedicated_host=host)


def predict_fashn(person_image,garment_image,category,garment_photo_type='auto'):
    return dedicated_gpu_client().predict({'task':'virtual_try_on','person_image':person_image,'garment_image':garment_image,
                           'category':category,'garment_photo_type':garment_photo_type})


def predict_body_measurement(person_image):
    # Same T4 container as the try-on (engine fashn+sam3d_body); the photo is not stored anywhere on the way.
    return dedicated_gpu_client().predict({'task':'body_measurement','person_image':person_image},max_response_bytes=64_000)
