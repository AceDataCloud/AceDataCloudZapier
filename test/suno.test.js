const assert = require('node:assert/strict');
const { test, before, after, afterEach } = require('node:test');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const app = require('../index');
const tester = zapier.createAppTester(app);
const bundle = {
  authData: { api_key: 'offline-only-token', connection_name: 'Work' },
  inputData: { model: 'chirp-v6', prompt: 'A gentle instrumental piano melody.', instrumental: true },
};
const id = 'original-suno-task';
const finishedRecord = (overrides = {}) => ({
  id, finished_at: 1760000000,
  response: {
    success: true, task_id: id,
    data: [{ id: 'track-1', title: 'Piano', model: 'chirp-v6', state: 'succeeded',
      audio_url: 'https://example.com/piano.mp3', duration: 24,
      created_at: '2026-10-18T00:00:00Z' }],
  },
  ...overrides,
});
const taskMock = (record) => nock('https://api.acedata.cloud')
  .post('/suno/tasks', { action: 'retrieve', id })
  .matchHeader('authorization', 'Bearer offline-only-token').reply(200, record);

before(() => nock.disableNetConnect());
after(() => nock.enableNetConnect());
afterEach(() => {
  const pending = nock.pendingMocks(); nock.cleanAll(); assert.deepEqual(pending, []);
});

test('native Suno action submits once with Zapier callback and returns only pending task identity', async () => {
  const submitted = nock('https://api.acedata.cloud')
    .post('/suno/audios', (body) => {
      assert.equal(body.action, 'generate'); assert.equal(body.model, 'chirp-v6');
      assert.equal(body.prompt, bundle.inputData.prompt); assert.equal(body.instrumental, true);
      assert.equal(body.custom, false); assert.equal(body.async, true);
      assert.match(body.callback_url, /^https:\/\//);
      assert.equal(Object.keys(body).length, 7); return true;
    })
    .matchHeader('authorization', 'Bearer offline-only-token')
    .reply(200, { task_id: id, data: [{ audio_url: 'https://example.com/preview.mp3', state: 'pending' }] });
  const result = await tester(app.creates.generate_suno_music.operation.perform, bundle);
  assert.deepEqual(result, { id, task_id: id, status: 'pending', success: false });
  assert.equal(submitted.isDone(), true);
  assert.ok(!JSON.stringify(result).includes('callback'));
});

test('callback resumes by retrieving the same ID and ignores untrusted callback media', async () => {
  taskMock(finishedRecord());
  const result = await tester(app.creates.generate_suno_music.operation.performResume, {
    ...bundle, outputData: { id, task_id: id, status: 'pending' },
    cleanedRequest: { task_id: id, success: true, data: [{ audio_url: 'https://untrusted.example/fake.mp3' }] },
  });
  assert.equal(result.status, 'succeeded'); assert.equal(result.success, true);
  assert.deepEqual(result.audio_urls, ['https://example.com/piano.mp3']);
  assert.equal(result.tracks[0].created_at, '2026-10-18T00:00:00.000Z');
  assert.ok(!JSON.stringify(result).includes('untrusted'));
  assert.ok(!JSON.stringify(result).includes(bundle.authData.api_key));
});

test('mismatched callback cannot resume another task or make an API request', async () => {
  await assert.rejects(tester(app.creates.generate_suno_music.operation.performResume, {
    ...bundle, outputData: { task_id: id }, cleanedRequest: { task_id: 'another-task' },
  }), /callback does not match/);
});

test('pending task with playable previews never exposes final audio or succeeds', async () => {
  const pending = { id, response: { success: true,
    data: [{ state: 'running', audio_url: 'https://example.com/preview.mp3' }] } };
  taskMock(pending);
  const result = await tester(app.creates.retrieve_suno_task.operation.perform, {
    ...bundle, inputData: { task_id: id },
  });
  assert.equal(result.status, 'pending'); assert.equal(result.success, false);
  assert.deepEqual(result.audio_urls, []); assert.deepEqual(result.tracks, []);
  assert.ok(!('audio_url' in result));
  taskMock(pending);
  await assert.rejects(tester(app.creates.generate_suno_music.operation.performResume, {
    ...bundle, outputData: { task_id: id }, cleanedRequest: { task_id: id },
  }), /task is pending/);
});

test('terminal failure and empty results cannot be mistaken for generation success', async () => {
  taskMock(finishedRecord({ response: { success: false,
    error: { message: 'private upstream detail' }, data: [] } }));
  const result = await tester(app.creates.retrieve_suno_task.operation.perform, {
    ...bundle, inputData: { task_id: id },
  });
  assert.equal(result.status, 'failed'); assert.equal(result.success, false);
  assert.ok(!JSON.stringify(result).includes('private upstream'));
  taskMock(finishedRecord({ response: { success: true, data: [] } }));
  const noAudio = await tester(app.creates.retrieve_suno_task.operation.perform, {
    ...bundle, inputData: { task_id: id },
  });
  assert.equal(noAudio.status, 'pending'); assert.deepEqual(noAudio.audio_urls, []);
});

test('completion requires terminal evidence and valid HTTPS media, not outer success', async () => {
  for (const record of [
    { id, response: { success: true, data: [{ audio_url: 'https://example.com/preview.mp3' }] } },
    finishedRecord({ response: { success: true, data: [{ state: 'succeeded', audio_url: 'javascript:bad' }] } }),
    finishedRecord({ response: { success: true, data: [{ state: 'running', audio_url: 'https://example.com/preview.mp3' }] } }),
    finishedRecord({ state: 'running' }),
  ]) {
    taskMock(record);
    const result = await tester(app.creates.retrieve_suno_task.operation.perform, { ...bundle, inputData: { task_id: id } });
    assert.equal(result.success, false); assert.deepEqual(result.audio_urls, []);
  }
  taskMock({ id, response: { success: true, data: [{ state: 'succeeded', audio_url: 'https://example.com/final.mp3' }] } });
  const final = await tester(app.creates.retrieve_suno_task.operation.perform, { ...bundle, inputData: { task_id: id } });
  assert.equal(final.status, 'succeeded');
});

test('task API ID mismatch and raw request/credential metadata never escape', async () => {
  taskMock(finishedRecord({ id: 'another-task' }));
  await assert.rejects(tester(app.creates.retrieve_suno_task.operation.perform, {
    ...bundle, inputData: { task_id: id },
  }), /task ID does not match/);
  taskMock(finishedRecord({ response: { success: true, task_id: 'another-task', data: [] } }));
  await assert.rejects(tester(app.creates.retrieve_suno_task.operation.perform, {
    ...bundle, inputData: { task_id: id },
  }), /saved response does not match/);
  taskMock(finishedRecord({ request: { callback_url: 'https://secret.example/callback' },
    user_id: 'private-user', credential_id: 'private-credential' }));
  const result = await tester(app.creates.retrieve_suno_task.operation.perform, { ...bundle, inputData: { task_id: id } });
  for (const value of ['callback', 'private-user', 'private-credential']) assert.ok(!JSON.stringify(result).includes(value));
});

test('validation rejects invalid prompts, models, boolean values and task IDs before network', async () => {
  for (const inputData of [
    { ...bundle.inputData, prompt: ' ' },
    { ...bundle.inputData, prompt: 'x'.repeat(501) },
    { ...bundle.inputData, model: 'not-a-model' },
    { ...bundle.inputData, instrumental: 'false' },
  ]) await assert.rejects(tester(app.creates.generate_suno_music.operation.perform, { ...bundle, inputData }), /prompt|model|Instrumental/);
  await assert.rejects(tester(app.creates.retrieve_suno_task.operation.perform, {
    ...bundle, inputData: { task_id: 'https://attacker.example/' },
  }), /original Ace Data Cloud task ID/);
});

test('Suno rate limits, auth, balance and moderation use safe Zapier errors without retrying in app', async () => {
  for (const [status, data, match] of [
    [401, {}, /token is invalid/],
    [401, { error: { code: 'token_mismatched', message: 'private detail' } }, /Allowed APIs/],
    [403, { error: { code: 'used_up', message: 'private detail' } }, /balance is insufficient/],
    [403, { error: { code: 'forbidden', message: 'private detail' } }, /blocked the Suno request/],
    [500, { error: { message: 'private detail' } }, /original task before replaying/],
  ]) {
    nock('https://api.acedata.cloud').post('/suno/audios').reply(status, data);
    await assert.rejects(tester(app.creates.generate_suno_music.operation.perform, bundle), (error) => {
      assert.match(error.message, match); assert.ok(!error.message.includes('private detail')); return true;
    });
  }
  nock('https://api.acedata.cloud').post('/suno/audios').reply(429, {}, { 'Retry-After': '9' });
  await assert.rejects(tester(app.creates.generate_suno_music.operation.perform, bundle), (error) => {
    assert.equal(error.name, 'AppError'); assert.equal(JSON.parse(error.message).code, 'GenerationRateLimited'); return true;
  });
});


test('Suno recovery query can be throttle-retried without resubmitting generation', async () => {
  nock('https://api.acedata.cloud').post('/suno/tasks', { action: 'retrieve', id })
    .reply(429, {}, { 'Retry-After': '11' });
  await assert.rejects(tester(app.creates.retrieve_suno_task.operation.perform, {
    ...bundle, inputData: { task_id: id },
  }), (error) => {
    assert.equal(error.name, 'ThrottledError'); assert.equal(JSON.parse(error.message).delay, 11); return true;
  });
});
