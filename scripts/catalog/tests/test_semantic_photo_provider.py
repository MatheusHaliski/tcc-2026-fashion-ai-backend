import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import numpy as np
from PIL import Image, ImageDraw
from scripts.catalog.photo_set import process_photo
from scripts.catalog.semantic_photo_provider import AutomaticClothProvider, AUTOMATIC_POLICY_VERSION
from scripts.catalog.process_photo_sets import build_set, current
from scripts.catalog.process_local_photos import run


def scene(height=80, *, logo=False, exterior_line=False):
    size=(160,200);image=Image.new('RGB',size,'white');labels=np.zeros((200,160),dtype=np.uint8)
    target=Image.new('L',size);box=(40,60,119,60+height-1)
    ImageDraw.Draw(image).rectangle(box,fill='blue');ImageDraw.Draw(target).rectangle(box,fill=255)
    labels[60:60+height,40:120]=3
    labels[10:40,65:95]=1;ImageDraw.Draw(image).rectangle((65,10,94,39),fill='pink')
    labels[160:190,40:120]=6;ImageDraw.Draw(image).rectangle((40,160,119,189),fill='green')
    if logo:
        labels[85:99,64:96]=0
        ImageDraw.Draw(image).rectangle((64,85,95,98),fill='white')
    if exterior_line:
        ImageDraw.Draw(target).line((119,75,150,75),fill=255,width=1)
        ImageDraw.Draw(image).line((119,75,150,75),fill='black',width=1)
    p=np.full((18,200,160),.01/17,dtype=np.float32)
    for label in range(18):p[label][labels==label]=.99
    parser=Mock(spec=['probabilities','model_sha256']);parser.probabilities.return_value=p;parser.model_sha256='a'*64
    segmenter=Mock(spec=['mask']);segmenter.mask.return_value=target
    return image,AutomaticClothProvider(segmenter,parser),labels


class AutomaticProviderTest(unittest.TestCase):
    def test_actual_probability_consensus_removes_person_other_piece_background_and_exterior_line(self):
        image,provider,_=scene(exterior_line=True)
        result=process_photo(image,'upper_piece','shirt',provider=provider)
        self.assertEqual('READY',result.status,result.reason)
        evidence=result.metrics['preflight']['automaticEvidence']
        self.assertEqual(AUTOMATIC_POLICY_VERSION,evidence['version']);self.assertGreater(evidence['maskIoU'],.99)
        self.assertAlmostEqual(.99,evidence['targetSoftmaxP10'],places=5)
        out=np.array(Image.open(io.BytesIO(result.whole)))
        visible=out[out[:,:,3]>250]
        self.assertTrue((visible[:,2]>240).all());self.assertTrue((visible[:,0]<10).all())
        self.assertEqual(0,out[0,0,3]);self.assertTrue(result.metrics['whole']['alpha'])
        self.assertEqual('transparent',result.metrics['whole']['background'])
        box=result.metrics['whole']['box'];self.assertAlmostEqual(.5,max(box['w'],box['h']),places=3)

    def test_white_original_logo_stays_opaque_inside_transparent_whole(self):
        image,provider,_=scene(logo=True)
        result=process_photo(image,'upper_piece','shirt',provider=provider)
        self.assertEqual('READY',result.status,result.reason)
        out=np.array(Image.open(io.BytesIO(result.whole)))
        white=(out[:,:,0]>250)&(out[:,:,1]>250)&(out[:,:,2]>250)&(out[:,:,3]==255)
        self.assertGreater(int(white.sum()),1000)
        self.assertEqual(0,int(out[0,0,3]))

    def test_automatic_sub25_stops_before_cleanup_render_or_output(self):
        image,provider,_=scene(40)
        with patch('scripts.catalog.photo_set.clean_target_mask') as cleanup,patch('scripts.catalog.photo_set._render_whole') as render:
            result=process_photo(image,'upper_piece','shirt',provider=provider)
        self.assertEqual('INELIGIBLE',result.status);self.assertEqual(.2,result.metrics['sourceGarmentHeightFraction'])
        self.assertEqual([.19,.21],result.metrics['preflight']['automaticEvidence']['sourceHeightFractionBounds'])
        cleanup.assert_not_called();render.assert_not_called();self.assertIsNone(result.whole)

    def test_uncertain_threshold_and_model_disagreement_do_not_exclude(self):
        image,provider,_=scene(49)
        self.assertEqual('SOURCE_HEIGHT_NEAR_THRESHOLD',process_photo(image,'upper_piece','shirt',provider=provider).reason)
        image,provider,_=scene(40)
        bad=Image.new('L',image.size);ImageDraw.Draw(bad).rectangle((20,55,130,105),fill=255)
        provider.segmenter.mask.return_value=bad
        result=process_photo(image,'upper_piece','shirt',provider=provider)
        self.assertEqual(('REVIEW','SEMANTIC_MODEL_DISAGREEMENT'),(result.status,result.reason))
        self.assertFalse(result.metrics['preflight']['measurementReliable'])

    def test_missing_real_weights_and_malformed_probabilities_never_invent_confidence(self):
        image,provider,_=scene(40)
        result=process_photo(image,'upper_piece','shirt',provider=AutomaticClothProvider(weights='/missing-model'))
        self.assertEqual('RETRY',result.status);self.assertIsNone(result.metrics['sourceGarmentHeightFraction'])
        provider.parser.probabilities.return_value=np.zeros((18,200,160),dtype=np.float32)
        self.assertEqual('PARSER_INVALID_PROBABILITIES',process_photo(image,'upper_piece','shirt',provider=provider).reason)

    def test_offline_runner_requires_every_candidate_and_worker_migrates_opaque_v2(self):
        image,provider,_=scene(40)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);image.save(root/'small.png')
            manifest=root/'input.json';manifest.write_text(json.dumps({'products':[
                {'id':'all-small','category':'upper_piece','subcategory':'shirt','images':[{'path':'small.png'}]},
                {'id':'unknown-alternative','category':'upper_piece','subcategory':'shirt','images':[{'path':'small.png'},{'path':'missing.png'}]}
            ]}))
            summary=run(manifest,root/'out',provider)
            self.assertEqual(['all-small'],summary['productsConfirmedBelow25Percent'])
            self.assertEqual({'INELIGIBLE':2,'RETRY':1},summary['statuses'])
            self.assertFalse(list((root/'out').glob('*.png')))
            row=json.loads((root/'out'/'snapshot.json').read_text())['products'][0]['images'][0]
            record={**row,'category':'upper_piece','subcategory':'shirt','color':None}
            self.assertTrue(current(record,require_automatic_policy=True))
            row['assets_json']['photoSet'].pop('isolationPolicyVersion')
            self.assertFalse(current(record,require_automatic_policy=True))

    def test_variant_identity_and_effective_color_bind_the_photo_evidence(self):
        image,provider,_=scene()
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'source.png';image.save(path)
            downloader=Mock();downloader.get.return_value=path
            record=dict(id='image-red',image_url='https://brand.example/red',source_sha256=None,
                        category='upper_piece',subcategory='shirt',color='red',variant_id='red-variant',
                        matched_variant_id='red-variant',source_domain='brand.example',
                        persistence_sources=[dict(domain='brand.example',active=True,allows_image_persistence=True)])
            state=build_set(record,downloader,provider)
            self.assertEqual('READY',state['status'])
            self.assertEqual(('image-red','red-variant','red'),(state['imageId'],state['variantId'],state['color']))
            saved={**record,'source_sha256':state['sourceSha256'],'assets_json':{'photoSet':state}}
            self.assertTrue(current(saved,require_automatic_policy=True))
            self.assertFalse(current({**saved,'id':'other-image'}))
            self.assertFalse(current({**saved,'color':'blue'}))
            self.assertFalse(current({**saved,'variant_id':'blue-variant','matched_variant_id':'blue-variant'}))
            state.pop('variantId')
            self.assertFalse(current(saved))

    def test_orphan_or_wrong_product_variant_stops_before_source_or_model(self):
        for matched in (None,'other-variant'):
            with self.subTest(matched=matched):
                record=dict(id='i',image_url='https://brand.example/a',category='upper_piece',
                            subcategory='shirt',color='blue',variant_id='orphan',matched_variant_id=matched)
                downloader=Mock();provider=Mock();storage=Mock()
                state=build_set(record,downloader,provider,storage)
                self.assertEqual(('REVIEW','IMAGE_VARIANT_CONTEXT_INVALID'),(state['status'],state['reason']))
                downloader.get.assert_not_called();provider.masks.assert_not_called();storage.client.put_object.assert_not_called()

if __name__=='__main__':unittest.main()
