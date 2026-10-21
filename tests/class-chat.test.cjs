/* CommonJS is required by this isolated TypeScript module test loader. */
require("./helpers/register-ui.cjs");
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const user = { id: 'user', fullName: 'Teacher', accountName: 'teacher', role: 'TEACHER' };
const message = (n) => ({ id: n.toString(16).padStart(24, '0'), content: `Message ${n}`, createdAt: new Date(1_700_000_000_000 + n).toISOString(), sender: user, attachments: [] });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };

async function setup(t, { history = () => [], ack = () => ({ ok: true }), canRead = true } = {}) {
  const sockets = [], calls = [], authCalls = [];
  let tokenListener;
  class MockSocket extends EventEmitter {
    connected = false;
    constructor(options) { super(); this.options = options; this.sent = []; }
    get volatile() { return this; }
    timeout() { return this; }
    connect() {
      this.options.auth(() => { this.connected = true; super.emit('connect'); });
      return this;
    }
    disconnect() {
      if (this.connected) { this.connected = false; super.emit('disconnect', 'io client disconnect'); }
      return this;
    }
    fire(event, payload) { super.emit(event, payload); }
    emit(event, payload, callback) {
      this.sent.push({ event, payload });
      Promise.resolve(ack(event, payload)).then((result) => callback(result instanceof Error ? result : null, result instanceof Error ? undefined : result));
      return this;
    }
  }
  class ApiError extends Error {
    constructor(message, status = 500) { super(message); this.status = status; this.details = []; }
  }
  const cache = require('./helpers/load-typescript.cjs').loadTypeScript('lib/class-chat-history.ts');
  let actor = user, tenant = { id: 'school-a' };
  const filename = path.resolve('components/class-chat/class-chat-panel.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === '@/lib/go-chat-socket') return { createGoChatSocket: (auth) => { const socket = new MockSocket({ auth }); sockets.push(socket); return socket; } };
    if (id === '@/components/ui/button') return { Button: (props) => React.createElement('button', props) };
    if (id === '@/context/permissions-context') return { usePermissions: () => ({ can: (key) => key === 'class_chat.read' && canRead }) };
    if (id === '@/context/auth-context') return { useAuth: () => ({ user: actor }) };
    if (id === '@/context/tenant-context') return { useTenant: () => tenant };
    if (id === '@/lib/class-chat-history') return cache;
    if (id === '@/lib/auth-api') return {
      ApiError,
      subscribeAccessToken: (listener) => { tokenListener = listener; return () => { tokenListener = undefined; }; },
      getRealtimeAccessToken: async (force) => { authCalls.push(force); return 'token'; },
      authenticatedRequest: async (url, init) => {
        calls.push({ url, init });
        return url === '/auth/me' ? user : history(url, init);
      },
    };
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  const Panel = loaded.exports.ClassChatPanel;
  let renderer;
  const listNode = { scrollTop: 0, clientHeight: 500,
    get scrollHeight() { return 500 + (renderer?.root.findAllByType('article').length ?? 0) * 40; },
  };
  await act(async () => { renderer = create(React.createElement(Panel, { classId: 'class-a' }), { createNodeMock: (element) => element.props['aria-label'] === 'Tin nhắn trao đổi lớp' ? listNode : { scrollIntoView() {} } }); await flush(); });
  t.after(async () => { await act(async () => { renderer.unmount(); await flush(); }); });
  return {
    renderer, Panel, sockets, calls, authCalls, cache, listNode, ApiError,
    identity: (nextUser, nextTenant = tenant) => { actor = nextUser; tenant = nextTenant; },
    tokenChanged: (token) => tokenListener?.(token),
    text: () => JSON.stringify(renderer.toJSON()),
    send: () => renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === 'Gửi tin nhắn'),
    textarea: () => renderer.root.findByType('textarea'),
    button: (text) => renderer.root.findAllByType('button').find((button) => button.props.children === text),
  };
}

test('hides chat without read permission and does not open a socket', async (t) => {
  const ui = await setup(t, { canRead: false });
  assert.equal(ui.renderer.toJSON(), null);
  assert.equal(ui.sockets.length, 0);
});

test('shows recent history before join acknowledgement and enables send only after joining', async (t) => {
  const join = deferred();
  const ui = await setup(t, { ack: () => join.promise, history: () => [message(1)] });
  assert.equal(ui.calls.filter((call) => call.url.includes('/messages')).length, 1);
  assert.match(ui.text(), /Message 1/);
  assert.doesNotMatch(ui.text(), /Đang tải trò chuyện/);
  assert.equal(ui.send().props.disabled, true);
  await act(async () => { join.resolve({ ok: true }); await flush(); });
  assert.equal(ui.calls.filter((call) => call.url.includes('/messages')).length, 2);
  assert.equal(ui.calls.some((call) => call.url === '/auth/me'), false);
  assert.match(ui.text(), /Trực tuyến/);
});

test('shows a rejected join and never marks the room online', async (t) => {
  const ui = await setup(t, { ack: () => ({ ok: false, code: 'FORBIDDEN', message: 'No access' }) });
  assert.match(ui.text(), /No access/);
  assert.doesNotMatch(ui.text(), /Trực tuyến/);
  assert.equal(ui.send().props.disabled, true);
});

test('reconnects, fetches every catch-up page and merges overlapping live events', async (t) => {
  let offline = false;
  const ui = await setup(t, { history: (url) => {
    const params = new URL(url, 'http://test').searchParams;
    if (!params.has('after')) return [message(1)];
    if (!offline) return [];
    if (params.get('afterId') === message(1).id) return Array.from({ length: 100 }, (_, index) => message(index + 2));
    return [message(102)];
  } });
  offline = true;
  await act(async () => {
    ui.sockets[0].disconnect();
    ui.sockets[0].connect();
    ui.sockets[0].fire('class:message', message(102));
    await flush();
  });
  assert.equal(ui.renderer.root.findAllByType('article').length, 102);
  assert.equal(ui.calls.filter((call) => call.url.includes('after=')).length, 3);
  assert.equal(ui.authCalls.length, 2);
  assert.match(ui.text(), /Trực tuyến/);
});

test('retains the same message ID on timeout retry and renders the acknowledged message', async (t) => {
  let attempts = 0;
  const ui = await setup(t, { ack: (event, payload) => {
    if (event === 'class:join') return { ok: true };
    if (++attempts === 1) return new Error('timeout');
    return { ok: true, message: { ...message(1), id: payload.clientMessageId, content: payload.content } };
  } });
  await act(async () => { ui.textarea().props.onChange({ target: { value: 'hello' } }); });
  await act(async () => { ui.send().props.onClick(); ui.send().props.onClick(); await flush(); });
  assert.equal(attempts, 1, 'double click must not send twice');
  assert.equal(ui.textarea().props.disabled, true);
  await act(async () => { ui.send().props.onClick(); await flush(); });
  const sends = ui.sockets[0].sent.filter((item) => item.event === 'class:message');
  assert.equal(sends.length, 2);
  assert.equal(sends[0].payload.clientMessageId, sends[1].payload.clientMessageId);
  assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  assert.equal(ui.textarea().props.value, '');
  assert.equal(ui.textarea().props.disabled, false);
});

test('loads older messages with timestamp and ID without dropping equal timestamps', async (t) => {
  const initial = Array.from({ length: 40 }, (_, index) => ({ ...message(index + 2), createdAt: message(1).createdAt }));
  const ui = await setup(t, { history: (url) => url.includes('before=') ? [message(1)] : initial });
  await act(async () => { ui.button('Xem tin nhắn cũ').props.onClick(); await flush(); });
  const older = ui.calls.find((call) => call.url.includes('before='));
  assert.match(older.url, new RegExp(`beforeId=${message(2).id}`));
  assert.equal(ui.renderer.root.findAllByType('article').length, 41);
  assert.equal(ui.button('Xem tin nhắn cũ'), undefined);
});

test('fetches only the recent page until scrolling up, deduplicates scroll requests and preserves the reading position', async (t) => {
  const join = deferred(), older = deferred();
  const initial = Array.from({ length: 40 }, (_, i) => message(i + 2));
  const ui = await setup(t, { ack: () => join.promise, history: (url) => url.includes('before=') ? older.promise : initial });
  assert.equal(ui.calls.length, 1);
  assert.match(ui.calls[0].url, /limit=40$/);
  assert.equal(ui.renderer.root.findAllByType('article').length, 40);
  ui.listNode.scrollTop = 20;
  await act(async () => {
    const list = ui.renderer.root.findByProps({ 'aria-label': 'Tin nhắn trao đổi lớp' });
    list.props.onScroll({ currentTarget: ui.listNode });
    list.props.onScroll({ currentTarget: ui.listNode });
    await flush();
  });
  assert.equal(ui.calls.filter((call) => call.url.includes('before=')).length, 1);
  assert.equal(ui.send().props.disabled, true, 'HTTP history works even while realtime join is pending');
  await act(async () => { older.resolve([message(1)]); await flush(); });
  assert.equal(ui.renderer.root.findAllByType('article').length, 41);
  assert.equal(ui.listNode.scrollTop, 60, 'prepending one 40px message preserves the visible content');
  assert.equal(ui.button('Xem tin nhắn cũ'), undefined);
});

test('reopening chat shows bounded cached messages while the latest HTTP page is still pending', async (t) => {
  const latest = deferred();
  let reads = 0;
  const ui = await setup(t, { history: (url) => {
    if (url.includes('after=')) return [];
    return ++reads === 1 ? [message(1)] : latest.promise;
  } });
  await act(async () => { ui.renderer.update(null); await flush(); });
  await act(async () => { ui.renderer.update(React.createElement(ui.Panel, { classId: 'class-a' })); await flush(); });
  assert.equal(reads, 2);
  assert.match(ui.text(), /Message 1/);
  assert.doesNotMatch(ui.text(), /Đang tải trò chuyện/);
  assert.equal(ui.send().props.disabled, true);
  await act(async () => { latest.resolve([message(2)]); await flush(); });
  assert.match(ui.text(), /Message 2/);
  assert.match(ui.text(), /Trực tuyến/);
});

test('cached chat is isolated by account and school', async (t) => {
  const pending = deferred();
  let reads = 0;
  const ui = await setup(t, { history: (url) => url.includes('after=') ? [] : ++reads === 1 ? [message(1)] : pending.promise });
  ui.identity({ ...user, id: 'other-user' });
  await act(async () => { ui.renderer.update(React.createElement(ui.Panel, { classId: 'class-a' })); await flush(); });
  assert.doesNotMatch(ui.text(), /Message 1/);
  ui.identity(user, { id: 'other-school' });
  await act(async () => { ui.renderer.update(React.createElement(ui.Panel, { classId: 'class-a' })); await flush(); });
  assert.doesNotMatch(ui.text(), /Message 1/);
});

test('logout clears cached chat and prevents late HTTP or live messages from reappearing', async (t) => {
  const pending = deferred();
  const ui = await setup(t, { history: () => pending.promise });
  await act(async () => { ui.tokenChanged(null); await flush(); });
  await act(async () => { pending.resolve([message(1)]); ui.sockets[0].fire('class:message', message(2)); await flush(); });
  assert.doesNotMatch(ui.text(), /Message [12]/);
  assert.equal(ui.cache.readRecentChat(JSON.stringify(['school-a', 'user', 'class-a'])), undefined);
});

test('server revocation clears a cached conversation', async (t) => {
  let revoked = false;
  const ui = await setup(t, { history: (url) => {
    if (revoked) throw new ui.ApiError('Bạn không còn thuộc lớp', 403);
    return url.includes('after=') ? [] : [message(1)];
  } });
  await act(async () => { ui.renderer.update(null); await flush(); });
  revoked = true;
  await act(async () => { ui.renderer.update(React.createElement(ui.Panel, { classId: 'class-a' })); await flush(); });
  assert.doesNotMatch(ui.text(), /Message 1/);
  assert.match(ui.text(), /Bạn không còn thuộc lớp/);
  assert.equal(ui.cache.readRecentChat(JSON.stringify(['school-a', 'user', 'class-a'])), undefined);
});

test('recent chat cache limits room count, page size and lifetime', (t) => {
  const cache = require('./helpers/load-typescript.cjs').loadTypeScript('lib/class-chat-history.ts');
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  for (let i = 0; i < 9; i++) cache.rememberRecentChat(String(i), Array.from({ length: 60 }, (_, n) => message(n)), false);
  assert.equal(cache.readRecentChat('0'), undefined);
  assert.equal(cache.readRecentChat('8').messages.length, 40);
  assert.equal(cache.readRecentChat('8').hasOlder, true);
  now += 120001;
  assert.equal(cache.readRecentChat('8'), undefined);
});

test('ignores late history and clears drafts when switching classes', async (t) => {
  const late = deferred();
  const ui = await setup(t, { history: (url) => url.includes('class-a') ? late.promise : [message(2)] });
  await act(async () => { ui.textarea().props.onChange({ target: { value: 'old draft' } }); });
  await act(async () => { ui.renderer.update(React.createElement(ui.Panel, { classId: 'class-b' })); await flush(); });
  await act(async () => { late.resolve([message(1)]); await flush(); });
  assert.equal(ui.textarea().props.value, '');
  assert.equal(ui.renderer.root.findAllByType('article').length, 1);
  assert.match(ui.text(), /Message 2/);
  assert.doesNotMatch(ui.text(), /Message 1/);
  assert.equal(ui.calls.find((call) => call.url.includes('class-a')).init.signal.aborted, true);
});

test('reconnects with rotated credentials and closes chat on logout', async (t) => {
  const ui = await setup(t);
  await act(async () => { ui.tokenChanged('new-token'); await flush(); });
  assert.equal(ui.authCalls.length, 2);
  assert.equal(ui.sockets[0].sent.filter((item) => item.event === 'class:join').length, 2);
  await act(async () => { ui.tokenChanged(null); await flush(); });
  assert.equal(ui.send().props.disabled, true);
  assert.equal(ui.sockets[0].connected, false);
  assert.match(ui.text(), /Phiên đăng nhập đã kết thúc/);
});

test('keeps independent HTTP history across an interrupted realtime connection', async (t) => {
  const old = deferred();
  let requests = 0;
  const ui = await setup(t, { history: () => ++requests === 1 ? old.promise : [message(2)] });
  await act(async () => { ui.sockets[0].disconnect().connect(); await flush(); });
  await act(async () => { old.resolve([message(1)]); await flush(); });
  assert.equal(ui.renderer.root.findAllByType('article').length, 2);
  assert.match(ui.text(), /Message 1/);
  assert.match(ui.text(), /Message 2/);
});

function loadAuthApi() {
  const filename = path.resolve('lib/auth-api.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => id === '@/lib/portal' ? { getCurrentPortal: () => 'teacher' } : id === '@/lib/auth-coordination' ? require('./helpers/load-typescript.cjs').loadTypeScript('lib/auth-coordination.ts') : originalRequire(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}
const jwtToken = (seconds) => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.signature`;

test('refreshes a nearly expired realtime token once for concurrent callers', async (t) => {
  const auth = loadAuthApi();
  const oldToken = jwtToken(5), newToken = jwtToken(3600);
  let refreshes = 0;
  t.mock.method(global, 'fetch', async (url) => {
    const refresh = url.endsWith('/refresh-token');
    if (refresh) { refreshes++; await flush(); }
    return Response.json({ success: true, data: { accessToken: refresh ? newToken : oldToken } });
  });
  await auth.authApi.login({});
  const changes = [];
  const unsubscribe = auth.subscribeAccessToken((token) => changes.push(token));
  assert.deepEqual(await Promise.all([auth.getRealtimeAccessToken(), auth.getRealtimeAccessToken()]), [newToken, newToken]);
  assert.equal(refreshes, 1);
  assert.deepEqual(changes, [newToken]);
  auth.authApi.clearAccessToken();
  assert.deepEqual(changes, [newToken, null]);
  unsubscribe();
});

test('uses a valid realtime token without rotating its session', async (t) => {
  const auth = loadAuthApi();
  const token = jwtToken(3600);
  const fetchMock = t.mock.method(global, 'fetch', async () => Response.json({ success: true, data: { accessToken: token } }));
  await auth.authApi.login({});
  assert.equal(await auth.getRealtimeAccessToken(), token);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('keeps uploaded attachments when retrying an unacknowledged send', async (t) => {
  let sends = 0, uploads = 0;
  const ui = await setup(t, {
    history: (url) => url.includes('upload-url') ? { s3Key: 'saved-key', uploadUrl: 'https://storage.test/upload' } : [],
    ack: (event, payload) => {
      if (event === 'class:join') return { ok: true };
      if (++sends === 1) return new Error('timeout');
      return { ok: true, message: { ...message(1), id: payload.clientMessageId } };
    },
  });
  t.mock.method(global, 'fetch', async () => { uploads++; return { ok: true }; });
  const file = { name: 'test.pdf', size: 100, type: 'application/pdf' };
  await act(async () => { ui.renderer.root.findByType('input').props.onChange({ target: { files: [file] }, currentTarget: { value: '' } }); });
  await act(async () => { ui.send().props.onClick(); await flush(); });
  assert.equal(ui.renderer.root.findByType('input').props.disabled, true);
  await act(async () => { ui.send().props.onClick(); await flush(); });
  assert.equal(uploads, 1);
  const payloads = ui.sockets[0].sent.filter((item) => item.event === 'class:message').map((item) => item.payload);
  assert.deepEqual(payloads[0], payloads[1]);
});

test('does not send a message if attachment upload fails and lets the user edit', async (t) => {
  const ui = await setup(t, { history: (url) => url.includes('upload-url') ? { s3Key: 'key', uploadUrl: 'https://storage.test/upload' } : [] });
  t.mock.method(global, 'fetch', async () => ({ ok: false }));
  await act(async () => { ui.renderer.root.findByType('input').props.onChange({ target: { files: [{ name: 'test.pdf', size: 100, type: 'application/pdf' }] }, currentTarget: { value: '' } }); });
  await act(async () => { ui.send().props.onClick(); await flush(); });
  assert.equal(ui.sockets[0].sent.filter((item) => item.event === 'class:message').length, 0);
  assert.equal(ui.textarea().props.disabled, false);
  assert.match(ui.text(), /Không thể tải test.pdf lên/);
});

test('does not rotate again when a stale HTTP request returns 401 after realtime refresh', async (t) => {
  const auth = loadAuthApi();
  const oldToken = jwtToken(5), newToken = jwtToken(3600);
  const response = deferred(), started = deferred();
  let refreshes = 0;
  t.mock.method(global, 'fetch', async (url, init) => {
    if (url.endsWith('/login')) return Response.json({ success: true, data: { accessToken: oldToken } });
    if (url.endsWith('/refresh-token')) { refreshes++; return Response.json({ success: true, data: { accessToken: newToken } }); }
    if (init.headers.get('Authorization') === `Bearer ${oldToken}`) { started.resolve(); return response.promise; }
    return Response.json({ success: true, data: 'ok' });
  });
  await auth.authApi.login({});
  const request = auth.authenticatedRequest('/classes');
  await started.promise;
  await auth.getRealtimeAccessToken();
  response.resolve(Response.json({ success: false, message: 'old session' }, { status: 401 }));
  assert.equal(await request, 'ok');
  assert.equal(refreshes, 1);
});

test('enables older history when an initially empty class fills while disconnected', async (t) => {
  let requests = 0;
  const ui = await setup(t, { history: () => ++requests === 1 ? [] : Array.from({ length: 40 }, (_, index) => message(index + 1)) });
  await act(async () => { ui.sockets[0].disconnect().connect(); await flush(); });
  assert.ok(ui.button('Xem tin nhắn cũ'));
});
