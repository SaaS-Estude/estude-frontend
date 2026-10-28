const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const types = fs.readFileSync('types/assessment.ts', 'utf8');
const details = fs.readFileSync('components/assessment/study-analysis-details.tsx', 'utf8');
const backendPath = ['../estude-backend', '../estude-saas-backend']
  .map(root => `${root}/internal/modules/learning/exam_study.go`)
  .find(file => fs.existsSync(file));
assert.ok(backendPath, 'backend learning source not found beside the frontend');
const backend = fs.readFileSync(backendPath, 'utf8');

function unionMembers(source, name) {
  const block = source.match(new RegExp(`export type ${name} =([^;]+);`));
  assert.ok(block, `${name} not found`);
  return [...block[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
}

function metaKeys(source) {
  const block = source.match(/export const sourceMeta[\s\S]*?\n};/);
  assert.ok(block, 'sourceMeta not found');
  return [...block[0].matchAll(/^  ([A-Z_]+): \{/gm)].map((m) => m[1]);
}

test('every source type has a label, so the analysis page can never render an undefined badge', () => {
  const declared = unionMembers(types, 'StudySourceType');
  assert.deepEqual([...declared].sort(), [...metaKeys(details)].sort());
});

test('the exam-only source types the backend emits are known to the frontend', () => {
  const emitted = [...backend.matchAll(/source\w+\s*=\s*"([A-Z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(emitted.sort(), ['EXAM_MISTAKE', 'EXAM_REVIEW']);
  const declared = unionMembers(types, 'StudySourceType');
  for (const type of emitted) assert.ok(declared.includes(type), `${type} missing from StudySourceType`);
});

test('the exam-only scope is part of the report type and is warned about to the student', () => {
  assert.match(types, /analysisScope\?: "MATERIAL_GROUNDED" \| "ASSESSMENT_ONLY" \| "EXAM_GROUNDED"/);
  const page = fs.readFileSync('components/assessment/study-analysis-page.tsx', 'utf8');
  assert.match(page, /EXAM_GROUNDED/);
  assert.match(page, /chưa được kiểm\s+chứng với tài liệu/);
});

test('exam-only reports are not treated as the "no material, no path" mode', () => {
  for (const file of [
    'components/assessment/study-analysis-page.tsx',
    'components/assessment/study-analysis-details.tsx',
    'components/assessment/student-exam-pages.tsx',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    for (const m of source.matchAll(/assessmentOnly\s*=\s*([^;]+);/g)) {
      assert.ok(!m[1].includes('EXAM_GROUNDED'), `${file} hides the learning path for EXAM_GROUNDED`);
    }
  }
});
