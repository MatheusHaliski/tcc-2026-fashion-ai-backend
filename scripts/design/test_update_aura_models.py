import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('models',Path(__file__).with_name('update_aura_models.py'))
models=importlib.util.module_from_spec(spec);spec.loader.exec_module(models)
class CurationTest(unittest.TestCase):
    def page(self,title='File:Abstract silk texture.png',license='CC0',mime='image/png'):
        return dict(title=title,imageinfo=[dict(mime=mime,extmetadata={'LicenseShortName':{'value':license}})])
    def test_free_abstract_raster(self):self.assertTrue(models.eligible(self.page()))
    def test_rejects_unknown_rights_and_logos(self):
        for p in [self.page(license='Copyright'),self.page(title='File:Abstract football logo.png'),self.page(mime='image/svg+xml'),self.page(title='File:Portrait.png')]:self.assertFalse(models.eligible(p))
if __name__=='__main__':unittest.main()
