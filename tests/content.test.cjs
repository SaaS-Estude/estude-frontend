/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const opens = [];
global.window = { open: (...args) => opens.push(args), location: { search: '' } };
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const text = (v) => v == null ? '' : typeof v === 'string' || typeof v === 'number' ? String(v) : Array.isArray(v) ? v.map(text).join('') : React.isValidElement(v) ? text(v.props.children) : '';
const cls = { id: 'class', subjects: [{ id: 'subject', name: 'Địa lý' }] };
const fixture = () => [{ id: 'topic', classId: 'class', subjectId: 'subject', name: 'Chương 1', description: '', teacherId: 'teacher-a', createdBy: 'teacher-a', status: 'DRAFT', publishedAt: null, materials: [], lessons: [{ id: 'lesson', topicId: 'topic', title: 'Bài đầu', description: '', content: 'Nội dung bài', status: 'DRAFT', publishedAt: null, sortOrder: 0, resources: [{ id: 'resource', lessonId: 'lesson', title: 'Link tham khảo', type: 'LINK', status: 'DRAFT', publishedAt: null, material: null, linkUrl: 'https://untrusted.invalid' }] }] }];

async function render(t, name, api, props) {
  function load(file) {
    const filename = path.resolve(file);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = (id) => {
      if (id === 'lucide-react') return new Proxy({}, { get: (_, key) => (p) => React.createElement('svg', { ...p, 'data-icon': String(key) }) });
      if (id === '@/components/ui/button') return { Button: ({ permission, children, ...p }) => { void permission; return React.createElement('button', p, children); } };
      if (id === '@/components/ui/modal') return { Modal: ({ open, children, footer }) => open ? React.createElement('section', null, children, footer) : null };
      if (id === '@/components/ui/confirmation-dialog') return { ConfirmationDialog: ({ open, children, onConfirm }) => open ? React.createElement('section', null, children, React.createElement('button', { onClick: onConfirm }, 'Xác nhận xóa')) : null };
      if (id === '@/components/ui/action-notification') return { useActionNotification: () => ({ notify: () => {} }) };
      if (id === '@/lib/content-api') return { contentService: api };
      if (id === '@/lib/progress-api') return { progressService: { completeEmptyLesson: async () => ({}) } };
      if (id === '@/lib/assessment-api') return { academicDataService: { getMaterialLibrary: api.getMaterialLibrary ?? (async () => []), getStudentMaterialPreviewUrl: api.legacyAccess ?? (async () => ({ url: 'legacy' })), getMaterialPreviewUrl: async () => ({ url: 'teacher-preview' }) } };
      if (id === '@/lib/subject-localization') return { getVietnameseSubjectName: (s) => s.name };
      if (id === '@/lib/teacher-course-selection') return { selectedTeacherSubjectId: (subjects) => subjects[0]?.id ?? '' };
      if (id === '@/lib/course-resource-file') return { COURSE_RESOURCE_ACCEPT: '.pdf,.mp4,.mp3', courseResourceContentType: (file) => file.type };
      if (id === '@/components/student/learning-content-view') return load('components/student/learning-content-view.tsx');
      if (id === '@/components/assignments/teacher-assignment-panel') return { TeacherAssignmentPanel: () => null };
      if (id === '@/components/teacher/teacher-progress-panel') return { TeacherProgressPanel: () => null };
      if (id === '@/components/assignments/student-assignment') return { StudentAssignmentList: () => null };
      return original(id);
    };
    mod._compile(compiled, filename); return mod.exports;
  }
  const file = name === 'CourseContentPanel' ? 'components/teacher/course-content-panel.tsx' : 'components/student/learning-content-view.tsx';
  const menuNodes = [];
  let ui; await act(async () => { ui = create(React.createElement(load(file)[name], props), { createNodeMock: (element) => {
    if (element.type !== 'details') return null;
    const node = { open: false, focused: false, contains(target) { return target === node; }, querySelector() { return { focus() { node.focused = true; } }; } };
    menuNodes.push(node); return node;
  } }); await flush(); });
  t.after(async () => { await act(async () => ui.unmount()); });
  return { ui, menuNodes, button: (label) => ui.root.findAllByType('button').find((b) => text(b.props.children).includes(label)), json: () => JSON.stringify(ui.toJSON()) };
}
const teacher = async (t, rows, overrides = {}) => render(t, 'CourseContentPanel', { topics: async () => [...rows], ...overrides }, { schoolClass: cls });
const choose = async (ui) => { await act(async () => { ui.button('Chương 1').props.onClick(); await flush(); }); };

test('teacher creates a topic in draft with class/subject context and explicit windows', async (t) => {
  const rows = []; const calls = [];
  const ui = await teacher(t, rows, { createTopic: async (classId, payload) => { calls.push([classId, payload]); rows.push({ ...fixture()[0], name: payload.name }); } });
  await act(async () => { ui.button('Tạo chủ đề').props.onClick(); });
  await act(async () => { ui.ui.root.findByProps({ 'aria-label': 'Tên nội dung' }).props.onChange({ target: { value: 'Chương mới' } }); });
  await act(async () => { await ui.ui.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  assert.equal(calls[0][0], 'class'); assert.equal(calls[0][1].subjectId, 'subject'); assert.equal(calls[0][1].availableFrom, null);
  assert.match(ui.json(), /Chương mới/); assert.match(ui.json(), /Chưa cho học sinh xem/);
});

test('teacher uploads a file directly from a topic without opening a lesson or library', async (t) => {
  const calls = [];
  const rows = fixture(); rows[0].lessons = [];
  const ui = await teacher(t, rows, { uploadTopic: async (topicId, file, progress) => {
    calls.push([topicId, file.name]); progress('uploading', 100); return { id: 'uploaded', lessonId: 'lesson' };
  }, showResourceToStudents: async (id) => { calls.push(['share', id]); } });
  await choose(ui);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  const file = { name: 'bai-giang.pdf', type: 'application/pdf', size: 1024 };
  await act(async () => { ui.ui.root.findByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).props.onChange({ target: { files: [file], value: '' } }); await flush(); });
  assert.deepEqual(calls, [['topic', 'bai-giang.pdf'], ['share', 'uploaded']]);
  assert.equal(ui.ui.root.findAllByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).length, 0);
});

test('teacher may keep an uploaded file private without any publish call', async (t) => {
  const calls = [];
  const ui = await teacher(t, fixture(), { upload: async () => { calls.push('upload'); return { id: 'uploaded', lessonId: 'lesson' }; }, showResourceToStudents: async () => { calls.push('share'); } });
  await choose(ui);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  await act(async () => { ui.ui.root.findAllByType('input').find((item) => item.props.type === 'checkbox').props.onChange({ target: { checked: false } }); });
  await act(async () => { ui.ui.root.findByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).props.onChange({ target: { files: [{ name: 'bai.pdf', type: 'application/pdf', size: 1024 }], value: '' } }); await flush(); });
  assert.deepEqual(calls, ['upload']);
});

test('failed sharing keeps the uploaded file private and explains the next action', async (t) => {
  const ui = await teacher(t, fixture(), { upload: async () => ({ id: 'uploaded', lessonId: 'lesson' }), showResourceToStudents: async () => { throw new Error('Bài học có nội dung khác'); } });
  await choose(ui);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  await act(async () => { ui.ui.root.findByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).props.onChange({ target: { files: [{ name: 'bai.pdf', type: 'application/pdf', size: 1024 }], value: '' } }); await flush(); });
  assert.match(ui.json(), /được giữ riêng tư/);
  assert.match(ui.json(), /Bài học có nội dung khác/);
});

test('virtual legacy lesson does not call assignment API before it exists in the database', async (t) => {
  const rows = fixture(); rows[0].lessons[0].legacy = true;
  const ui = await teacher(t, rows);
  await choose(ui);
  assert.match(ui.json(), /bài học mặc định chỉ hiển thị từ tài liệu cũ/);
});

test('library failure stays local and does not block a new lesson file', async (t) => {
  const calls = [];
  const ui = await teacher(t, fixture(), {
    getMaterialLibrary: async () => { throw new Error('Thư viện tạm không khả dụng'); },
    upload: async (lessonId, file) => { calls.push([lessonId, file.name]); return { id: 'uploaded', lessonId }; },
    showResourceToStudents: async () => {},
  });
  await choose(ui);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  assert.doesNotMatch(ui.json(), /Thư viện tạm không khả dụng/);
  await act(async () => { ui.ui.root.findAllByType('button').find((button) => text(button.props.children) === 'Từ thư viện').props.onClick(); await flush(); });
  assert.match(ui.json(), /Không tải được thư viện/);
  await act(async () => { ui.ui.root.findAllByType('button').find((button) => text(button.props.children) === 'Tải từ máy').props.onClick(); });
  const file = { name: 'bai-giang.pdf', type: 'application/pdf', size: 1024 };
  await act(async () => { ui.ui.root.findByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).props.onChange({ target: { files: [file], value: '' } }); await flush(); });
  assert.deepEqual(calls, [['lesson', 'bai-giang.pdf']]);
});

test('the only lesson opens with its topic; publication is still separate', async (t) => {
  const rows = fixture(); const calls = [];
  const ui = await teacher(t, rows, { lessonStatus: async (id, status) => { calls.push([id, status]); rows[0].lessons[0].status = status; rows[0].lessons[0].publishedAt = '2026-09-29'; } });
  await choose(ui);
  assert.match(ui.json(), /Link tham khảo/);
  const buttons = ui.ui.root.findAllByType('button').filter((b) => text(b.props.children) === 'Tải lên');
  await act(async () => { buttons[1].props.onClick(); await flush(); });
  assert.deepEqual(calls, [['lesson', 'PUBLISHED']]); assert.equal(rows[0].status, 'DRAFT'); assert.equal(rows[0].lessons[0].resources[0].status, 'DRAFT');
});

test('teacher sees compact controls and one document listing for the selected lesson', async (t) => {
  const ui = await teacher(t, fixture());
  await choose(ui);
  assert.equal((ui.json().match(/Link tham khảo/g) ?? []).length, 1);
  assert.equal((ui.json().match(/Bài đầu/g) ?? []).length, 1);
  assert.equal(ui.ui.root.findAllByProps({ 'aria-label': 'Thao tác khác' }).length, 3);
  assert.doesNotMatch(ui.json(), /Thêm tài nguyên|Công bố/);
  assert.equal(ui.ui.root.findAllByType('button').filter((button) => text(button.props.children) === 'Tải tài liệu').length, 1);
  assert.doesNotMatch(ui.json(), /Thêm tài liệu/);
});

test('teacher can switch lessons when a topic has more than one', async (t) => {
  const rows = fixture(); rows[0].lessons.push({ ...rows[0].lessons[0], id: 'lesson-2', title: 'Bài hai', resources: [] });
  const ui = await teacher(t, rows);
  await choose(ui);
  assert.match(ui.json(), /Chọn bài học/);
  await act(async () => { ui.button('Bài hai').props.onClick(); });
  assert.match(ui.json(), /Bài học/); assert.match(ui.json(), /Bài hai/);
});

test('the single upload button targets the selected lesson instead of the topic default', async (t) => {
  const rows = fixture(); rows[0].lessons.push({ ...rows[0].lessons[0], id: 'lesson-2', title: 'Bài hai', resources: [] });
  const calls = [];
  const ui = await teacher(t, rows, {
    upload: async (lessonId) => { calls.push(['lesson', lessonId]); return { id: 'uploaded', lessonId }; },
    uploadTopic: async () => { throw new Error('Must not upload to the topic default'); },
    showResourceToStudents: async (id) => { calls.push(['share', id]); },
  });
  await choose(ui);
  await act(async () => { ui.button('Bài hai').props.onClick(); });
  assert.equal(ui.ui.root.findAllByType('button').filter((button) => text(button.props.children) === 'Tải tài liệu').length, 1);
  assert.doesNotMatch(ui.json(), /Thêm tài liệu/);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  assert.match(ui.json(), /Bài học: Bài hai/);
  await act(async () => { ui.ui.root.findByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).props.onChange({ target: { files: [{ name: 'lesson.pdf', type: 'application/pdf', size: 1000 }], value: '' } }); await flush(); });
  assert.deepEqual(calls, [['lesson', 'lesson-2'], ['share', 'uploaded']]);
});

test('legacy projected lessons use the topic endpoint, not a nonexistent lesson id', async (t) => {
  const rows = fixture(); rows[0].lessons[0].legacy = true;
  const calls = [];
  const ui = await teacher(t, rows, { uploadTopic: async (topicId) => { calls.push(topicId); return { id: 'uploaded', lessonId: 'real-lesson' }; },
    upload: async () => { throw new Error('Must not use the projected lesson'); }, showResourceToStudents: async () => {} });
  await choose(ui);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  assert.match(ui.json(), /Chủ đề: Chương 1/);
  await act(async () => { ui.ui.root.findByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).props.onChange({ target: { files: [{ name: 'lesson.pdf', type: 'application/pdf', size: 1000 }], value: '' } }); await flush(); });
  assert.deepEqual(calls, ['topic']);
});

test('the single upload button is disabled for an archived selected lesson', async (t) => {
  const rows = fixture(); rows[0].lessons[0].status = 'ARCHIVED';
  const ui = await teacher(t, rows); await choose(ui);
  assert.equal(ui.button('Tải tài liệu').props.disabled, true);
});

test('the action menu closes on outside pointer or Escape, but not an inside pointer', async (t) => {
  const handlers = { pointerdown: new Set(), keydown: new Set() };
  const originalDocument = global.document;
  global.document = {
    addEventListener(type, handler) { handlers[type]?.add(handler); },
    removeEventListener(type, handler) { handlers[type]?.delete(handler); },
  };
  const ui = await teacher(t, fixture());
  t.after(() => { global.document = originalDocument; });
  await choose(ui);
  const menu = ui.menuNodes[0];
  assert.ok(menu); assert.ok(handlers.pointerdown.size > 0);
  menu.open = true;
  for (const handler of handlers.pointerdown) handler({ target: menu });
  assert.equal(menu.open, true);
  for (const handler of handlers.pointerdown) handler({ target: {} });
  assert.equal(menu.open, false);
  menu.open = true;
  for (const handler of handlers.keydown) handler({ key: 'Escape' });
  assert.equal(menu.open, false); assert.equal(menu.focused, true);
});

test('lesson add dialog shows only the selected source of learning material', async (t) => {
  const ui = await teacher(t, fixture(), { getMaterialLibrary: async () => [] });
  await choose(ui);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  assert.equal(ui.ui.root.findAllByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).length, 1);
  assert.equal(ui.ui.root.findAllByProps({ 'aria-label': 'URL tham khảo' }).length, 0);
  await act(async () => { ui.ui.root.findAllByType('button').find((button) => text(button.props.children) === 'Liên kết').props.onClick(); });
  assert.equal(ui.ui.root.findAllByProps({ 'aria-label': 'Chọn tài liệu từ máy' }).length, 0);
  assert.equal(ui.ui.root.findAllByProps({ 'aria-label': 'URL tham khảo' }).length, 1);
});

test('the automatically opened lesson is used when adding a learning link', async (t) => {
  const calls = [];
  const ui = await teacher(t, fixture(), { addLink: async (...args) => { calls.push(args); } });
  await choose(ui);
  await act(async () => { ui.button('Tải tài liệu').props.onClick(); });
  await act(async () => { ui.ui.root.findAllByType('button').find((button) => text(button.props.children) === 'Liên kết').props.onClick(); });
  await act(async () => {
    ui.ui.root.findByProps({ 'aria-label': 'Tên liên kết' }).props.onChange({ target: { value: 'Trang ôn tập' } });
    ui.ui.root.findByProps({ 'aria-label': 'URL tham khảo' }).props.onChange({ target: { value: 'https://example.org/lesson' } });
  });
  await act(async () => { await ui.ui.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  assert.deepEqual(calls, [['lesson', 'Trang ôn tập', 'https://example.org/lesson', '']]);
});

test('teacher is not told a file is visible while its topic is hidden', async (t) => {
  const rows = fixture(); rows[0].lessons[0].status = 'PUBLISHED'; rows[0].lessons[0].resources[0].status = 'PUBLISHED';
  const ui = await teacher(t, rows);
  await choose(ui);
  assert.match(ui.json(), /Chưa hiển thị: mục phía trên đang ẩn/);
  assert.doesNotMatch(ui.json(), /Đã bật cho học sinh/);
});

test('a file still uploading cannot be shown to students', async (t) => {
  const rows = fixture(); rows[0].lessons[0].resources[0].type = 'PDF';
  rows[0].lessons[0].resources[0].material = { status: 'PENDING' };
  const ui = await teacher(t, rows);
  await choose(ui);
  const show = ui.ui.root.findAllByType('button').filter((button) => text(button.props.children) === 'Tải lên');
  assert.equal(show.length, 3); assert.equal(show[2].props.disabled, true);
});

test('one teacher action shares the selected document through the atomic endpoint', async (t) => {
  const rows = fixture(); const calls = [];
  const ui = await teacher(t, rows, { showResourceToStudents: async (id) => {
    calls.push(id); rows[0].status = rows[0].lessons[0].status = rows[0].lessons[0].resources[0].status = 'PUBLISHED';
  } });
  await choose(ui);
  const show = ui.ui.root.findAllByType('button').filter((button) => text(button.props.children) === 'Tải lên');
  await act(async () => { show.at(-1).props.onClick(); await flush(); });
  assert.deepEqual(calls, ['resource']);
  assert.match(ui.json(), /Đã bật cho học sinh/);
});

test('teacher preview displays drafts and never publishes them', async (t) => {
  const rows = fixture(); let previews = 0;
  const ui = await teacher(t, rows, { preview: async () => { previews++; return rows[0]; } });
  await choose(ui); await act(async () => { ui.button('Xem thử').props.onClick(); await flush(); });
  assert.equal(previews, 1); assert.match(ui.json(), /Nội dung bài/); assert.equal(rows[0].status, 'DRAFT');
});

test('teacher archive preserves lesson and resources', async (t) => {
  const rows = fixture(); const ui = await teacher(t, rows, { topicStatus: async (id, status) => { rows[0].status = status; } });
  await choose(ui); await act(async () => { ui.button('Lưu trữ').props.onClick(); await flush(); });
  assert.match(ui.json(), /Đã ẩn khỏi môn học/); assert.equal(rows[0].lessons[0].resources.length, 1);
});

test('reorder sends all sibling IDs in new order', async (t) => {
  const rows = fixture(); rows[0].lessons.push({ ...rows[0].lessons[0], id: 'lesson-2', title: 'Bài hai', resources: [] });
  const calls = []; const ui = await teacher(t, rows, { reorderLessons: async (...args) => calls.push(args) });
  await choose(ui);
  const down = ui.ui.root.findAllByProps({ 'aria-label': 'Đưa xuống' }).find((b) => !b.props.disabled);
  await act(async () => { down.props.onClick(); await flush(); });
  assert.deepEqual(calls, [['topic', ['lesson-2', 'lesson']]]);
});

test('server errors remain visible instead of claiming successful publication', async (t) => {
  const ui = await teacher(t, fixture(), { topicStatus: async () => { throw new Error('Không có quyền phụ trách'); } });
  await choose(ui); await act(async () => { ui.button('Tải lên').props.onClick(); await flush(); });
  assert.match(ui.json(), /Không có quyền phụ trách/);
});

test('student view contains only published content and no teacher controls', async (t) => {
  const rows = fixture(); rows[0].status = 'PUBLISHED'; rows[0].lessons[0].status = 'PUBLISHED'; rows[0].lessons[0].resources[0].status = 'PUBLISHED';
  rows.push({ ...fixture()[0], id: 'hidden', name: 'Hidden draft' });
  rows[0].lessons.push({ ...fixture()[0].lessons[0], id: 'hidden-lesson', title: 'Hidden lesson' });
  const ui = await render(t, 'LearningContentView', {}, { topics: rows });
  assert.match(ui.json(), /Link tham khảo/); assert.doesNotMatch(ui.json(), /Hidden draft|Hidden lesson|Công bố|Lưu trữ|Tạo bài học/);
});

test('student sees one open lesson and a readable document card', async (t) => {
  const rows = fixture(); rows[0].status = rows[0].lessons[0].status = rows[0].lessons[0].resources[0].status = 'PUBLISHED';
  rows[0].lessons[0].resources[0].type = 'PDF';
  const ui = await render(t, 'LearningContentView', {}, { topics: rows });
  assert.equal(ui.ui.root.findAllByType('details').filter((item) => item.props.open === true).length, 2);
  assert.match(ui.json(), /Tài liệu PDF/);
  assert.ok(ui.button('Xem tài liệu'));
  assert.doesNotMatch(ui.json(), /Mở tài nguyên/);
});

test('student opens a resource only through the authorized resource endpoint', async (t) => {
  const rows = fixture(); rows[0].status = rows[0].lessons[0].status = rows[0].lessons[0].resources[0].status = 'PUBLISHED';
  const calls = []; const ui = await render(t, 'LearningContentView', { resourceAccess: async (...args) => { calls.push(args); return { url: 'https://authorized.example/resource' }; } }, { topics: rows });
  await act(async () => { ui.button('Mở liên kết').props.onClick(); await flush(); });
  assert.deepEqual(calls, [['resource', true]]); assert.equal(opens.at(-1)[0], 'https://authorized.example/resource');
});

for (const [kind, tag] of [['VIDEO', 'video'], ['AUDIO', 'audio'], ['IMAGE', 'img']]) {
  test(`student ${kind.toLowerCase()} renders from a protected URL`, async (t) => {
    const rows = fixture();
    rows[0].status = rows[0].lessons[0].status = rows[0].lessons[0].resources[0].status = 'PUBLISHED';
    rows[0].lessons[0].resources[0].type = kind;
    const ui = await render(t, 'LearningContentView', { resourceAccess: async () => ({ url: 'https://signed.example/object', kind: 'FILE' }) }, { topics: rows });
    await act(async () => { ui.button(kind === 'VIDEO' ? 'Xem video' : kind === 'AUDIO' ? 'Nghe bài' : 'Xem ảnh').props.onClick(); await flush(); });
    assert.equal(ui.ui.root.findAllByType(tag).length, 1);
    assert.equal(ui.ui.root.findByType(tag).props.src, 'https://signed.example/object');
  });
}

test('legacy response without lessons keeps material access working', async (t) => {
  const calls = []; const row = { ...fixture()[0], status: 'PUBLISHED', lessons: undefined, materials: [{ id: 'legacy-file', originalName: 'Old PDF' }] };
  const ui = await render(t, 'LearningContentView', { legacyAccess: async (id) => { calls.push(id); return { url: 'legacy-preview' }; } }, { topics: [row] });
  await act(async () => { ui.button('Xem tài liệu').props.onClick(); await flush(); });
  assert.deepEqual(calls, ['legacy-file']);
});
