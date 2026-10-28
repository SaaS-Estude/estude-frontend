const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { publicPortalPath, workspacePortalPath, publicPortalHref } = loadTypeScript('lib/portal-routes.ts');
const { middleware } = loadTypeScript('middleware.ts');
const { canVisitRoute, routePermission } = loadTypeScript('lib/permissions.ts');

function portalRequest(url) {
  return new NextRequest(url, { headers: { host: new URL(url).host } });
}

function environment(t, values) {
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test('public URLs preserve dynamic routes, query strings and fragments for every portal', () => {
  for (const portal of ['admin', 'teacher', 'student', 'parent']) {
    const internal = `/${portal}/courses/class-one/subject-two?courseOfferingId=course-one&tab=2#lesson`;
    assert.equal(publicPortalPath(internal, portal), '/courses/class-one/subject-two?courseOfferingId=course-one&tab=2#lesson');
    assert.equal(workspacePortalPath('/courses/class-one/subject-two', portal), `/${portal}/courses/class-one/subject-two`);
    assert.equal(publicPortalPath(`/${portal}`, portal), '/dashboard');
    assert.equal(publicPortalPath(`/${portal}/login?password=changed`, portal), '/login?password=changed');
  }
  assert.deepEqual(publicPortalHref({ pathname: '/admin/accounts', query: { page: 3 }, hash: 'selected' }, 'admin'), {
    pathname: '/accounts', query: { page: 3 }, hash: 'selected',
  });
});

test('canonicalization leaves external URLs, API paths and other workspaces intact', () => {
  for (const href of ['https://example.test/admin/accounts', '//example.test/admin/accounts', 'mailto:help@example.test', '#lesson', '/api/v1/admin/accounts', '/administrator/accounts', '/teacher/exams']) {
    assert.equal(publicPortalPath(href, 'admin'), href);
  }
  const external = { protocol: 'https:', hostname: 'example.test', pathname: '/admin/accounts' };
  assert.equal(publicPortalHref(external, 'admin'), external);
  assert.equal(publicPortalPath('/admin/accounts', null), '/admin/accounts');
  for (const path of ['/help', '/about', '/first-login/setup', '/register', '/api/v1/tenant', '/.well-known/estude-domain']) {
    assert.equal(workspacePortalPath(path, 'teacher'), path);
  }
});

test('middleware redirects legacy URLs and rewrites clean ones without a redirect loop', (t) => {
  environment(t, { NODE_ENV: 'production', NEXT_PUBLIC_AUTH_PORTAL: undefined });
  for (const portal of ['admin', 'teacher', 'student', 'parent']) {
    const origin = `https://${portal}-school.estude.io.vn`;
    const legacy = portalRequest(`${origin}/${portal}/courses/class/subject?courseOfferingId=course-two`);
    const redirect = middleware(legacy);
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), `${origin}/courses/class/subject?courseOfferingId=course-two`);
    const rewrite = middleware(portalRequest(redirect.headers.get('location')));
    assert.equal(rewrite.headers.get('location'), null);
    assert.equal(rewrite.headers.get('x-middleware-rewrite'), `${origin}/${portal}/courses/class/subject?courseOfferingId=course-two`);
    assert.equal(rewrite.headers.get('x-middleware-request-x-estude-portal'), portal);
    const login = middleware(portalRequest(`${origin}/login?password=changed`));
    assert.equal(login.headers.get('location'), null);
    assert.equal(login.headers.get('x-middleware-rewrite'), portal === 'student' ? null : `${origin}/${portal}/login?password=changed`);
  }
});

test('local school hosts use the same clean routing and readiness remains accessible', (t) => {
  environment(t, { NODE_ENV: 'development', NEXT_PUBLIC_AUTH_PORTAL: undefined });
  const response = middleware(portalRequest('http://admin-lequydonlequy.localhost:8091/accounts?page=2'));
  assert.equal(response.headers.get('x-middleware-rewrite'), 'http://admin-lequydonlequy.localhost:8091/admin/accounts?page=2');
  const readiness = middleware(portalRequest('http://admin-lequydonlequy.localhost:8091/.well-known/estude-domain'));
  assert.equal(readiness.headers.get('x-middleware-next'), '1');
  assert.equal(readiness.headers.get('location'), null);
  assert.equal(readiness.headers.get('x-middleware-rewrite'), null);
});

test('shared pages, first login, unknown hosts and login identity retain their routing', (t) => {
  environment(t, { NODE_ENV: 'production', NEXT_PUBLIC_AUTH_PORTAL: undefined });
  for (const path of ['/help', '/about', '/first-login/setup']) {
    const response = middleware(portalRequest(`https://teacher-school.estude.io.vn${path}`));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
  const forgot = middleware(portalRequest('https://teacher-school.estude.io.vn/forgot-password'));
  assert.equal(forgot.headers.get('x-middleware-rewrite'), 'https://teacher-school.estude.io.vn/teacher/forgot-password');
  const wrongLogin = middleware(portalRequest('https://teacher-school.estude.io.vn/admin/login'));
  assert.equal(wrongLogin.headers.get('location'), 'https://teacher-school.estude.io.vn/login');
  const marketing = middleware(portalRequest('https://www.example.test/about'));
  assert.equal(marketing.headers.get('x-middleware-next'), '1');
  const root = middleware(portalRequest('https://admin-school.estude.io.vn/'));
  assert.equal(root.headers.get('location'), 'https://admin-school.estude.io.vn/login');
});

test('clean paths resolve to the existing permission checks and never grant another role', () => {
  const admin = workspacePortalPath('/accounts', 'admin');
  assert.equal(routePermission(admin), 'accounts.read');
  assert.equal(canVisitRoute(admin, 'ADMIN', ['accounts.read']), true);
  assert.equal(canVisitRoute(admin, 'ADMIN', []), false);
  assert.equal(canVisitRoute(admin, 'TEACHER', ['accounts.read']), false);
  assert.equal(canVisitRoute(workspacePortalPath('/teacher/exams', 'admin'), 'ADMIN', ['exams.read']), false);
  assert.equal(routePermission(workspacePortalPath('/question-bank/new', 'teacher')), 'questions.create');
  assert.equal(routePermission(workspacePortalPath('/courses/class/subject', 'student')), 'learning.read');
});

test('server redirects generate clean URLs with query and fragment preserved', async (t) => {
  environment(t, { NODE_ENV: 'production', NEXT_PUBLIC_AUTH_PORTAL: undefined });
  const { portalRedirect } = loadTypeScript('lib/portal-redirect.ts', name => {
    if (name === 'next/headers') return { headers: async () => new Headers({ host: 'student-school.estude.io.vn' }) };
    if (name === 'next/navigation') return { redirect: href => { throw new Error(`REDIRECT:${href}`); } };
    return require(name);
  });
  await assert.rejects(portalRedirect('/student/study-coach?materialId=one#exam-review'), { message: 'REDIRECT:/study-coach?materialId=one#exam-review' });
});
