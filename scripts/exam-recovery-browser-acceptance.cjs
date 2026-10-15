/* eslint-disable @typescript-eslint/no-require-imports */
// Real headless Chrome against the built application, with ALL remote HTTP
// intercepted. No backend, DB, S3, user account or shared browser profile is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.browser-artifacts', 'exam-recovery');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
  const port = server.address().port; server.close(() => resolve(port));
}); });
async function until(work, message, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { const value = await work(); if (value) return value; } catch { /* boot/navigation */ } await sleep(100); }
  throw new Error(`Timeout: ${message}`);
}
class CDP {
  constructor(url) {
    this.seq = 0; this.pending = new Map(); this.events = new Map(); this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }); });
    this.ws.addEventListener('message', ({ data }) => { const message = JSON.parse(data);
      if (message.id) { const item = this.pending.get(message.id); if (!item) return; this.pending.delete(message.id);
        clearTimeout(item.timer); if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
      } else for (const listener of this.events.get(message.method) ?? []) listener(message.params);
    });
  }
  async call(method, params = {}) { await this.ready; return new Promise((resolve, reject) => { const id = ++this.seq;
    const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 15000);
    this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params }));
  }); }
  on(name, handler) { this.events.set(name, [...this.events.get(name) ?? [], handler]); }
  async evaluate(expression) { const result = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
    return result.result.value;
  }
  close() { this.ws.close(); }
}
const ids = { original: 'aaaaaaaaaaaaaaaaaaaaaaaa', makeup: 'bbbbbbbbbbbbbbbbbbbbbbbb', student: 'cccccccccccccccccccccccc',
  teacher: 'dddddddddddddddddddddddd', class: 'eeeeeeeeeeeeeeeeeeeeeeee', subject: 'ffffffffffffffffffffffff',
  oldQuestion: '111111111111111111111111', newQuestion: '222222222222222222222222', attempt: '333333333333333333333333' };
const now = Date.now();
const question = (id, content) => ({ id, questionId: id, content, type: 'SINGLE_CHOICE', difficulty: 'EASY',
  defaultPoints: 10, points: 10, order: 0, disabled: false, subjectId: ids.subject, subjectName: 'Lịch sử', topicId: '', topicName: '',
  options: [{ id: 'a', label: 'A', text: 'Đáp án thứ nhất' }, { id: 'b', label: 'B', text: 'Đáp án thứ hai' }], correctOptionIds: ['a'], explanation: '' });
const original = { id: ids.original, title: 'Lịch sử — bài gốc kiểm thử', classId: ids.class, className: 'Lớp kiểm thử',
  subjectId: ids.subject, subjectName: 'Lịch sử', teacherId: ids.teacher, teacherName: 'Giáo viên kiểm thử', termId: '444444444444444444444444',
  lessonId: null, requiredForCompletion: true, topicName: '', description: 'Dữ liệu mô phỏng, không ghi vào DB', status: 'ENDED',
  published: true, resultStatus: 'UNPUBLISHED', requiresAccessCode: false, totalPoints: 10, questions: [question(ids.oldQuestion, 'Câu hỏi bài gốc')],
  settings: { startsAt: new Date(now - 7200000).toISOString(), endsAt: new Date(now - 3600000).toISOString(), durationMinutes: 30,
    attemptsAllowed: 1, examVersionCount: 1, shuffleQuestions: false, shuffleAnswers: false, showScoreImmediately: false,
    showCorrectAnswers: false, answerReleasePolicy: 'NEVER' }, updatedAt: new Date(now).toISOString(), createdAt: new Date(now - 86400000).toISOString() };
let makeup, attempt, resolutionPayload, makeupPayload, rejectedResolution = false;
const calls = [], unexpected = [], runtimeErrors = [], pages = [];
const permissions = ['exams.read', 'exams.create', 'exams.update', 'exams.publish', 'exams.submissions', 'learning.read',
  'classes.read', 'teaching.read', 'teaching.update', 'calendar.read', 'notifications.read'];
function mockApi(role, route, method, body) {
  const payload = body ? JSON.parse(body) : {};
  calls.push(`${role} ${method} ${route}`);
  if (route.startsWith('/auth/') && route.endsWith('/refresh-token')) return { accessToken: 'browser-mock-token' };
  if (route === '/auth/me') return { id: ids[role], role: role.toUpperCase(), status: 'ACTIVE', fullName: `${role} kiểm thử`,
    accountName: role, avatarUrl: null, assignedClasses: [], createdAt: original.createdAt, updatedAt: original.updatedAt };
  if (route === '/permissions/me') return { permissions: role === 'teacher' ? permissions : ['learning.read', 'exams.read', 'notifications.read'] };
  if (/notifications/.test(route)) return [];
  if (route.endsWith('/class-report')) return { generatedAt: new Date().toISOString(), exam: original,
    summary: { enrolledStudentCount: 2, submittedStudentCount: 0, inProgressStudentCount: 0, notStartedCount: 2,
      ungradedSubmittedAttemptCount: 0, averageScore: null, averageDurationSeconds: null, averagePercentage: null },
    students: [], questionPerformance: [], topicPerformance: [] };
  if (route.endsWith('/submissions') || route.endsWith('/learning-exceptions')) return [];
  if (route.endsWith('/roster')) return { students: [{ id: ids.student, fullName: 'Học sinh được chọn', accountName: 'HS01' },
    { id: '555555555555555555555555', fullName: 'Học sinh khác', accountName: 'HS02' }], teachers: [] };
  if (route === '/subjects') return [{ id: ids.subject, name: 'History', vietnameseName: 'Lịch sử', isActive: true }];
  if (route === '/teacher/assigned-classes') return [{ id: ids.class, name: 'Lớp kiểm thử', code: 'TEST', studentCount: 2,
    subjects: [{ id: ids.subject, name: 'History', vietnameseName: 'Lịch sử' }] }];
  if (route.startsWith('/topics')) return [];
  if (route.endsWith('/topics')) return [];
  if (route.startsWith('/question-bank')) return [question(ids.oldQuestion, 'Câu hỏi bài gốc'), question(ids.newQuestion, 'Câu hỏi mới dành cho thi bù')];
  if (route === '/teacher-settings/exam-defaults') return { configured: false, examDefaults: original.settings };
  if (route === `/exams/${ids.original}/question-resolution` && method === 'POST') {
    resolutionPayload = payload;
    if (rejectedResolution) return { __status: 409, __message: 'Học kỳ đã khóa; chưa chấm lại' };
    original.questions[0].faultPolicy = payload.mode === 'CORRECT_KEY' ? undefined : payload.mode;
    original.updatedAt = new Date(Date.now()).toISOString();
    return { regradedAttempts: 2, changedGrades: 2 };
  }
  if (route.endsWith('/results/publish')) return { publishedStudents: 2, resultStatus: 'PUBLISHED' };
  if (route === `/exams/${ids.original}/makeup` && method === 'POST') {
    makeupPayload = payload; makeup = { ...original, ...payload, id: ids.makeup, makeupOfExamId: ids.original,
      published: false, status: 'DRAFT', requiredForCompletion: false, totalPoints: 10,
      questions: payload.questions.map((q) => ({ ...question(q.questionId, 'Câu hỏi mới dành cho thi bù'), ...q })) };
    return makeup;
  }
  if (route === `/exams/${ids.makeup}/publish`) { makeup.published = true; makeup.status = 'SCHEDULED'; return makeup; }
  if (route === '/exams') return role === 'student' ? [makeup] : [original, ...makeup ? [makeup] : []];
  if (route === `/exams/${ids.original}`) return original;
  if (route === `/exams/${ids.makeup}`) return makeup;
  if (route === `/exams/${ids.makeup}/attempts`) {
    attempt = { id: ids.attempt, examId: ids.makeup, studentId: ids.student, status: 'IN_PROGRESS', gradingStatus: 'PARTIAL',
      answers: [], score: null, maxScore: 10, questionCount: 1, correctCount: null, revision: 0, startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800000).toISOString(), canResume: true, canShowCorrectAnswers: false,
      exam: { ...makeup, questions: makeup.questions.map((q) => ({ ...q, question: question(q.questionId, 'Câu hỏi mới dành cho thi bù') })) } };
    return attempt;
  }
  if (route === `/exam-attempts/${ids.attempt}`) return attempt;
  if (route.endsWith('/answer')) { attempt.answers = [payload]; return { ...attempt, savedClientSequence: payload.clientSequence }; }
  if (route.endsWith('/submit')) { attempt.answers = payload.answers; attempt.status = 'SUBMITTED'; attempt.gradingStatus = 'FINALIZED';
    attempt.score = 10; attempt.submittedAt = new Date().toISOString(); return attempt; }
  if (route.endsWith('/study-analysis')) return null;
  unexpected.push(`${method} ${route}`); return { __status: 404, __message: 'API chưa được mô phỏng' };
}
async function configure(page, role, origin) {
  await page.call('Page.enable'); await page.call('Runtime.enable'); await page.call('Network.enable');
  await page.call('Network.setBlockedURLs', { urls: ['*socket.io*'] });
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  page.on('Runtime.exceptionThrown', (e) => runtimeErrors.push(e.exceptionDetails.exception?.description ?? e.exceptionDetails.text));
  page.on('Fetch.requestPaused', (e) => void (async () => {
    const url = new URL(e.request.url);
    if (url.pathname.includes('/api/v1/')) {
      const route = url.pathname.slice(url.pathname.indexOf('/api/v1') + 7) + url.search;
      const value = e.request.method === 'OPTIONS' ? {} : mockApi(role, route, e.request.method, e.request.postData);
      const responseCode = value?.__status ?? 200;
      const body = responseCode === 200 ? { success: true, data: value, message: 'Mock browser acceptance' } : { success: false, message: value.__message };
      await page.call('Fetch.fulfillRequest', { requestId: e.requestId, responseCode,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
          { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
          { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, PUT, DELETE, OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    } else if (url.origin === origin) await page.call('Fetch.continueRequest', { requestId: e.requestId });
    else await page.call('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' });
  })().catch((error) => runtimeErrors.push(error.message)));
  await page.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
}
async function click(page, label, exact = true) {
  const expression = `(() => { const scope=[...document.querySelectorAll('[role=dialog]')].filter(n=>n.getBoundingClientRect().width).at(-1)??document; const nodes=[...scope.querySelectorAll('button,a')]; const node=nodes.find(n=>${exact ? 'n.textContent.trim()===' : 'n.textContent.includes('}${JSON.stringify(label)}${exact ? '' : ')'} && !n.disabled && n.getBoundingClientRect().width); if(!node) return null; node.scrollIntoView({block:'center'}); const b=node.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; })()`;
  const point = await until(() => page.evaluate(expression), `button ${label}`);
  await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function fill(page, selector, value) {
  await page.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw Error('Missing field'); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
}
async function screenshot(page, name) { const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(shot.data, 'base64'));
}
async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'estude-exam-browser-'));
  const port = await freePort(), debugPort = await freePort(), origin = `http://127.0.0.1:${port}`;
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, windowsHide: true, stdio: 'ignore' });
  const chromePath = process.env.ESTUDE_BROWSER_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeLog = ''; chrome.stderr.on('data', (chunk) => { chromeLog = (chromeLog + chunk.toString()).slice(-3000); });
  chrome.on('error', (error) => { chromeLog += error.message; });
  let browser;
  try {
    await until(async () => (await fetch(origin + '/login')).ok, 'Next start');
    const version = await until(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(), 'Chrome start');
    console.log(`Browser: ${version.Browser}; API=MOCK; DB/S3 writes=0`);
    browser = new CDP(version.webSocketDebuggerUrl);
    async function page(role) { const tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
      const cdp = new CDP(tab.webSocketDebuggerUrl); pages.push(cdp); await configure(cdp, role, origin); return cdp; }
    const teacher = await page('teacher');
    await teacher.call('Page.navigate', { url: `${origin}/teacher/exams/${ids.original}` });
    await click(teacher, 'Xử lý câu hỏi lỗi');
    await fill(teacher, 'select', ids.oldQuestion); await fill(teacher, 'select:nth-of-type(1)', ids.oldQuestion);
    await fill(teacher, 'textarea', 'Câu hỏi có hai đáp án đúng, áp dụng điểm toàn câu');
    await click(teacher, 'Áp dụng và chấm lại');
    await until(() => teacher.evaluate("document.body.innerText.includes('Đã chấm lại 2 lượt')"), 'regrade success');
    assert.equal(resolutionPayload.mode, 'FULL_CREDIT'); assert.equal(resolutionPayload.questionId, ids.oldQuestion);
    await screenshot(teacher, 'teacher-question-recovery');
    await click(teacher, 'Trả điểm sau khi chấm lại');
    await until(() => teacher.evaluate("document.body.innerText.includes('Đã trả điểm mới')"), 'result publication');
    await click(teacher, 'Tạo đề thi bù riêng');
    await until(() => teacher.evaluate("document.querySelector('fieldset input[type=checkbox]') !== null"), 'roster');
    await teacher.evaluate("document.querySelector('fieldset input[type=checkbox]').click()");
    await fill(teacher, 'textarea', 'Nghỉ ốm có xác nhận'); await click(teacher, 'Soạn đề thi bù');
    await until(() => teacher.evaluate("document.querySelector('[role=dialog] input') !== null"), 'wizard');
    await click(teacher, 'Tiếp theo', false); await click(teacher, 'Chọn từ ngân hàng');
    await until(() => teacher.evaluate("document.body.innerText.includes('Câu hỏi mới dành cho thi bù')"), 'new questions');
    const pickerText = await teacher.evaluate("[...document.querySelectorAll('[role=dialog]')].at(-1).innerText");
    assert(!pickerText.includes('Câu hỏi bài gốc'), 'Exposed source question must be filtered out');
    await click(teacher, 'Câu hỏi mới dành cho thi bù', false); await click(teacher, 'Áp dụng 1 câu hỏi');
    await click(teacher, 'Tiếp theo', false); await sleep(100); await click(teacher, 'Tiếp theo', false);
    await sleep(100); await click(teacher, 'Tiếp theo', false);
    await screenshot(teacher, 'teacher-makeup-review');
    await click(teacher, 'Lưu và công bố', false);
    await until(() => Boolean(makeup?.published), 'makeup published');
    assert.deepEqual(makeupPayload.studentIds, [ids.student]); assert.equal(makeupPayload.requiredForCompletion, false);
    assert.deepEqual(makeupPayload.questions.map((q) => q.questionId), [ids.newQuestion]);
    console.log('PASS Teacher (mock API): faulty question -> regrade request -> explicit result return; selected audience -> new questions -> makeup publication');
    makeup.status = 'ONGOING'; makeup.studentStatus = 'AVAILABLE'; makeup.canStart = true; makeup.canResume = false;
    makeup.settings.startsAt = new Date(Date.now() - 60000).toISOString(); makeup.settings.endsAt = new Date(Date.now() + 3600000).toISOString();
    const student = await page('student');
    await student.call('Page.navigate', { url: `${origin}/student/exams` });
    await until(() => student.evaluate("document.body.innerText.includes('Thi bù · đề riêng')"), 'student makeup badge');
    await screenshot(student, 'student-makeup-list'); await click(student, 'Xem chi tiết');
    await until(() => student.evaluate("document.body.innerText.includes('Đây là đề thi bù riêng')"), 'student instructions');
    assert.equal(await student.evaluate(`document.querySelector('section h2')?.textContent === ${JSON.stringify(makeup.title)}`), true, 'Student must see the paper title before starting');
    await screenshot(student, 'student-makeup-detail'); await click(student, 'Bắt đầu làm bài');
    await until(() => student.evaluate("document.querySelector('[role=radio]') !== null"), 'student paper');
    await student.evaluate("document.querySelector('[role=radio]').click()");
    await until(() => attempt.answers.length > 0, 'answer saved'); await screenshot(student, 'student-makeup-attempt');
    await click(student, 'Nộp bài ngay');
    await until(() => student.evaluate("[...document.querySelectorAll('[role=dialog]')].some(n=>n.innerText.includes('Nộp bài kiểm tra?'))"), 'submission confirmation');
    await click(student, 'Nộp bài', true);
    await until(() => student.evaluate("document.body.innerText.includes('Đã nộp bài thành công')"), 'submission receipt');
    assert.equal(attempt.status, 'SUBMITTED'); assert.deepEqual(attempt.answers[0].selectedOptionIds, ['a']);
    await screenshot(student, 'student-makeup-receipt');
    console.log('PASS Student: makeup badge -> instructions -> start -> answer/autosave -> submit -> receipt');
    // Mobile-width layout is a browser viewport test, not native device acceptance.
    await student.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await screenshot(student, 'student-receipt-narrow');
    assert.equal(await student.evaluate('document.documentElement.scrollWidth > window.innerWidth'), false, 'Student page must not overflow narrow viewport');
    rejectedResolution = true;
    await teacher.call('Page.navigate', { url: `${origin}/teacher/exams/${ids.original}` });
    await click(teacher, 'Xử lý câu hỏi lỗi'); await fill(teacher, 'select', ids.oldQuestion);
    await fill(teacher, 'textarea', 'Kiểm tra khóa học kỳ khi thao tác chấm lại');
    await click(teacher, 'Áp dụng và chấm lại');
    await until(() => teacher.evaluate("document.body.innerText.includes('Học kỳ đã khóa; chưa chấm lại')"), '409 teacher error');
    assert.equal(await teacher.evaluate("document.body.innerText.includes('Đã chấm lại 2 lượt')"), false);
    await screenshot(teacher, 'teacher-locked-term-error');
    console.log('PASS Teacher 409: displays academic-lock rejection without a success message');
    assert.deepEqual(unexpected, []); assert.deepEqual(runtimeErrors, []);
    fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify({ browser: version.Browser, api: 'MOCK', dbWrites: 0, s3Writes: 0,
      teacher: 'PASS', student: 'PASS', narrowViewport: 'PASS', calls, unexpected, runtimeErrors }, null, 2));
    console.log('PASS browser acceptance; artifacts: .browser-artifacts/exam-recovery');
  } catch (error) {
    for (let i = 0; i < pages.length; i++) { try { await screenshot(pages[i], `failure-${i}`);
      console.error((await pages[i].evaluate('document.body.innerText')).slice(-4500)); } catch { /* closed */ } }
    console.error({ unexpected, runtimeErrors, recentCalls: calls.slice(-15), chromeLog, chromeExit: chrome.exitCode }); throw error;
  } finally {
    if (browser) { try { await browser.call('Browser.close'); } catch { /* process already exited */ } browser.close(); }
    for (const p of pages) p.close(); chrome.kill(); app.kill();
    // Only this run's nonce-owned profile, never an installed browser's user data.
    if (path.dirname(profile) !== os.tmpdir() || !path.basename(profile).startsWith('estude-exam-browser-')) throw new Error('Unsafe profile cleanup target');
    for (let retry = 0; retry < 10; retry++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); } }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
