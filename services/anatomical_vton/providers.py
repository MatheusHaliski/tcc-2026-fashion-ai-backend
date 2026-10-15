"""Configured model adapters only. No synthetic detector is selected in production."""
import base64
import httpx
from .models import AlignmentError


class HttpAnnotationProvider:
    def __init__(self,url,token):
        if not url or not token: raise AlignmentError('ANNOTATION_MODEL_NOT_CONFIGURED')
        self.url=url;self.token=token

    def annotate(self,image_png,schema,feedback=None):
        # Deployment-owned endpoint; no URL comes from a garment/user payload.
        with httpx.Client(timeout=httpx.Timeout(60,connect=5),follow_redirects=False) as client:
            with client.stream('POST',self.url,headers={'Authorization':f'Bearer {self.token}'},json={
                'image_png':base64.b64encode(image_png).decode(),'response_schema':schema,'quality_feedback':feedback}) as response:
                response.raise_for_status();data=bytearray()
                for chunk in response.iter_bytes():
                    data.extend(chunk)
                    if len(data)>9_000_000: raise AlignmentError('MODEL_RESPONSE_LIMIT')
                import json
                return json.loads(data)
