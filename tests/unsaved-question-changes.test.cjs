/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => new Promise(setImmediate);
const childText = (value) => typeof value === 'string' ? value : Array.isArray(value) ? value.map(childText).join('') : React.isValidElement(value) ? childText(value.props.children) : '';
function events(target) {
  const handlers = new Map();
  target.addEventListener = (name, fn, options) => { const list = handlers.get(name) ?? []; list.push({ fn, capture: options === true || options?.capture, once: options?.once }); handlers.set(name, list); };
  target.removeEventListener = (name, fn) => handlers.set(name, (handlers.get(name) ?? []).filter((h) => h.fn !== fn));
  target.dispatchEvent = (event) => {
    let stopped = false; const original = event.stopImmediatePropagation?.bind(event);
    event.stopImmediatePropagation = () => { stopped = true; original?.(); };
    for (const h of [...(handlers.get(event.type) ?? [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
      h.fn(event); if (h.once) target.removeEventListener(event.type, h.fn); if (stopped) break;
    }
    return !event.defaultPrevented;
  };
  return target;
}
async function render(t, options = {}) {
  const routes = []; const win = events({ location: new URL('http://localhost/teacher/question-bank/generate') });
  const entries = [{ url: 'http://localhost/teacher/dashboard', state: {} }, { url: win.location.href, state: { __NA: true } }]; let pointer = 1;
  win.history = { get length() { return entries.length; }, get state() { return entries[pointer].state; },
    pushState(state, _, url) { entries.splice(pointer + 1); entries.push({ state, url: new URL(url, win.location).href }); pointer++; win.location = new URL(entries[pointer].url); },
    back() { this.go(-1); },
    go(delta) { const next = pointer + delta; if (next < 0 || next >= entries.length) return; pointer = next; win.location = new URL(entries[pointer].url);
      queueMicrotask(() => win.dispatchEvent({ type: 'popstate', state: entries[pointer].state, stopImmediatePropagation() {} })); },
  };
  global.window = win; global.document = events({});
  global.Element = class {};
  const router = { push: (url) => { routes.push(url); win.history.pushState({}, '', url); } };
  const filename = path.resolve('components/assessment/unsaved-question-changes.tsx');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === 'next/navigation') return { useRouter: () => router };
    if (id === '@/components/ui/button') return { Button: ({ children, ...props }) => React.createElement('button', props, children) };
    if (id === '@/components/ui/modal') return { Modal: ({ open, title, children, footer }) => open ? React.createElement('section', { role: 'dialog' }, title, children, footer) : null };
    if (id === '@/lib/workspace-navigation') return { WORKSPACE_NAVIGATION_EVENT: 'estude:workspace-navigation' };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  let saves = 0; let renderer; const props = { dirty: options.dirty !== false, busy: false, canSave: true,
    onSave: async () => { saves++; if (options.saveFailure) return false; if (options.cleanAfterSave) renderer.update(React.createElement(loaded.exports.UnsavedQuestionChanges, { ...props, dirty: false })); return true; } };
  await act(async () => { const page = React.createElement(loaded.exports.UnsavedQuestionChanges, props); renderer = create(options.strict ? React.createElement(React.StrictMode, null, page) : page); await flush(); });
  t.after(async () => { await act(async () => { renderer.unmount(); await flush(); }); delete global.window; delete global.document; delete global.Element; });
  const button = (label) => renderer.root.findAllByType('button').find((b) => childText(b.props.children) === label);
  const request = async () => { await act(async () => { win.dispatchEvent(new CustomEvent('estude:workspace-navigation', { cancelable: true, detail: { action: () => router.push('/teacher/question-bank') } })); await flush(); }); };
  const setDirty = async (dirty) => { await act(async () => { renderer.update(React.createElement(loaded.exports.UnsavedQuestionChanges, { ...props, dirty })); await flush(); }); };
  return { renderer, win, routes, request, button, setDirty, saves: () => saves, location: () => win.location.pathname };
}
test('stays in the workspace and warns on reload while changes remain unsaved', async (t) => {
  const page = await render(t); await page.request(); assert.equal(page.routes.length, 0);
  await act(async () => page.button('Ở lại').props.onClick()); assert.equal(page.renderer.toJSON(), null);
  const event = new Event('beforeunload', { cancelable: true }); Object.defineProperty(event, 'returnValue', { value: true, writable: true }); page.win.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
});
test('save failure keeps the page, modal and pending navigation', async (t) => {
  const page = await render(t, { saveFailure: true }); await page.request();
  await act(async () => { page.button('Lưu bản nháp').props.onClick(); await flush(); });
  assert.equal(page.saves(), 1); assert.deepEqual(page.routes, []); assert.ok(page.renderer.root.findByProps({ role: 'alert' }));
});
test('save then leave consumes only the temporary history entry even after dirty becomes false', async (t) => {
  const page = await render(t, { cleanAfterSave: true }); await page.request();
  await act(async () => { page.button('Lưu bản nháp').props.onClick(); await flush(); });
  assert.deepEqual(page.routes, ['/teacher/question-bank']); assert.equal(page.saves(), 1);
  assert.equal(page.win.history.length, 3);
  await act(async () => { page.win.history.back(); await flush(); });
  assert.equal(page.location(), '/teacher/question-bank/generate');
});
test('Back shows the popup, Stay restores the same URL, discard returns to the previous page', async (t) => {
  const page = await render(t);
  await act(async () => { page.win.history.back(); await flush(); });
  assert.equal(page.location(), '/teacher/question-bank/generate'); assert.ok(page.button('Ở lại'));
  await act(async () => page.button('Ở lại').props.onClick());
  await act(async () => { page.win.history.back(); await flush(); });
  await act(async () => { page.button('Hủy thay đổi').props.onClick(); await flush(); });
  assert.equal(page.location(), '/teacher/dashboard'); assert.equal(page.saves(), 0);
});
test('clean workspaces do not prevent navigation or warn on reload', async (t) => {
  const page = await render(t, { dirty: false });
  const event = new Event('beforeunload', { cancelable: true }); Object.defineProperty(event, 'returnValue', { value: true, writable: true }); page.win.dispatchEvent(event); assert.equal(event.defaultPrevented, false);
  assert.equal(page.win.history.length, 2); assert.equal(page.renderer.toJSON(), null);
});

test('closes a pending leave popup when work is completed while it is open', async (t) => {
  const page = await render(t);
  await page.request();
  assert.ok(page.button('Ở lại'));
  await page.setDirty(false);
  assert.equal(page.renderer.toJSON(), null);
  assert.deepEqual(page.routes, []);
  const event = new Event('beforeunload', { cancelable: true });
  Object.defineProperty(event, 'returnValue', { value: true, writable: true });
  page.win.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(page.location(), '/teacher/question-bank/generate');
  await act(async () => { page.win.history.back(); await flush(); });
  assert.equal(page.location(), '/teacher/dashboard');
  assert.equal(page.renderer.toJSON(), null);
});

test('StrictMode retains the history guard without opening a popup during mount', async (t) => {
  const page = await render(t, { strict: true });
  assert.equal(page.renderer.toJSON(), null);
  assert.equal(page.win.history.length, 3);
  assert.equal(page.win.history.state.__estudeQuestionDraftGuard, true);
  await page.request();
  assert.ok(page.button('Ở lại'));
});
