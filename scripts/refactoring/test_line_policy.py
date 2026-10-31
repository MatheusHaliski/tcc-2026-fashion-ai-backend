import subprocess
import tempfile
import unittest
from pathlib import Path
from scripts.refactoring.line_policy import report, size_band


class LinePolicyReportTest(unittest.TestCase):
    def test_report_tracks_all_sources_and_preserves_thresholds(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(['git', 'init', '-q', tmp], check=True)
            (root/'small.ts').write_text('export const value = 1;\n')
            (root/'large.py').write_text('# line\n' * 1001)
            (root/'notes.md').write_text('Documentation is inventoried separately.\n')
            subprocess.run(['git', '-C', tmp, 'add', '.'], check=True)
            output = root/'report.csv'
            self.assertEqual(report(root, output), {'CRITICAL': 1, 'WITHIN_GENERAL_TARGET': 1})
            self.assertIn('large.py,1001,CRITICAL', output.read_text())
            self.assertNotIn('notes.md', output.read_text())
            self.assertEqual(size_band(600), 'PRIORITY')
            self.assertEqual(size_band(601), 'HIGH')


if __name__ == '__main__':
    unittest.main()
