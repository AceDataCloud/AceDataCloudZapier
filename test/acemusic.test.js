const assert = require('node:assert/strict');
const { test, before, after, afterEach } = require('node:test');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const app = require('../index');
const run = zapier.createAppTester(app);
const api = 'https://api.acedata.cloud';
const authData = { api_key: 'fixture', connection_name: 'Private' };
before(() => nock.disableNetConnect());
after(() => nock.enableNetConnect());
afterEach(() => { const pending = nock.pendingMocks(); nock.cleanAll(); assert.deepEqual(pending, []); });

test('submit once with callback and no Suno fields', async () => {
  nock(api).post('/acemusic/audios', body => {
    assert.ok(body.callback_url);
    assert.deepEqual(Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'callback_url')),
      { action: 'generate', custom: false, model: 'acemusic-v1.1', prompt: 'piano', async: true });
    return true;
  }).reply(202, { task_id: 't1' });
  const result = await run(app.creates.generate_acemusic_song.operation.perform, { authData, inputData: { prompt: 'piano' } });
  assert.equal(result.task_id, 't1');
});
test('resume uses authenticated lookup and keeps only delivered tracks on partial completion', async () => {
  const path = 'https://media.example/finished.mp3';
  nock(api).post('/acemusic/tasks', { action: 'retrieve', id: 't1' }).matchHeader('authorization', 'Bearer fixture')
    .reply(200, { id: 't1', status: 'partial_failed', response: { task_id: 't1', status: 'partial_failed',
      data: [{ state: 'succeeded', audio_url: path }, { state: 'failed', audio_url: 'https://preview.example/bad.mp3' }] } });
  const result = await run(app.creates.generate_acemusic_song.operation.performResume,
    { authData, outputData: { task_id: 't1' }, cleanedRequest: { task_id: 't1', audio_url: 'https://example.com/unverified' } });
  assert.deepEqual(result.audio_urls, [path]); assert.equal(result.success, false); assert.equal(result.status, 'partial_failed');
});
test('mismatched callback and duplicate reference IDs never submit', async () => {
  await assert.rejects(run(app.creates.blend_acemusic_tracks.operation.perform, { authData, inputData: {
    audio_id: 'same', second_audio_id: 'same', lyric: 'test', style: 'folk' } }), /distinct/);
  await assert.rejects(run(app.creates.generate_acemusic_song.operation.performResume,
    { authData, outputData: { task_id: 't1' }, cleanedRequest: { task_id: 'other' } }), /does not match/);
});
