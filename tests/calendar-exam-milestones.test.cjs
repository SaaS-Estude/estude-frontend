require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { calendarEventTime } = require('../lib/calendar-view.ts');
global.IS_REACT_ACT_ENVIRONMENT = true;
const zone = 'Asia/Ho_Chi_Minh';
const exam = {
  type: 'EXAM', sourceId: 'exam', title: 'Kiểm tra lịch sử',
  startAt: '2026-10-21T16:00:00+07:00', endAt: '2026-11-02T17:00:00+07:00',
  subject: { id: 'history', name: 'Lịch sử' }, schoolClass: { code: '12A2' },
  status: 'OPEN', sourceUrl: '/student/exams/exam',
};

test('multi-day exam appears only on its opening day in the school timezone', () => {
  assert.equal(calendarEventTime(exam, '2026-10-21', zone), '16:00');
  for (const day of ['2026-10-20', '2026-10-22', '2026-10-31', '2026-11-01', '2026-11-02']) {
    assert.equal(calendarEventTime(exam, day, zone), null);
  }
  const midnight = { ...exam, startAt: '2026-10-21T18:30:00Z', endAt: null };
  assert.equal(calendarEventTime(midnight, '2026-10-21', zone), null);
  assert.equal(calendarEventTime(midnight, '2026-10-22', zone), '01:30');
  const meeting = { ...exam, type: 'ONLINE_SESSION', startAt: '2026-10-21T23:00:00+07:00', endAt: '2026-10-22T01:00:00+07:00' };
  assert.equal(calendarEventTime(meeting, '2026-10-22', zone), '00:00');
});

for (const showDetails of [false, true]) {
  test(`calendar ${showDetails ? 'page' : 'dashboard'} shows the end date as text and no repeat next month`, async (t) => {
    const filename = path.resolve('components/student/student-calendar-panel.tsx');
    const loaded = new Module(filename, module);
    loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = loaded.require.bind(loaded);
    let calendar;
    const pushed = [];
    loaded.require = (id) => {
      if (id === 'next/navigation') return { useRouter: () => ({ push: (url) => pushed.push(url) }) };
      if (id === '@/lib/calendar-api') return { calendarService: { month: async () => ({ events: [exam], timeZone: zone }) } };
      if (id === '@/components/dashboard/month-calendar') return { MonthCalendar: (props) => {
        calendar = props;
        return React.createElement('div', { 'data-calendar': true }, ...['2026-10-21', '2026-10-22'].map((day) =>
          React.createElement('div', { key: day, 'data-day': day }, props.renderDay(day))));
      } };
      return original(id);
    };
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, filename);
    let ui;
    await act(async () => { ui = create(React.createElement(loaded.exports.StudentCalendarPanel, { showDetails })); await new Promise(setImmediate); });
    t.after(async () => { await act(async () => ui.unmount()); });
    await act(async () => { calendar.onChangeMonth('2026-10'); await new Promise(setImmediate); });
    const card = ui.root.findByProps({ 'data-day': '2026-10-21' });
    assert.equal(card.findAllByType('button').length, 1);
    assert.equal(ui.root.findByProps({ 'data-day': '2026-10-22' }).findAllByType('button').length, 0);
    const rendered = JSON.stringify(ui.toJSON());
    assert.match(rendered, /Kết thúc: /);
    assert.match(rendered, /17:00/);
    assert.match(rendered, /02\/11\/2026/);
    await act(async () => card.findByType('button').props.onClick());
    assert.deepEqual(pushed, ['/student/exams/exam']);
    await act(async () => { calendar.onChangeMonth('2026-11'); await new Promise(setImmediate); });
    assert.match(JSON.stringify(ui.toJSON()), /Tháng này không có hoạt động học tập/);
    assert.doesNotMatch(JSON.stringify(ui.toJSON()), /Kiểm tra lịch sử/);
  });
}
