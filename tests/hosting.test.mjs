import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostingConfig } from '../server/hosting.mjs';

test('localhost continua sem exigir HTTPS e hospedagem Render usa sua origem pública', () => {
  assert.deepEqual(hostingConfig({}), {
    publicOrigin: '',
    secureCookies: false,
    temporarySaves: false,
  });
  assert.deepEqual(
    hostingConfig({
      RENDER_EXTERNAL_URL: 'https://digla-test.onrender.com/',
      DIGLA_TEMPORARY_SAVES: '1',
    }),
    {
      publicOrigin: 'https://digla-test.onrender.com',
      secureCookies: true,
      temporarySaves: true,
    },
  );
  assert.equal(
    hostingConfig({
      PUBLIC_ORIGIN: 'https://game.example',
      RENDER_EXTERNAL_URL: 'https://other.example',
    }).publicOrigin,
    'https://game.example',
  );
});

test('configuração de origem rejeita credenciais, caminhos e protocolos impróprios', () => {
  for (const origin of [
    'not a url',
    'https://name:password@game.example',
    'https://game.example/path',
    'https://game.example/?key=value',
    'https://game.example/#section',
    'file:///data/game.json',
    'javascript:alert(1)',
  ])
    assert.throws(() => hostingConfig({ PUBLIC_ORIGIN: origin }), /PUBLIC_ORIGIN/);
});
