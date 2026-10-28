require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');
const Module = require('node:module');
const path = require('node:path');
function loadComponent(relativePath, resolveImport) {
  const filename = path.resolve(relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = resolveImport;
  Module._extensions['.tsx'](loaded, filename);
  return loaded.exports;
}

global.IS_REACT_ACT_ENVIRONMENT = true;

test('school portal loads and renders branding on both dashed and dotted hosts', async () => {
  const saved = { window: global.window, document: global.document, fetch: global.fetch, nodeEnv: process.env.NODE_ENV, portal: process.env.NEXT_PUBLIC_AUTH_PORTAL };
  process.env.NODE_ENV = 'production';
  delete process.env.NEXT_PUBLIC_AUTH_PORTAL;
  try {
    for (const host of ['student-lequydonlequy.estude.io.vn', 'student.lequydonlequy.estude.io.vn', 'teacher-school.estude.io.vn', 'admin-school.estude.io.vn', 'parent-school.estude.io.vn']) {
      let requested = [], favicon;
      const logo = '/api/v1/tenant/logo?v=2';
      const name = 'Trường THPT Chuyên Lê Quý Đôn';
      global.window = { location: { host }, addEventListener() {}, removeEventListener() {} };
      global.document = { documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } } };
      global.fetch = async (url, options) => {
        requested.push({ url, options });
        return { ok: true, json: async () => ({ success: true, data: { id: 'school-1', slug: 'lequydonlequy', name, portal: host.split(/[.-]/)[0], branding: { displayName: name, logoUrl: logo, primaryColor: '#2269ef' } } }) };
      };
      const context = loadComponent('context/tenant-context.tsx', id => {
        if (id === '@/lib/tenant-branding') return { tenantPalette: () => ({}), applyTenantFavicon: value => { favicon = value; return () => {}; } };
        return require(id);
      });
      const { BrandLogo } = loadComponent('components/brand-logo.tsx', id => {
        if (id === '@/context/tenant-context') return context;
        if (id === 'next/image') return { __esModule: true, default: props => React.createElement('img', props) };
        return require(id);
      });
      let ui;
      try {
        await act(async () => { ui = create(React.createElement(context.TenantProvider, null, React.createElement(BrandLogo))); });
        assert.equal(requested.length, 1, host);
        assert.equal(requested[0].url, '/api/v1/tenant');
        assert.equal(requested[0].options.credentials, 'same-origin');
        assert.equal(requested[0].options.cache, 'no-store');
        assert.equal(ui.root.findByType('img').props.src, logo);
        assert.match(JSON.stringify(ui.toJSON()), /Trường THPT Chuyên Lê Quý Đôn/);
        assert.doesNotMatch(JSON.stringify(ui.toJSON()), /EStude/);
        assert.equal(global.document.documentElement.dataset.tenantSlug, 'lequydonlequy');
        assert.equal(favicon, logo);
      } finally {
        if (ui) await act(async () => ui.unmount());
      }
    }
  } finally {
    global.window = saved.window;
    global.document = saved.document;
    global.fetch = saved.fetch;
    if (saved.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.nodeEnv;
    if (saved.portal === undefined) delete process.env.NEXT_PUBLIC_AUTH_PORTAL; else process.env.NEXT_PUBLIC_AUTH_PORTAL = saved.portal;
  }
});

test('marketing hosts do not request another school context', async () => {
  const saved = { window: global.window, fetch: global.fetch, nodeEnv: process.env.NODE_ENV, portal: process.env.NEXT_PUBLIC_AUTH_PORTAL };
  process.env.NODE_ENV = 'production';
  delete process.env.NEXT_PUBLIC_AUTH_PORTAL;
  let ui;
  try {
    let requests = 0;
    global.window = { location: { host: 'estude.io.vn' }, addEventListener() {}, removeEventListener() {} };
    global.fetch = async () => { requests++; throw new Error('must not fetch'); };
    const { TenantProvider } = require('../context/tenant-context.tsx');
    await act(async () => { ui = create(React.createElement(TenantProvider, null, React.createElement('span', null, 'EStude'))); });
    assert.equal(requests, 0);
    assert.match(JSON.stringify(ui.toJSON()), /EStude/);
  } finally {
    if (ui) await act(async () => ui.unmount());
    global.window = saved.window;
    global.fetch = saved.fetch;
    if (saved.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.nodeEnv;
    if (saved.portal === undefined) delete process.env.NEXT_PUBLIC_AUTH_PORTAL; else process.env.NEXT_PUBLIC_AUTH_PORTAL = saved.portal;
  }
});
