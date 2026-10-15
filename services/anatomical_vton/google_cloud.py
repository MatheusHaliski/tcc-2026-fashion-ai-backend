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


class VertexPredictionClient:
    def __init__(self, project, location, endpoint_id, *, credentials=None, transport=None):
        if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]|[0-9]{6,20}', project or ''):
            raise AlignmentError('INVALID_GOOGLE_CLOUD_PROJECT')
        if not re.fullmatch(r'[a-z]+-[a-z]+[0-9]', location or ''):
            raise AlignmentError('INVALID_GOOGLE_CLOUD_LOCATION')
        if not re.fullmatch(r'[0-9]{1,30}', endpoint_id or ''):
            raise AlignmentError('INVALID_VERTEX_ENDPOINT_ID')
        self.url = (f'https://{location}-aiplatform.googleapis.com/v1/projects/'
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
        if len(payload)>1_400_000:raise AlignmentError('VERTEX_REQUEST_LIMIT_REDUCE_IMAGE_SIZE')
        max_response_bytes=min(max_response_bytes,1_400_000)
        try:
            headers = self._headers()
            with httpx.Client(timeout=httpx.Timeout(120, connect=10), follow_redirects=False,
                              transport=self.transport) as client:
                with client.stream('POST', self.url, headers={**headers,'Content-Type':'application/json'}, content=payload) as response:
                    if response.status_code != 200:
                        # Model errors can contain private images/prompts: do not log the body.
                        raise AlignmentError(f'VERTEX_PREDICTION_HTTP_{response.status_code}')
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
