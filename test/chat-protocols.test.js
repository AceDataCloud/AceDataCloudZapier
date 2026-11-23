const assert = require('node:assert/strict');
const { test, before, after, afterEach } = require('node:test');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const app = require('../index');
const catalog = require('./fixtures/chat-protocols.json');
const tester = zapier.createAppTester(app);
const authData = { api_key: 'offline-protocol-token' };
const input = (model) => ({ model, prompt: 'An offline prompt.', system_prompt: 'Be brief.', max_completion_tokens: 16 });
const mockCatalog = (data = catalog) => nock('https://platform.acedata.cloud', { badheaders: ['authorization'] })
  .get('/api/v1/models/').query({ type: 'chat' }).reply(200, data);
before(() => nock.disableNetConnect());
after(() => nock.enableNetConnect());
afterEach(() => { const pending = nock.pendingMocks(); nock.cleanAll(); assert.deepEqual(pending, []); });

const reply = (model, path, body) => {
  assert.equal(body.model, model);
  assert.equal(body.stream, false);
  if (path === '/v1/messages') {
    assert.equal(body.max_tokens, 16);
    assert.equal(body.system, 'Be brief.');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'An offline prompt.' }]);
    assert.ok(!('max_completion_tokens' in body));
    return { id: 'message-result', model, content: [{ type: 'thinking', thinking: 'private reasoning' }, { type: 'text', text: 'Done.' }], stop_reason: 'end_turn', usage: { input_tokens: 3, cache_read_input_tokens: 2, cache_creation_input_tokens: 1, output_tokens: 4 } };
  }
  if (path === '/v1/responses') {
    assert.equal(body.max_output_tokens, 16);
    assert.equal(body.instructions, 'Be brief.');
    assert.deepEqual(body.input, [{ role: 'user', content: 'An offline prompt.' }]);
    return { id: 'response-result', model, status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Done.' }] }], usage: { input_tokens: 6, output_tokens: 4, total_tokens: 10 } };
  }
  assert.equal(path, '/v1/chat/completions');
  assert.equal(body.max_completion_tokens, 16);
  assert.deepEqual(body.messages, [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'An offline prompt.' }]);
  return { id: 'chat-result', model, choices: [{ message: { content: 'Done.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 6, completion_tokens: 4, total_tokens: 10 } };
};

test('all103 candidate models use a declared protocol with one generation and no model substitution', async () => {
  assert.equal(catalog.data.length, 103);
  mockCatalog();
  const choices = await tester(app.creates.send_chat.operation.inputFields[0].choices.perform, { authData, inputData: {} });
  assert.deepEqual(choices.results.map((row) => row.id), catalog.data.map((row) => row.id));
  for (const row of catalog.data) {
    mockCatalog();
    const allowed = row.endpoints.filter((item) => item.auth === 'bearer').map((item) => item.path);
    nock('https://api.acedata.cloud').post((path) => allowed.includes(path))
      .matchHeader('authorization', 'Bearer offline-protocol-token')
      .reply(function (path, body) {
        if (path === '/v1/messages') assert.equal(this.req.headers['anthropic-version'], '2023-06-01');
        return [200, reply(row.id, path, body)];
      });
    const result = await tester(app.creates.send_chat.operation.perform, { authData, inputData: input(row.id) });
    assert.equal(result.model, row.id);
    assert.equal(result.content, 'Done.');
    assert.equal(result.prompt_tokens, 6);
    assert.equal(result.total_tokens, 10);
    assert.ok(!JSON.stringify(result).includes('private reasoning'));
  }
});

test('a declared Responses-only route uses its native request and output shape', async () => {
  const original = catalog.data.find((row) => row.id === 'gpt-6.2-sol');
  const row = { ...original, endpoints: original.endpoints.filter((item) => item.protocol === 'responses') };
  assert.equal(row.endpoints.length, 1);
  mockCatalog({ data: [row] });
  nock('https://api.acedata.cloud').post('/v1/responses').reply((path, body) => [200, reply(row.id, path, body)]);
  const result = await tester(app.creates.send_chat.operation.perform, { authData, inputData: input(row.id) });
  assert.equal(result.content, 'Done.');
});

test('Messages requires an explicit output budget before generation', async () => {
  mockCatalog();
  const data = input('claude-sonnet-5-5'); delete data.max_completion_tokens;
  await assert.rejects(tester(app.creates.send_chat.operation.perform, { authData, inputData: data }), /Set Max completion tokens/);
});

test('missing or untrusted protocol paths never receive a token or generation', async () => {
  for (const endpoints of [undefined, [{ protocol: 'chat_completions', path: 'https://example.invalid/collect', auth: 'bearer' }], [{ protocol: 'chat_completions', path: '/v1/chat/completions', auth: 'api-key' }]]) {
    mockCatalog({ data: [{ id: 'gpt-5.5', type: 'chat', endpoints }] });
    await assert.rejects(tester(app.creates.send_chat.operation.perform, { authData, inputData: input('gpt-5.5') }), /no published compatible protocol/);
  }
});

test('invalid native response bodies produce a safe error', async () => {
  mockCatalog();
  nock('https://api.acedata.cloud').post('/v1/messages').reply(200, { id: 'bad-shape', content: 'not-blocks', private: 'do-not-return' });
  await assert.rejects(tester(app.creates.send_chat.operation.perform, { authData, inputData: input('claude-sonnet-5-5') }), (error) => error.message.includes('returned no chat text') && !error.message.includes('do-not-return'));
});
