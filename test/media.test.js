const assert = require('node:assert/strict');
const { test, before, after, afterEach } = require('node:test');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const app = require('../index');
const tester = zapier.createAppTester(app);
const authData = { api_key: 'offline-media-token', connection_name: 'Do not forward' };
const cases = [
  { key: 'seedance_video', service: 'seedance', path: '/seedance/videos', tasks: '/seedance/tasks', video: true,
    input: { model: 'doubao-seedance-2-0-fast-260128', prompt: 'A small boat on a calm lake.', duration: 5, resolution: '720p', ratio: '16:9' },
    body: { model: 'doubao-seedance-2-0-fast-260128', content: [{ type: 'text', text: 'A small boat on a calm lake.' }], duration: 5, resolution: '720p', ratio: '16:9' },
    result: { id: 'result-seedance', model: 'doubao-seedance-2-0-fast-260128', status: 'succeeded', content: { video_url: 'https://example.com/seedance.mp4' } } },
  { key: 'happyhorse_video', service: 'happyhorse', path: '/happyhorse/videos', tasks: '/happyhorse/tasks', video: true,
    input: { model: 'happyhorse-1.1-t2v', prompt: 'A horse in morning light.', duration: 5, resolution: '720P' },
    body: { action: 'generate', model: 'happyhorse-1.1-t2v', prompt: 'A horse in morning light.', duration: 5, resolution: '720P' },
    result: [{ id: 'result-horse', state: 'succeeded', video_url: 'https://example.com/horse.mp4' }] },
  { key: 'gpt_image', service: 'gpt-image', path: '/openai/images/generations', tasks: '/openai/tasks',
    input: { model: 'gpt-image-2', prompt: 'A blue ceramic cup.', size: '1024x1024', n: 2, quality: 'low' },
    body: { model: 'gpt-image-2', prompt: 'A blue ceramic cup.', size: '1024x1024', n: 2, quality: 'low' },
    result: [{ url: 'https://example.com/cup-1.png' }, { url: 'https://example.com/cup-2.png' }] },
  { key: 'nano_banana_image', service: 'nano-banana', path: '/nano-banana/images', tasks: '/nano-banana/tasks',
    input: { action: 'edit', model: 'nano-banana-2', prompt: 'Make the background blue.', image_urls: ['https://example.com/input.png'], count: 1, resolution: '2K' },
    body: { action: 'edit', model: 'nano-banana-2', prompt: 'Make the background blue.', image_urls: ['https://example.com/input.png'], count: 1, resolution: '2K' },
    result: [{ image_url: 'https://example.com/edited.png' }] },
];
const task = (c, extra = {}) => ({
  id: `original-${c.service}`, finished_at: 1760000000,
  request: { model: c.input.model, callback_url: 'https://private.example/callback', prompt: 'private prompt' },
  user_id: 'private-user', credential_id: 'private-credential',
  response: { success: true, task_id: `original-${c.service}`, data: c.result }, ...extra,
});
const read = (c, record) => nock('https://api.acedata.cloud')
  .post(c.tasks, { action: 'retrieve', id: `original-${c.service}` })
  .matchHeader('authorization', 'Bearer offline-media-token').reply(200, record);

before(() => nock.disableNetConnect());
after(() => nock.enableNetConnect());
afterEach(() => { const pending = nock.pendingMocks(); nock.cleanAll(); assert.deepEqual(pending, []); });

for (const c of cases) {
  test(`${c.service}: one native submission preserves fields/model and returns no preview media`, async () => {
    nock('https://api.acedata.cloud').post(c.path, (body) => {
      const { callback_url: callback, async, ...rest } = body;
      assert.match(callback, /^https:/); assert.equal(async, true); assert.deepEqual(rest, c.body); return true;
    }).matchHeader('authorization', 'Bearer offline-media-token')
      .reply(200, { task_id: `original-${c.service}`, data: c.result });
    const result = await tester(app.creates[`generate_${c.key}`].operation.perform, { authData, inputData: c.input });
    assert.deepEqual(result, { id: `original-${c.service}`, task_id: `original-${c.service}`, status: 'pending', success: false });
  });

  test(`${c.service}: callback media ignored, same authenticated ID produces only final allowlisted fields`, async () => {
    read(c, task(c));
    const result = await tester(app.creates[`generate_${c.key}`].operation.performResume, {
      authData, inputData: c.input, outputData: { task_id: `original-${c.service}` },
      cleanedRequest: { task_id: `original-${c.service}`, data: [{ url: 'https://attacker.example/fake.png' }] },
    });
    assert.equal(result.status, 'succeeded'); assert.equal(result.success, true);
    assert.equal(result.media_urls.length, c.service === 'gpt-image' ? 2 : 1);
    assert.equal(result[c.video ? 'video_url' : 'image_url'], result.media_urls[0]);
    for (const secret of ['private-', 'callback', 'attacker', 'offline-media-token', 'Do not forward']) {
      assert.ok(!JSON.stringify(result).includes(secret));
    }
  });

  test(`${c.service}: pending previews, empty completion and failures never expose media`, async () => {
    for (const record of [
      task(c, { state: 'running' }),
      task(c, { response: { success: true, data: c.result }, finished_at: null, state: 'running' }),
      task(c, { response: { success: true, data: [] } }),
      task(c, { response: { success: false, error: { message: 'private upstream detail' } } }),
    ]) {
      read(c, record);
      const result = await tester(app.creates[`retrieve_${c.key}_task`].operation.perform, {
        authData, inputData: { task_id: `original-${c.service}` },
      });
      assert.equal(result.success, false); assert.deepEqual(result.media_urls, []); assert.deepEqual(result.items, []);
      assert.ok(!('image_url' in result)); assert.ok(!('video_url' in result));
      assert.ok(!JSON.stringify(result).includes('upstream'));
    }
  });

  test(`${c.service}: wrong callback/record IDs cannot resume or query a different task`, async () => {
    await assert.rejects(tester(app.creates[`generate_${c.key}`].operation.performResume, {
      authData, outputData: { task_id: `original-${c.service}` }, cleanedRequest: { task_id: 'other-task' },
    }), /callback does not match/);
    read(c, task(c, { id: 'different-task' }));
    await assert.rejects(tester(app.creates[`retrieve_${c.key}_task`].operation.perform, {
      authData, inputData: { task_id: `original-${c.service}` },
    }), /task ID does not match/);
  });
}

test('Seedance native form enforces model-specific duration, resolution, audio and first-frame requirements', async () => {
  const c = cases[0]; const run = (inputData) => tester(app.creates.generate_seedance_video.operation.perform, { authData, inputData });
  for (const input of [
    { ...c.input, duration: 3 }, { ...c.input, duration: 16 }, { ...c.input, resolution: '1080p' },
    { ...c.input, model: 'doubao-seedance-1-0-pro-250528', duration: -1 },
    { ...c.input, model: 'doubao-seedance-1-5-pro-251215', duration: 13 },
    { ...c.input, model: 'doubao-seedance-2-5-260628', duration: 31 },
    { ...c.input, model: 'doubao-seedance-1-0-lite-i2v-250428' },
    { ...c.input, model: 'doubao-seedance-1-0-lite-t2v-250428', image_url: 'https://example.com/image.png' },
    { ...c.input, model: 'doubao-seedance-1-0-pro-250528', generate_audio: false },
    { ...c.input, prompt: 'x'.repeat(1001) }, { ...c.input, image_url: 'http://example.com/image.png' },
  ]) await assert.rejects(run(input));
  const input = { ...c.input, model: 'doubao-seedance-2-5-260628', duration: -1,
    image_url: 'https://example.com/first.png', generate_audio: false };
  nock('https://api.acedata.cloud').post(c.path, (body) => {
    assert.deepEqual(body.content[1], { type: 'image_url', role: 'first_frame', image_url: { url: input.image_url } });
    assert.equal(body.duration, -1); assert.equal(body.generate_audio, false); return true;
  }).reply(200, { task_id: 'original-seedance' });
  await run(input);
});

test('HappyHorse native action restricts to text-to-video models and exact resolution casing', async () => {
  for (const inputData of [
    { model: 'happyhorse-1.1-i2v', prompt: 'text' },
    { model: 'happyhorse-1.1-t2v', prompt: 'text', resolution: '720p' },
    { model: 'happyhorse-1.1-t2v', prompt: 'text', duration: 2 },
    { model: 'happyhorse-1.1-t2v', prompt: ' ' },
  ]) await assert.rejects(tester(app.creates.generate_happyhorse_video.operation.perform, { authData, inputData }));
});

test('GPT Image validates sizes and counts without inventing image edit or alternate provider fallback', async () => {
  for (const inputData of [
    { model: 'nano-banana', prompt: 'test' },
    { model: 'gpt-image-2', prompt: 'test', n: 0 },
    { model: 'gpt-image-2', prompt: 'test', n: 11 },
    { model: 'gpt-image-2', prompt: 'test', size: '1000x1000' },
    { model: 'gpt-image-2', prompt: 'test', size: '4096x4096' },
    { model: 'gpt-image-2', prompt: 'test', size: '16x16' },
    { model: 'gpt-image-1.5', prompt: 'test', size: '1024x1024' },
  ]) await assert.rejects(tester(app.creates.generate_gpt_image.operation.perform, { authData, inputData }));
  read(cases[2], task(cases[2], { request: { model: 'nano-banana' } }));
  await assert.rejects(tester(app.creates.retrieve_gpt_image_task.operation.perform, {
    authData, inputData: { task_id: 'original-gpt-image' },
  }), /not from the selected media service/);
});

test('Nano Banana edit requires reference URLs and obeys model resolution and image count', async () => {
  for (const inputData of [
    { action: 'edit', model: 'nano-banana-2', prompt: 'test' },
    { action: 'edit', model: 'nano-banana-2', prompt: 'test', image_urls: ['https://user:secret@example.com/a.png'] },
    { action: 'generate', model: 'nano-banana-2', prompt: 'test', image_urls: ['https://example.com/a.png'] },
    { action: 'generate', model: 'nano-banana-2-lite', prompt: 'test', resolution: '4K' },
    { action: 'generate', model: 'nano-banana', prompt: 'test', resolution: '2K' },
    { action: 'generate', model: 'nano-banana-2', prompt: 'test', count: 5 },
  ]) await assert.rejects(tester(app.creates.generate_nano_banana_image.operation.perform, { authData, inputData }));
  nock('https://api.acedata.cloud').post('/nano-banana/images', (body) => {
    assert.equal(body.count, 4); assert.equal(body.resolution, '4K'); assert.ok(!('image_urls' in body)); return true;
  }).reply(200, { task_id: 'original-nano-banana' });
  await tester(app.creates.generate_nano_banana_image.operation.perform, {
    authData, inputData: { action: 'generate', model: 'nano-banana-2.1', prompt: 'test', count: 4, resolution: '4K' },
  });
});

test('all media services classify auth/access/moderation/balance errors without leaking raw detail', async () => {
  for (const c of cases) {
    for (const [status, data, pattern] of [
      [401, {}, /token is invalid/],
      [401, { error: { code: 'token_mismatched', message: 'private provider detail' } }, /Allowed APIs/],
      [403, { error: { code: 'used_up', message: 'private provider detail' } }, /balance is insufficient/],
      [403, { error: { message: 'private provider detail' } }, /blocked/],
      [500, { error: { message: 'private provider detail' } }, /original task before replaying/],
    ]) {
      nock('https://api.acedata.cloud').post(c.path).reply(status, data);
      await assert.rejects(tester(app.creates[`generate_${c.key}`].operation.perform, { authData, inputData: c.input }), (error) => {
        assert.match(error.message, pattern); assert.ok(!error.message.includes('private provider detail')); return true;
      });
    }
  }
});


test('media generation 429 never opts into Zapier throttle replay; only existing task queries may be retried', async () => {
  for (const c of cases) {
    nock('https://api.acedata.cloud').post(c.path).reply(429, {}, { 'Retry-After': '7' });
    await assert.rejects(tester(app.creates[`generate_${c.key}`].operation.perform, { authData, inputData: c.input }), (error) => {
      assert.equal(error.name, 'AppError'); assert.equal(JSON.parse(error.message).code, 'GenerationRateLimited'); return true;
    });
    nock('https://api.acedata.cloud').post(c.tasks).reply(429, {}, { 'Retry-After': '7' });
    await assert.rejects(tester(app.creates[`retrieve_${c.key}_task`].operation.perform, {
      authData, inputData: { task_id: `original-${c.service}` },
    }), (error) => {
      assert.equal(error.name, 'ThrottledError'); assert.equal(JSON.parse(error.message).delay, 7); return true;
    });
  }
});

test('media resume pending/failure stops downstream; missing, unsafe or base64-only media stays unavailable', async () => {
  for (const c of cases) {
    read(c, task(c, { state: 'running' }));
    await assert.rejects(tester(app.creates[`generate_${c.key}`].operation.performResume, {
      authData, outputData: { task_id: `original-${c.service}` }, cleanedRequest: { task_id: `original-${c.service}` },
    }), /task is pending/);
    read(c, task(c, { response: { success: false, error: { message: 'hidden provider failure' } } }));
    await assert.rejects(tester(app.creates[`generate_${c.key}`].operation.performResume, {
      authData, outputData: { task_id: `original-${c.service}` }, cleanedRequest: { task_id: `original-${c.service}` },
    }), /task is failed/);
    read(c, task(c, { response: { success: true, data: [{ state: 'succeeded', status: 'succeeded',
      url: 'https://user:secret@example.com/result.png', image_url: 'javascript:bad', video_url: 'http://example.com/result.mp4',
      content: { video_url: 'http://example.com/preview.mp4' }, b64_json: 'private-base64' }] } }));
    const result = await tester(app.creates[`retrieve_${c.key}_task`].operation.perform, { authData, inputData: { task_id: `original-${c.service}` } });
    assert.equal(result.success, false); assert.deepEqual(result.media_urls, []);
  }
});
