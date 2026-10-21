const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const token = n => `fixture.${Buffer.from(JSON.stringify({exp: Math.floor(Date.now()/1000)+3600, sequence:n})).toString('base64url')}.fixture`;
  const locks = new Map(), channels = new Map();
  let cookie = 'initial', sequence = 0, active = 0, maxActive = 0, refreshes = 0, gate = null;
  const navigator = { locks: { request(name, fn) {
    const result = (locks.get(name) ?? Promise.resolve()).catch(() => {}).then(fn);
    locks.set(name, result.catch(() => {}));
    return result;
  } } };
  class Channel {
    constructor(name) { this.name = name; const group = channels.get(name) ?? new Set(); group.add(this); channels.set(name, group); }
    postMessage(data) { for (const peer of channels.get(this.name) ?? []) if (peer !== this) queueMicrotask(() => peer.onmessage?.({ data })); }
    close() { channels.get(this.name)?.delete(this); }
  }
  const response = (status, data) => new Response(JSON.stringify({ success: status < 400, data, message: 'fixture' }), { status, headers: { 'Content-Type': 'application/json' } });
  async function fetch(url, init) {
    assert.ok(url.startsWith("/api/v1/"), "default API must stay on the tenant portal origin");
    if (url.endsWith('/refresh-token')) {
      const observed = cookie; refreshes++; active++; maxActive = Math.max(maxActive, active);
      try {
        if (gate) await gate;
        await new Promise(resolve => setTimeout(resolve, 5));
        if (!observed || observed !== cookie) return response(401, {});
        cookie = `rotated-${++sequence}`;
        return response(200, { accessToken: token(sequence) });
      } finally { active--; }
    }
    if (url.endsWith('/login')) { cookie = `login-${++sequence}`; return response(200, { accessToken: token(sequence), user: { id: 'fixture' } }); }
    if (url.endsWith('/logout') || url.endsWith('/logout-all')) { cookie = null; return response(200, {}); }
    return response(init.headers.get('Authorization') ? 200 : 401, {});
  }
  function tab(portal = 'admin', options = {}) {
    const context = vm.createContext({
      URLSearchParams,
      process: { env: {} },
      window: { location: { host: `${portal}.school.localhost`, pathname: '/' } },
      navigator: options.noLocks ? {} : navigator,
      BroadcastChannel: Channel, fetch, Headers, FormData, Response, Blob, atob,
      setTimeout, clearTimeout,
    });
    const cache = new Map();
    function load(file) {
      if (cache.has(file)) return cache.get(file);
      const exports = {};
      const source = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      const require = id => id === '@/lib/portal' ? { getCurrentPortal: () => portal } : id === '@/lib/auth-coordination' ? load('lib/auth-coordination.ts') : id === '@/lib/class-chat-history' ? load('lib/class-chat-history.ts') : (() => { throw Error(id); })();
      vm.runInContext(`(function(exports,require){${source}\n})`, context)(exports, require);
      cache.set(file, exports); return exports;
    }
    const api = load('lib/auth-api.ts');
    let token = null;
    api.subscribeAccessToken(value => { token = value; });
    return { ...api, chatCache: load('lib/class-chat-history.ts'), token: () => token };
  }
  return { tab, stats: () => ({ refreshes, maxActive }), gate(value) { gate = value; } };
}

test('two browser contexts serialize cookie rotation without token persistence', async () => {
  const f = fixture(), a = f.tab(), b = f.tab();
  const results = await Promise.all([a.authApi.refresh(), b.authApi.refresh()]);
  assert.equal(results.length, 2);
  assert.equal(f.stats().refreshes, 2);
  assert.equal(f.stats().maxActive, 1);
  assert.equal(a.token(), results[0].accessToken); assert.equal(b.token(), results[1].accessToken);
});

test('one tab keeps a single refresh flight', async () => {
  const f = fixture(), a = f.tab();
  await Promise.all([a.authApi.refresh(), a.authApi.refresh(), a.authApi.refresh()]);
  assert.equal(f.stats().refreshes, 1);
});

test('logout propagates to a sibling tab and blocks an in-flight refresh from restoring access', async () => {
  const f = fixture(), a = f.tab(), b = f.tab();
  await a.authApi.login({ accountName: 'a', password: 'fixture' });
  await b.authApi.refresh();
  a.chatCache.rememberRecentChat('room', [], false);
  b.chatCache.rememberRecentChat('room', [], false);
  let release; f.gate(new Promise(resolve => { release = resolve; }));
  const pending = b.authApi.refresh();
  const denied = assert.rejects(pending, /fixture|đăng nhập|kết thúc/);
  await new Promise(resolve => setTimeout(resolve, 1));
  const logout = a.authApi.logout(); release();
  await logout;
  await denied;
  assert.equal(a.token(), null); assert.equal(b.token(), null);
  assert.equal(a.chatCache.readRecentChat('room'), undefined);
  assert.equal(b.chatCache.readRecentChat('room'), undefined);
  await assert.rejects(b.authApi.refresh(), /đăng nhập/);
});

test('logout scope does not clear another portal', async () => {
  const f = fixture(), admin = f.tab('admin'), teacher = f.tab('teacher');
  await admin.authApi.login({}); await teacher.authApi.login({});
  const before = teacher.token(); await admin.authApi.logout();
  await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(teacher.token(), before);
});

test('authentication fails safely when cross-tab locks are unavailable', async () => {
  const f = fixture(), a = f.tab('admin', { noLocks: true });
  await assert.rejects(a.authApi.refresh(), /Web Locks/);
  assert.equal(f.stats().refreshes, 0);
});

test('login reopens a logged-out tab with coordinated cookie rotation', async () => {
  const f = fixture(), a = f.tab('admin');
  await a.authApi.login({}); await a.authApi.logout();
  await a.authApi.login({}); await a.authApi.refresh();
  assert.ok(a.token());
});

test('successful password change clears local access and broadcasts logout to sibling admin tabs', async () => {
  const f = fixture(), a = f.tab('admin'), b = f.tab('admin');
  await a.authApi.login({});
  await b.authApi.refresh();
  await a.authApi.changePassword('Current@123', 'New@12345', 'New@12345');
  await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(a.token(), null);
  assert.equal(b.token(), null);
  await assert.rejects(b.authApi.refresh(), /đăng nhập/);
});
