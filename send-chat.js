const { chatModels } = require('./lib/catalog');
const PATHS = { chat_completions: '/v1/chat/completions', messages: '/v1/messages', responses: '/v1/responses' };
const getModelChoices = async (z) => ({ results: (await chatModels(z)).map((model) => ({ id: model.id, label: typeof model.label === 'string' ? model.label : model.id })) });

const throwApiError = (z, response) => {
  const traceId = response.data?.trace_id;
  const reference = typeof traceId === 'string' && /^[\da-f-]{36}$/i.test(traceId)
    ? ` Reference: ${traceId}.`
    : '';
  const code = response.data?.error?.code;
  if (code === 'token_mismatched') {
    throw new z.errors.Error('This API token cannot use the selected chat API. Check its API access.', 'TokenMismatched', response.status);
  }
  if (code === 'used_up') {
    throw new z.errors.Error('Your AceDataCloud balance is insufficient. Check your balance in the console.', 'BalanceUsedUp', response.status);
  }
  if (response.status === 401) {
    throw new z.errors.ExpiredAuthError('Your AceDataCloud API token is invalid. Reconnect your account.');
  }
  if (response.status === 429) {
    throw new z.errors.Error('AceDataCloud rate limit reached. Check usage before manually retrying.', 'GenerationRateLimited', 429);
  }
  const messages = {
    400: 'AceDataCloud rejected the request. Check the model and prompt.',
    402: 'AceDataCloud requires payment for this request. Check your account and API token.',
    403: 'AceDataCloud blocked this request or the selected model is unavailable to this token.',
    404: 'The selected chat model is unavailable. Select another model.',
  };
  const message = messages[response.status]
    || 'AceDataCloud could not complete the chat request. Check the request before replaying it.';
  throw new z.errors.Error(`${message}${reference}`, 'ChatRequestFailed', response.status);
};

const perform = async (z, bundle) => {
  const { model, prompt, system_prompt: systemPrompt, max_completion_tokens: maxCompletionTokens } = bundle.inputData;
  if (typeof model !== 'string' || !model.trim() || typeof prompt !== 'string' || !prompt.trim()) {
    throw new z.errors.Error('Select a model and enter a prompt.', 'InvalidData', 400);
  }
  let limit;
  if (maxCompletionTokens !== undefined && maxCompletionTokens !== null && maxCompletionTokens !== '') {
    limit = Number(maxCompletionTokens);
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new z.errors.Error('Max completion tokens must be a positive integer.', 'InvalidData', 400);
    }
  }
  const selected = (await chatModels(z)).find((entry) => entry.id === model);
  const protocol = Object.keys(PATHS).find((name) => selected?.endpoints?.some((endpoint) =>
    endpoint.protocol === name && endpoint.path === PATHS[name] && endpoint.auth === 'bearer'));
  if (!protocol) {
    throw new z.errors.Error('The selected model has no published compatible protocol. Refresh the model catalog before running this action.', 'ModelProtocolUnavailable');
  }
  const hasSystem = typeof systemPrompt === 'string' && systemPrompt.trim();
  const messages = [{ role: 'user', content: prompt }];
  const body = { model, stream: false };
  if (protocol === 'messages') {
    if (!limit) throw new z.errors.Error('Set Max completion tokens for this model.', 'InvalidData', 400);
    body.messages = messages;
    body.max_tokens = limit;
    if (hasSystem) body.system = systemPrompt;
  } else if (protocol === 'responses') {
    body.input = messages;
    if (hasSystem) body.instructions = systemPrompt;
    if (limit) body.max_output_tokens = limit;
  } else {
    body.messages = hasSystem ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
    if (limit) body.max_completion_tokens = limit;
  }

  const response = await z.request({
    url: `https://api.acedata.cloud${PATHS[protocol]}`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bundle.authData.api_key}`,
      'Content-Type': 'application/json',
      ...(protocol === 'messages' ? { 'anthropic-version': '2023-06-01' } : {}),
    },
    body,
    skipThrowForStatus: true,
    // Core >=18 otherwise throws on 429 before our safe error mapping runs.
    throwForThrottlingEarly: false,
  });
  if (response.status >= 400) {
    throwApiError(z, response);
  }
  const data = response.data;
  const choice = data?.choices?.[0];
  let content;
  let finishReason;
  let usage;
  if (protocol === 'messages') {
    content = (Array.isArray(data?.content) ? data.content : []).filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('');
    finishReason = data?.stop_reason;
    const input = data?.usage?.input_tokens;
    const cache = ['cache_creation_input_tokens', 'cache_read_input_tokens'].reduce((sum, key) => sum + (Number.isSafeInteger(data?.usage?.[key]) ? data.usage[key] : 0), 0);
    usage = { prompt_tokens: Number.isSafeInteger(input) ? input + cache : undefined, completion_tokens: data?.usage?.output_tokens };
  } else if (protocol === 'responses') {
    content = data?.output_text || (Array.isArray(data?.output) ? data.output : []).flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .filter((block) => block?.type === 'output_text' && typeof block.text === 'string').map((block) => block.text).join('');
    finishReason = data?.status;
    usage = { prompt_tokens: data?.usage?.input_tokens, completion_tokens: data?.usage?.output_tokens, total_tokens: data?.usage?.total_tokens };
  } else {
    content = choice?.message?.content || choice?.message?.refusal;
    finishReason = choice?.finish_reason;
    usage = data?.usage || {};
  }
  if (typeof data?.id !== 'string' || typeof content !== 'string' || !content) {
    throw new z.errors.Error('AceDataCloud returned no chat text. Check the model and try a different prompt.', 'InvalidResponse');
  }
  const result = { id: data.id, content, model: data.model, finish_reason: finishReason };
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    if (Number.isSafeInteger(usage[key])) result[key] = usage[key];
  }
  if (result.total_tokens === undefined && Number.isSafeInteger(result.prompt_tokens) && Number.isSafeInteger(result.completion_tokens)) {
    result.total_tokens = result.prompt_tokens + result.completion_tokens;
  }
  if (Number.isFinite(data.created)) result.created_at = new Date(data.created * 1000).toISOString();
  return result;
};

module.exports = {
  key: 'send_chat',
  noun: 'Chat Response',
  display: {
    label: 'Create Chat Response',
    description: 'Creates a text response from a chat model. Each test and Zap run uses your AceDataCloud balance.',
  },
  operation: {
    cleanInputData: false,
    inputFields: [
      {
        key: 'model', label: 'Model', type: 'string', required: true,
        choices: { perform: getModelChoices },
        helpText: 'Choose a chat model from the current AceDataCloud catalog.',
      },
      { key: 'prompt', label: 'Prompt', type: 'text', required: true },
      { key: 'system_prompt', label: 'System instructions', type: 'text', required: false },
      {
        key: 'max_completion_tokens', label: 'Max completion tokens', type: 'integer', required: false,
        helpText: 'Set an output token limit. Some models require this value; it does not cap input tokens or total cost.',
      },
    ],
    perform,
    sample: {
      id: 'chatcmpl-example', content: 'Hello! How can I help?', model: 'gpt-5.5',
      finish_reason: 'stop', created_at: '2026-10-06T00:00:00.000Z',
    },
    outputFields: [
      { key: 'id', label: 'Response ID' },
      { key: 'content', label: 'Response text' },
      { key: 'model', label: 'Model' },
      { key: 'finish_reason', label: 'Finish reason' },
      { key: 'prompt_tokens', label: 'Input tokens', type: 'integer' },
      { key: 'completion_tokens', label: 'Output tokens', type: 'integer' },
      { key: 'total_tokens', label: 'Total tokens', type: 'integer' },
      { key: 'created_at', label: 'Created at', type: 'datetime' },
    ],
  },
};
