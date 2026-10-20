const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

test('SaaS portal selection supports the configured school domain in production', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_AUTH_PORTAL: process.env.NEXT_PUBLIC_AUTH_PORTAL };
  try {
    process.env.NODE_ENV = 'production'; delete process.env.NEXT_PUBLIC_AUTH_PORTAL;
    const { getPortalFromHost } = loadTypeScript('lib/portal.ts');
    for (const portal of ['admin','teacher','student','parent']) {
      assert.equal(getPortalFromHost(`${portal}.school.example.edu:443`), portal);
    }
    assert.equal(getPortalFromHost('admin.estude.io.vn'), 'admin');
    for (const host of ['platform.school.example.edu','school.example.edu','127.0.0.1:3000','localhost:3000']) assert.equal(getPortalFromHost(host), null);
  } finally {
    for (const [key,value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
