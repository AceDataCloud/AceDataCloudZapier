const API_URL = 'https://api.acedata.cloud';
const SUCCEEDED = new Set(['succeeded', 'complete', 'completed']);
const FAILED = new Set(['failed', 'error', 'cancelled', 'canceled', 'expired']);
const invalid = (z, message) => { throw new z.errors.Error(message, 'InvalidData', 400); };
const taskId = (z, value) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid(z, 'Use the original Ace task ID from this service.');
  return value;
};
const secureUrl = (value) => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? value : undefined;
  } catch { return undefined; }
};
const request = async (z, bundle, config, path, body) => {
  const response = await z.request({
    url: `${API_URL}${path}`, method: 'POST',
    headers: { Authorization: `Bearer ${bundle.authData.api_key}`, 'Content-Type': 'application/json' },
    body, skipThrowForStatus: true, throwForThrottlingEarly: false,
  });
  const data = response.data;
  const code = data?.error?.code;
  if (response.status === 401 && code !== 'token_mismatched') {
    throw new z.errors.ExpiredAuthError('Your Ace Data Cloud API token is invalid. Reconnect your account.');
  }
  if (response.status === 429) {
    const delay = Number(response.headers?.get('retry-after'));
    if (path !== config.tasks) {
      throw new z.errors.Error('Ace Data Cloud rate limit reached. Check the original task and usage before manually retrying generation.', 'GenerationRateLimited', 429);
    }
    throw new z.errors.ThrottledError('Ace Data Cloud rate limit reached. Zapier will retry the task query.',
      Number.isSafeInteger(delay) && delay > 0 ? delay : 60);
  }
  if (response.status >= 400 || data?.error || data?.success === false) {
    const messages = {
      token_mismatched: `This token cannot access the ${config.label} operation. Check Allowed APIs.`,
      used_up: 'Your Ace Data Cloud balance is insufficient. Check the application balance.',
    };
    const message = messages[code] || (response.status === 403 || code === 'forbidden'
      ? `Ace Data Cloud blocked the ${config.label} request. Check content and API access.`
      : `Ace Data Cloud could not complete the ${config.label} request. Check the original task before replaying.`);
    const trace = typeof data?.trace_id === 'string' && /^[a-f0-9-]{36}$/i.test(data.trace_id)
      ? ` Reference: ${data.trace_id}.` : '';
    throw new z.errors.Error(`${message}${trace}`, 'MediaRequestFailed', response.status >= 400 ? response.status : 500);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new z.errors.Error('Ace Data Cloud returned an invalid media response.', 'InvalidResponse');
  }
  return data;
};
const normalize = (z, config, record, expectedId) => {
  const id = taskId(z, record.id || record.task_id);
  if (id !== expectedId || (record.response?.task_id && record.response.task_id !== expectedId)) {
    throw new z.errors.Error('The returned media task ID does not match the original task.', 'TaskMismatch');
  }
  // OpenAI's task endpoint also stores other operations. Keep the GPT Image action in its actual service scope.
  if (config.modelPrefix && (typeof record.request?.model !== 'string' || !record.request.model.startsWith(config.modelPrefix))) {
    throw new z.errors.Error('This task is not from the selected media service. Use its original service action.', 'TaskServiceMismatch');
  }
  const response = record.response;
  const state = String(record.state || record.status || '').toLowerCase();
  const result = { id, task_id: id, status: FAILED.has(state) ? 'failed' : 'pending', success: false, media_urls: [], items: [] };
  if (!response || typeof response !== 'object' || Array.isArray(response)) return result;
  const raw = response.data;
  const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const states = items.map((x) => String(x?.status || x?.state || '').toLowerCase());
  const failed = FAILED.has(state) || response.success === false || Boolean(response.error)
    || states.some((s) => FAILED.has(s));
  if (typeof response.trace_id === 'string' && /^[a-f0-9-]{36}$/i.test(response.trace_id)) result.trace_id = response.trace_id;
  if (failed) return { ...result, status: 'failed', error_message: 'The original media task failed. Check usage before submitting again.' };
  const finished = Number.isFinite(record.finished_at) && record.finished_at > 0;
  const terminalItems = items.length > 0 && states.every((s) => SUCCEEDED.has(s));
  const explicitPending = (state && !SUCCEEDED.has(state)) || states.some((s) => s && !SUCCEEDED.has(s));
  const urls = items.map((x) => secureUrl(config.video ? x?.content?.video_url || x?.video_url : x?.image_url || x?.url));
  // Some legacy image records omit success, but still require the persisted finished timestamp.
  const successFlag = response.success === true || (response.success === undefined && finished && !config.video);
  if (explicitPending || !successFlag || !items.length || !(finished || terminalItems) || urls.some((x) => !x)) return result;
  result.status = 'succeeded'; result.success = true; result.media_urls = urls;
  result[config.video ? 'video_url' : 'image_url'] = urls[0];
  result.items = items.map((x, index) => {
    const item = { url: urls[index] };
    for (const key of ['id', 'model', 'resolution', 'ratio']) if (typeof x[key] === 'string') item[key] = x[key];
    if (Number.isFinite(x.duration)) item.duration = x.duration;
    return item;
  });
  return result;
};
const retrieve = async (z, bundle, config, value) => {
  const id = taskId(z, value);
  const record = await request(z, bundle, config, config.tasks, { action: 'retrieve', id });
  return normalize(z, config, record, id);
};
const outputFields = (config) => [
  { key: 'task_id', label: 'Original Ace Task ID' },
  { key: 'status', label: 'Task Status' },
  { key: 'success', label: 'Generation Succeeded', type: 'boolean' },
  { key: config.video ? 'video_url' : 'image_url', label: config.video ? 'Completed Video URL' : 'First Completed Image URL' },
  { key: 'media_urls', label: 'Completed Media URLs', list: true },
  { key: 'items[]url', label: 'Completed Media URL' },
  { key: 'items[]model', label: 'Result Model' },
  { key: 'items[]duration', label: 'Video Duration (Seconds)', type: 'number' },
  { key: 'trace_id', label: 'Trace ID' },
  { key: 'error_message', label: 'Safe Error Message' },
];
const actions = (config) => {
  const sampleUrl = config.video ? 'https://example.com/example-video.mp4' : 'https://example.com/example-image.png';
  const sample = { id: `example-${config.key}-task`, task_id: `example-${config.key}-task`, status: 'succeeded', success: true,
    media_urls: [sampleUrl], items: [{ url: sampleUrl }], [config.video ? 'video_url' : 'image_url']: sampleUrl };
  const generate = {
    key: `generate_${config.key}`, noun: config.label,
    display: { label: config.actionLabel,
      description: `Creates ${config.video ? 'video' : 'images'} with ${config.label} through Ace Data Cloud, waits for completion, and consumes Ace balance.` },
    operation: {
      cleanInputData: false, inputFields: config.fields, sample, outputFields: outputFields(config),
      perform: async (z, bundle) => {
        const body = config.build(z, bundle.inputData);
        const data = await request(z, bundle, config, config.generate, { ...body, async: true, callback_url: z.generateCallbackUrl() });
        const id = taskId(z, data.task_id);
        return { id, task_id: id, status: 'pending', success: false };
      },
      performResume: async (z, bundle) => {
        const id = taskId(z, bundle.outputData?.task_id);
        if (bundle.cleanedRequest?.task_id !== id) throw new z.errors.Error('The media callback does not match the original task.', 'TaskMismatch');
        const result = await retrieve(z, bundle, config, id);
        if (result.status !== 'succeeded') throw new z.errors.Error(
          `The ${config.label} task is ${result.status}. Retrieve the same ID before replaying generation.`,
          result.status === 'failed' ? 'MediaTaskFailed' : 'MediaTaskPending',
        );
        return result;
      },
    },
  };
  const recovery = {
    key: `retrieve_${config.key}_task`, noun: `${config.label} Task`,
    display: { label: `Retrieve ${config.label} Task`, description: `Checks one existing ${config.label} task through Ace Data Cloud; does not create new media.` },
    operation: {
      cleanInputData: false,
      inputFields: [{ key: 'task_id', label: 'Original Ace Task ID', type: 'string', required: true,
        helpText: 'Map the original task ID. Check this same ID again when pending; do not rerun generation.' }],
      perform: (z, bundle) => retrieve(z, bundle, config, bundle.inputData.task_id), sample, outputFields: outputFields(config),
    },
  };
  return [generate, recovery];
};
module.exports = { actions, invalid, secureUrl };
