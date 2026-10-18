import json
import os
import unittest
from unittest.mock import patch
import httpx
from services.anatomical_vton.google_cloud import VertexPredictionClient, VertexAnnotationProvider
from services.anatomical_vton.models import AlignmentError
from services.anatomical_vton.monitor import configured_annotator
from scripts.cloud.plan_vton_gpu import deployment_plan


class GoogleCloudTests(unittest.TestCase):
    def client(self, handler):
        client=VertexPredictionClient('fashionai-test','us-central1','12345',transport=httpx.MockTransport(handler))
        # No real ADC or network in these transport tests.
        client._headers=lambda: {'Authorization':'Bearer TEST_ONLY'}
        return client

    def test_vertex_annotation_contract_and_google_only_destination(self):
        def handler(request):
            self.assertEqual(request.url.host,'us-central1-aiplatform.googleapis.com')
            self.assertTrue(request.url.path.endswith('/endpoints/12345:predict'))
            payload=json.loads(request.content)
            self.assertEqual(payload['instances'][0]['task'],'garment_annotation')
            self.assertEqual(payload['instances'][0]['image_png'],'cG5n')
            return httpx.Response(200,json={'predictions':[{'provider':'TEST_ONLY'}]})
        provider=VertexAnnotationProvider(self.client(handler))
        self.assertEqual(provider.annotate(b'png',{})['provider'],'TEST_ONLY')

    def test_sao_paulo_region_targets_regional_vertex_api(self):
        client=VertexPredictionClient('project-14023673-32d6-4bf2-8b7','southamerica-east1','12345')
        self.assertTrue(client.url.startswith('https://southamerica-east1-aiplatform.googleapis.com/'))
        self.assertIn('/locations/southamerica-east1/',client.url)

    def test_endpoint_cannot_be_user_url_or_path(self):
        for project,region,endpoint in [('../project','us-central1','123'),
                ('fashionai-test','evil.example.com','123'),('fashionai-test','us-central1','../123')]:
            with self.assertRaises(AlignmentError): VertexPredictionClient(project,region,endpoint)

    def test_private_upstream_error_is_not_exposed(self):
        client=self.client(lambda _:httpx.Response(403,text='PRIVATE_IMAGE_OR_TOKEN'))
        with self.assertRaisesRegex(AlignmentError,'^VERTEX_PREDICTION_HTTP_403$'):client.predict({})

    def test_redirect_is_not_followed(self):
        calls=[]
        def handler(request):
            calls.append(request.url)
            return httpx.Response(307,headers={'Location':'https://external.invalid'})
        with self.assertRaisesRegex(AlignmentError,'HTTP_307'):self.client(handler).predict({})
        self.assertEqual(len(calls),1)

    def test_response_size_and_contract_are_checked(self):
        with self.assertRaisesRegex(AlignmentError,'RESPONSE_LIMIT'):
            self.client(lambda _:httpx.Response(200,content=b'x'*30)).predict({},max_response_bytes=10)
        for value in ({'predictions':[]},{'predictions':['text']},{'predictions':[{},{}]}):
            with self.assertRaisesRegex(AlignmentError,'INVALID_VERTEX_PREDICTION_CONTRACT'):
                self.client(lambda _:httpx.Response(200,json=value)).predict({})

    def test_explicit_vertex_mode_never_falls_back_to_backend(self):
        with patch.dict(os.environ,{'VTON_ANNOTATION_PROVIDER':'vertex','GOOGLE_CLOUD_PROJECT':'',
                                   'VTON_BACKEND_URL':'https://backend.example'},clear=True):
            with self.assertRaisesRegex(AlignmentError,'INVALID_GOOGLE_CLOUD_PROJECT'):configured_annotator()

    def test_plan_is_read_only_and_limits_gpu_replicas(self):
        plan=deployment_plan('fashionai-test','us-central1','123','456',
                             'vton-runtime@fashionai-test.iam.gserviceaccount.com')
        self.assertFalse(plan['executed'])
        self.assertEqual(plan['replicas'],{'min':1,'max':1})
        self.assertIn('--max-replica-count=1',plan['commands'][-1])
        self.assertIn('--traffic-split=0=100',plan['commands'][-1])
        with self.assertRaises(ValueError):
            deployment_plan('fashionai-test','us-central1','123','456','owner@gmail.com')


if __name__=='__main__':unittest.main()
