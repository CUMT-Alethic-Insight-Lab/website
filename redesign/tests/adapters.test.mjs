import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as login } from '../functions/login.js';
import { onRequest as account } from '../functions/account.js';
import { onRequest as recruit } from '../functions/recruitment/[[path]].js';
import { onRequest as admin } from '../functions/admin/recruitment.js';

const origin = 'https://website.test';
const env = { LAB_ORIGIN: 'https://primary.test', STANDBY_ORIGIN: 'https://standby.test' };
const req = (path, options) => new Request(origin + path, options);

test('the copied server adapters preserve route and query contracts', async context => {
  context.mock.method(globalThis, 'fetch', async request => new Response(request.url));
  for (const [handler, path, upstream] of [
    [login, '/login?via=home', '/login?via=home'],
    [account, '/account', '/account'],
    [admin, '/admin/recruitment', '/admin'],
    [recruit, '/recruitment/api/health', '/api/health'],
  ]) {
    const response = await handler({ request: req(path), env });
    assert.equal(await response.text(), env.LAB_ORIGIN + upstream);
  }
  const redirect = await recruit({ request: req('/recruitment?view=list'), env });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), origin + '/recruitment/?view=list');
});

test('primary outage uses standby for reads and never writes there', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async request => new URL(request.url).origin === env.LAB_ORIGIN
    ? new Response(null, { status: 503 })
    : new Response('standby'));
  const read = await account({ request: req('/account'), env });
  assert.equal(await read.text(), 'standby');
  const write = await recruit({ request: req('/recruitment/api/application', { method: 'POST', body: 'test' }), env });
  assert.equal(write.status, 503);
  assert.equal(fetch.mock.callCount(), 3);
});
