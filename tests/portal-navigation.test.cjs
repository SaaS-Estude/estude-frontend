require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { renderToString } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { PortalRoutingProvider } = require('../context/portal-routing-context.tsx');
const PortalLink = require('../components/ui/portal-link.tsx').default;

global.IS_REACT_ACT_ENVIRONMENT = true;

test('portal links render canonical hrefs on the server, preserving normal anchor props', () => {
  for (const portal of ['admin', 'teacher', 'student', 'parent']) {
    const html = renderToString(React.createElement(PortalRoutingProvider, { portal },
      React.createElement(PortalLink, { href: `/${portal}/courses/class?courseOfferingId=two#lesson`, target: '_blank', className: 'course', 'aria-label': 'Mở môn học' }, 'Mở'),
    ));
    assert.match(html, /href="\/courses\/class\?courseOfferingId=two#lesson"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /aria-label="Mở môn học"/);
  }
});

test('router navigation uses clean URLs while pathname consumers keep workspace permission keys', async (t) => {
  let portal = 'teacher';
  const calls = [];
  const nativeRouter = {
    push: (...args) => calls.push(['push', ...args]),
    replace: (...args) => calls.push(['replace', ...args]),
    prefetch: (...args) => calls.push(['prefetch', ...args]),
    back() {}, forward() {}, refresh() {},
  };
  const navigation = loadTypeScript('lib/portal-navigation.ts', name => {
    if (name === 'next/navigation') return { useRouter: () => nativeRouter, usePathname: () => '/question-bank/new' };
    if (name === '@/context/portal-routing-context') return { useRoutingPortal: () => portal };
    return require(name);
  });
  let current;
  function Probe() {
    current = { router: navigation.useRouter(), pathname: navigation.useWorkspacePathname() };
    return null;
  }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.equal(current.pathname, '/teacher/question-bank/new');
  current.router.push('/teacher/exams/exam/submissions?courseOfferingId=course#attempt', { scroll: false });
  current.router.replace('/teacher/dashboard');
  current.router.prefetch('/teacher/settings/sessions');
  assert.deepEqual(calls, [
    ['push', '/exams/exam/submissions?courseOfferingId=course#attempt', { scroll: false }],
    ['replace', '/dashboard', undefined],
    ['prefetch', '/settings/sessions', undefined],
  ]);
  assert.equal(current.router.back, nativeRouter.back);
  assert.equal(current.router.refresh, nativeRouter.refresh);
  portal = null;
  await act(async () => { renderer.update(React.createElement(Probe)); });
  current.router.push('/teacher/exams');
  assert.deepEqual(calls.at(-1), ['push', '/teacher/exams', undefined]);
});
