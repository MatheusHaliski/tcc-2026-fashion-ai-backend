import asyncio
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock,patch
import numpy as np
from PIL import Image,ImageDraw
from scripts.catalog.photo_set import PHOTO_SET_VERSION,PhotoMasks,process_photo,clean_target_mask
from scripts.catalog.default_assets import render_default,default_asset_url,MANIFEST
from scripts.catalog.ingest_image_dataset import ProductImage,ImageDatasetPipeline,GarmentSanitizer,safe_url,ImageFailure,PublicResolver,AsyncDownloader
from scripts.catalog.process_photo_sets import current
from scripts.catalog.quarantine_unsafe_products import eligible

def picture(color='blue',size=(400,400)):
    image=Image.new('RGB',size,'white');ImageDraw.Draw(image).rectangle((100,60,300,340),fill=color);b=io.BytesIO();image.save(b,'PNG');return b.getvalue()
class Provider:
    def masks(self,image,category,subcategory):
        mask=Image.new('L',image.size);ImageDraw.Draw(mask).rectangle((100,60,300,340),fill=255)
        return PhotoMasks(mask,Image.new('L',image.size),verified=True,target_category=category,target_subcategory=subcategory,source='synthetic-fixture',human_present=False,measurement_verified=True,isolation_verified=True,complete=True,occluded=False)
class Downloader:
    def __init__(self,rows):self.rows=rows
    async def get(self,url):return self.rows[url]
class PhotoPipelineTests(unittest.TestCase):
    def test_semantic_mask_removes_human_other_garment_and_exterior_scratches(self):
        image=Image.new('RGB',(400,500),'white');d=ImageDraw.Draw(image);d.rectangle((100,100,300,350),fill='blue');d.rectangle((100,350,300,450),fill='green');d.rectangle((150,20,250,100),fill='pink');d.line((100,100,350,30),fill='black',width=1)
        target=Image.new('L',image.size);t=ImageDraw.Draw(target);t.rectangle((100,100,300,350),fill=255);t.line((100,100,350,30),fill=255,width=1)
        forbidden=Image.new('L',image.size);f=ImageDraw.Draw(forbidden);f.rectangle((100,350,300,450),fill=255);f.rectangle((150,20,250,100),fill=255);f.line((101,99,350,30),fill=255,width=1)
        out=process_photo(image,'upper_piece','shirt',masks=PhotoMasks(target,forbidden,verified=True,target_category='upper_piece',target_subcategory='shirt',human_present=True,measurement_verified=True,isolation_verified=True,complete=True,occluded=False,source='synthetic'))
        self.assertEqual('READY',out.status);whole=Image.open(io.BytesIO(out.whole));fabric=Image.open(io.BytesIO(out.fabric));self.assertEqual((900,1200),whole.size)
        pixels=np.asarray(fabric);self.assertTrue((pixels[:,:,2]>200).all());self.assertTrue((pixels[:,:,1]<30).all());self.assertGreater(out.metrics['removedPixels'],0)
    def test_two_separate_legs_survive_and_unknown_masks_fail_closed(self):
        mask=Image.new('L',(400,400));d=ImageDraw.Draw(mask);d.rectangle((80,80,160,340),fill=255);d.rectangle((240,80,320,340),fill=255)
        _,info=clean_target_mask(mask,None,'lower_piece','shorts');self.assertEqual(2,info['retainedParts'])
        image=Image.new('RGB',mask.size,'blue');self.assertEqual('REVIEW',process_photo(image,'lower_piece','shorts',masks=PhotoMasks(mask)).status)
    def test_default_variants_preserve_badge_alpha_and_fill_fabric(self):
        image=Image.new('RGBA',(200,300));d=ImageDraw.Draw(image);d.rectangle((40,30,160,270),fill=(30,90,180,255));d.rectangle((120,90,145,115),fill=(240,100,20,255))
        red=render_default(image,'red','FABRIC');blue=render_default(image,'blue','FABRIC')
        self.assertEqual((480,640),red.size);self.assertGreater(np.asarray(red)[:,:,0].mean(),np.asarray(red)[:,:,2].mean());self.assertGreater(np.asarray(blue)[:,:,2].mean(),np.asarray(blue)[:,:,0].mean())
        whole=render_default(image,'red');a=np.asarray(whole);self.assertTrue(((a[:,:,0]>225)&(a[:,:,1]>80)&(a[:,:,1]<120)&(a[:,:,2]<30)).any())
        self.assertIn('color=%23dfcdb0',default_asset_url('lower_piece','bermuda_shorts','beige'));self.assertGreater(len(MANIFEST['colors']),40)
    def test_legacy_or_model_failure_is_never_quarantine_evidence(self):
        product=dict(category='upper_piece',subcategory='shirt',color='blue',ingestion_status='VALIDATED')
        for reason in ('NO_SAFE_FABRIC_RECTANGLE','SEGMENTATION_UNAVAILABLE','TARGET_MASK_EMPTY','AMBIGUOUS_TARGET_COMPONENTS'):
            image=dict(image_url='https://brand.example/a',source_sha256='a'*64,assets_json={'photoSet':dict(version=PHOTO_SET_VERSION,category='upper_piece',subcategory='shirt',color='blue',sourceUrl='https://brand.example/a',sourceSha256='a'*64,status='DEFAULT',reason=reason)})
            self.assertTrue(current({**image,**product}));self.assertFalse(eligible(product,[image]))
    def test_public_urls_reject_metadata_and_credentials(self):
        for u in ['http://127.0.0.1/x','https://169.254.169.254/x','https://user:secret@brand.example/x','file:///tmp/a']:
            with self.assertRaises(ImageFailure):safe_url(u)

class AsyncPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_corrupt_small_and_duplicate_do_not_interrupt_valid_color_variants(self):
        rows={'https://b.example/blue':picture(),'https://b.example/duplicate':picture(),'https://b.example/red':picture('red'),'https://b.example/corrupt':b'not an image','https://b.example/small':picture(size=(299,400))}
        items=[ProductImage(str(i),'Brand','upper_piece','shirt',url) for i,url in enumerate(rows)]
        with tempfile.TemporaryDirectory() as tmp:
            result=await ImageDatasetPipeline(tmp,sanitizer=GarmentSanitizer(Provider()),downloader=Downloader(rows)).run(items)
            self.assertEqual(['VALID','DUPLICATE','VALID','REJECTED','REJECTED'],[r['status'] for r in result]);meta=json.loads((Path(tmp)/'metadata_clean.json').read_text());self.assertTrue(meta['complete'])
            for r in result:
                if r['status']=='VALID':
                    with Image.open(Path(tmp)/r['image_path']) as im:self.assertEqual((512,512),im.size);self.assertEqual((255,255,255),im.getpixel((0,0)))
            self.assertNotIn('https://',json.dumps(meta))
    async def test_dns_filters_private_ip_at_connection_time(self):
        with patch.object(asyncio.get_running_loop(),'getaddrinfo',AsyncMock(return_value=[(2,1,6,'',('10.0.0.1',443))])):
            with self.assertRaises(OSError):await PublicResolver().resolve('brand.example',443)
    async def test_head_unsupported_falls_back_to_validated_get(self):
        class Response:
            def __init__(self,status,data=b''):self.status=status;self.headers={};self.content_length=len(data);self.data=data;self.content=self
            async def __aenter__(self):return self
            async def __aexit__(self,*a):pass
            async def iter_chunked(self,n):yield self.data
        class Session:
            def __init__(self):self.methods=[]
            def request(self,method,url,**kwargs):self.methods.append(method);return Response(405 if method=='HEAD' else 200,b'image' if method=='GET' else b'')
        s=Session();self.assertEqual(b'image',await AsyncDownloader(s).get('https://brand.example/a'));self.assertEqual(['HEAD','GET'],s.methods)
if __name__=='__main__':unittest.main()
