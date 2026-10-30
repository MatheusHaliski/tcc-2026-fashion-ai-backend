"""Characterizes audit measurements; never loads application code or uses external services."""
import unittest
from pathlib import Path
from scripts.refactoring.audit_repository import analyse, is_generated, test_path as is_test_path


class AuditMeasurementTest(unittest.TestCase):
    def test_python_uses_ast_instead_of_counting_words_in_comments(self):
        source = '# def fake(): if else\nimport json\nclass Example:\n    def run(self, value):\n        if value:\n            return value\n        return None\n'
        row = analyse(Path('example.py'), source)
        self.assertEqual(row['functions'], 1)
        self.assertEqual(row['classes'], 1)
        self.assertEqual(row['branch_points'], 1)
        self.assertEqual(row['imports'], 1)
        self.assertTrue(row['measurement'].startswith('Python AST'))

    def test_typescript_estimates_are_explicitly_labeled_and_count_definitions_not_hook_calls(self):
        row = analyse(Path('example.tsx'), 'import { useState } from "react";\nexport function View() { const [a] = useState(0); return <p>{a}</p>; }\nexport function useExample() { return 1; }\n')
        self.assertEqual(row['components'], 1)
        self.assertEqual(row['custom_hook_definitions'], 1)
        self.assertEqual(row['measurement'], 'lexical estimate')

    def test_generated_marker_does_not_mistake_jpa_generatedvalue_for_generated_source(self):
        self.assertFalse(is_generated('@GeneratedValue(strategy = GenerationType.UUID)'))
        self.assertTrue(is_generated('// @generated\n// DO NOT EDIT'))

    def test_test_classification_understands_repository_conventions(self):
        for path in ['components/view.test.tsx', 'scripts/catalog/tests/test_case.py', 'fai-web/src/test/java/ExampleTest.java']:
            self.assertTrue(is_test_path(path))
        self.assertFalse(is_test_path('components/testimonial.tsx'))
