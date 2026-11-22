const assert = require('node:assert/strict');
const { test, before, after, beforeEach, afterEach } = require('node:test');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const app = require('../index');
const { mockCatalogs, contracts } = require('./catalog-fixture');
const tester = zapier.createAppTester(app);
const authData = { api_key: 'offline-coverage-token' };
const entries = [
  ['generate_gpt_image', '8f01fe72-8a3e-4872-8d8d-330cde179b3a', '/openai/images/generations', 24],
  ['generate_seedance_video', '0083b874-4da6-40df-87e3-835b1300c1e8', '/seedance/videos', 9],
  ['generate_happyhorse_video', 'd656e357-50cb-4390-b8c9-67464bc2a2f2', '/happyhorse/videos', 7],
  ['generate_nano_banana_image', '9d8a117e-31ca-4322-a0fd-1771296ec610', '/nano-banana/images', 9],
  ['generate_suno_music', '09a26295-5972-4392-9318-dcd9b218f90d', '/suno/audios', 10],
];
const schema = (api, path) => contracts[api].definition.paths[path].post.requestBody.content['application/json'].schema;
before(() => nock.disableNetConnect());
after(() => nock.enableNetConnect());
beforeEach(mockCatalogs);
afterEach(() => { const pending = nock.pendingMocks(); nock.cleanAll(); assert.deepEqual(pending, []); });

for (const [key, api, path, count] of entries) {
  test(`${key}: every published model can be selected and submitted without substitution`, async () => {
    const models = schema(api, path).properties.model.enum;
    assert.equal(models.length, count);
    const action = app.creates[key];
    const field = action.operation.inputFields.find((item) => item.key === 'model');
    const choices = await tester(field.choices.perform, { authData, inputData: {} });
    assert.deepEqual(choices.results.map((item) => item.id), models);
    for (const [index, model] of models.entries()) {
      const inputData = { model, prompt: 'Offline contract fixture.' };
      if (key.includes('nano_banana')) inputData.action = 'generate';
      if (model.includes('-lite-i2v-')) inputData.image_url = 'https://example.com/first.png';
      if (key.includes('happyhorse')) {
        if (model.endsWith('-i2v')) { inputData.action = 'image_to_video'; inputData.image_url = 'https://example.com/first.png'; }
        else if (model.endsWith('-r2v')) { inputData.action = 'reference_to_video'; inputData.image_urls = ['https://example.com/reference.png']; }
        else if (model.endsWith('-video-edit')) { inputData.action = 'video_edit'; inputData.video_url = 'https://example.com/original.mp4'; }
      }
      nock('https://api.acedata.cloud').post(path, (body) => {
        assert.equal(body.model, model);
        assert.equal(body.async, true);
        assert.equal(typeof body.callback_url, 'string');
        for (const property of ['action', 'image_url', 'image_urls', 'video_url']) {
          if (inputData[property] !== undefined) {
            if (key.includes('seedance') && property === 'image_url') {
              assert.deepEqual(body.content.find((item) => item.type === 'image_url'), { type: 'image_url', role: 'first_frame', image_url: { url: inputData.image_url } });
            } else assert.deepEqual(body[property], inputData[property]);
          }
        }
        return true;
      }).matchHeader('authorization', 'Bearer offline-coverage-token').reply(200, { task_id: `offline-${index}` });
      const result = await tester(action.operation.perform, { authData, inputData });
      assert.equal(result.task_id, `offline-${index}`);
      assert.equal(result.status, 'pending');
    }
  });
}

test('GPT Image exposes all qualities and sends published compatible/2.6 values', async () => {
  const action = app.creates.generate_gpt_image;
  const choices = await tester(action.operation.inputFields.find((field) => field.key === 'quality').choices.perform, { authData, inputData: {} });
  assert.deepEqual(choices.results.map((item) => item.id), ['auto', 'high', 'medium', 'low', 'xhigh', 'max', 'hd', 'standard']);
  for (const inputData of [
    { model: 'gpt-image-2.6-flare:reverse', quality: 'max', size: '3840x2160' },
    { model: 'dall-e-2', quality: 'standard', size: '256x256' },
    { model: 'dall-e-3', quality: 'hd', size: '1792x1024', n: 1 },
    { model: 'gpt-image-1.5', size: '1024x1024' },
  ]) {
    inputData.prompt = 'Offline fixture.';
    nock('https://api.acedata.cloud').post('/openai/images/generations', (body) => {
      for (const [key, value] of Object.entries(inputData)) assert.deepEqual(body[key], value);
      return true;
    }).reply(200, { task_id: 'quality-fixture' });
    await tester(action.operation.perform, { authData, inputData });
  }
  await assert.rejects(tester(action.operation.perform, { authData, inputData: { model: 'dall-e-3', prompt: 'fixture', n: 2 } }));
});

test('missing catalog or unsupported mapped model never sends a generation', async () => {
  const catalog = require('../lib/catalog');
  await assert.rejects(catalog.requestSchema({ errors: zapier.errors, request: async () => ({ status: 503, data: {} }) }, 'id', '/path'), /catalog could not be loaded/);
  await assert.rejects(tester(app.creates.generate_gpt_image.operation.perform, { authData, inputData: { model: 'unpublished-model', prompt: 'fixture' } }), /supported GPT Image model/);
});

test('compatible image aliases retain same-ID recovery and omit private fields', async () => {
  nock('https://api.acedata.cloud').post('/openai/tasks', { action: 'retrieve', id: 'image-task' }).reply(200, {
    id: 'image-task', finished_at: 1, request: { model: 'nano-banana-2.1', private: 'do-not-return' },
    response: { success: true, data: [{ image_url: 'https://example.com/final.png' }] },
  });
  const result = await tester(app.creates.retrieve_gpt_image_task.operation.perform, { authData, inputData: { task_id: 'image-task' } });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.image_url, 'https://example.com/final.png');
  assert.ok(!JSON.stringify(result).includes('do-not-return'));
});
