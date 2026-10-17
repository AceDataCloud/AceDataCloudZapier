const API_URL = 'https://api.acedata.cloud';
const MODELS = [
  'chirp-v6', 'chirp-v6-wild', 'chirp-v6-mini', 'chirp-v5-5', 'chirp-v5',
  'chirp-v4-5-plus', 'chirp-v4-5', 'chirp-v4', 'chirp-v3-5', 'chirp-v3-0',
];
const TERMINAL_SUCCESS = new Set(['succeeded', 'complete', 'completed']);
const TERMINAL_FAILURE = new Set(['failed', 'error', 'cancelled', 'canceled']);

const invalid = (z, message) => { throw new z.errors.Error(message, 'InvalidData', 400); };
const taskId = (z, value) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    invalid(z, 'Use the original Ace Data Cloud task ID returned by Suno generation.');
  }
  return value;
};
const reference = (data) => typeof data?.trace_id === 'string' && /^[a-f0-9-]{36}$/i.test(data.trace_id)
  ? ` Reference: ${data.trace_id}.` : '';

const request = async (z, bundle, path, body) => {
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
  const messages = {
    token_mismatched: 'This token cannot access the selected Suno operation. Check Allowed APIs.',
    used_up: 'Your Ace Data Cloud balance is insufficient. Check the application balance.',
  };
  if (response.status === 429) {
    const seconds = Number(response.headers?.get('retry-after'));
    throw new z.errors.ThrottledError('Ace Data Cloud rate limit reached. Zapier will retry.',
      Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 60);
  }
  if (response.status >= 400 || data?.success === false || data?.error) {
    const message = messages[code] || (response.status === 403 || code === 'forbidden'
      ? 'Ace Data Cloud blocked the Suno request. Check the content and API access.'
      : 'Ace Data Cloud could not complete the Suno request. Check the original task before replaying.');
    throw new z.errors.Error(`${message}${reference(data)}`, 'SunoRequestFailed', response.status >= 400 ? response.status : 500);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new z.errors.Error('Ace Data Cloud returned an invalid Suno response.', 'InvalidResponse');
  }
  return data;
};

const submit = async (z, bundle, callbackUrl) => {
  const { prompt, model, instrumental = false } = bundle.inputData;
  if (typeof prompt !== 'string' || !prompt.trim() || [...prompt].length > 500) {
    invalid(z, 'Enter a music prompt of 1 to 500 characters.');
  }
  if (!MODELS.includes(model)) invalid(z, 'Choose a supported Suno model.');
  if (typeof instrumental !== 'boolean') invalid(z, 'Instrumental must be true or false.');
  const body = { action: 'generate', model, prompt, instrumental, custom: false, async: true };
  if (callbackUrl) body.callback_url = callbackUrl;
  const data = await request(z, bundle, '/suno/audios', body);
  const id = taskId(z, data.task_id);
  return { id, task_id: id, status: 'pending', success: false };
};

const secureUrl = (value) => {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' ? value : undefined; } catch { return undefined; }
};
const normalizeTask = (z, record, expectedId) => {
  const id = taskId(z, record.id || record.task_id);
  if (id !== expectedId) throw new z.errors.Error('The returned task ID does not match the original Suno task.', 'TaskMismatch');
  const response = record.response;
  const state = String(record.state || record.status || '').toLowerCase();
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { id, task_id: id, status: TERMINAL_FAILURE.has(state) ? 'failed' : 'pending', success: false, tracks: [], audio_urls: [] };
  }
  if (response.task_id && response.task_id !== expectedId) {
    throw new z.errors.Error('The saved response does not match the original Suno task.', 'TaskMismatch');
  }
  const items = Array.isArray(response.data) ? response.data : [];
  const states = items.map((item) => String(item?.state || '').toLowerCase());
  const failure = response.success === false || Boolean(response.error) || TERMINAL_FAILURE.has(state)
    || states.some((s) => TERMINAL_FAILURE.has(s));
  const finished = Number.isFinite(record.finished_at) && record.finished_at > 0;
  const outerPending = state && !TERMINAL_SUCCESS.has(state) && !TERMINAL_FAILURE.has(state);
  const success = !failure && !outerPending && response.success === true && items.length > 0
    && !states.some((s) => s && !TERMINAL_SUCCESS.has(s))
    && (finished || states.every((s) => TERMINAL_SUCCESS.has(s)))
    && items.every((item) => secureUrl(item?.audio_url));
  const result = { id, task_id: id, status: failure ? 'failed' : success ? 'succeeded' : 'pending', success,
    tracks: [], audio_urls: [] };
  if (typeof response.trace_id === 'string' && /^[a-f0-9-]{36}$/i.test(response.trace_id)) result.trace_id = response.trace_id;
  if (failure) result.error_message = 'The original Suno task failed. Check its usage record before submitting another generation.';
  if (!success) return result;
  result.tracks = items.map((item) => {
    const track = {};
    for (const key of ['id', 'title', 'lyric', 'model', 'style']) {
      if (typeof item[key] === 'string') track[key] = item[key];
    }
    for (const key of ['audio_url', 'image_url', 'video_url']) {
      const value = secureUrl(item[key]); if (value) track[key] = value;
    }
    if (Number.isFinite(item.duration)) track.duration = item.duration;
    if (typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at))) {
      track.created_at = new Date(item.created_at).toISOString();
    }
    return track;
  });
  result.audio_urls = result.tracks.map((item) => item.audio_url);
  result.audio_url = result.audio_urls[0];
  return result;
};

const retrieve = async (z, bundle, id) => {
  id = taskId(z, id);
  const data = await request(z, bundle, '/suno/tasks', { action: 'retrieve', id });
  return normalizeTask(z, data, id);
};

const sample = {
  id: 'example-suno-task', task_id: 'example-suno-task', status: 'succeeded', success: true,
  audio_url: 'https://example.com/example-suno.mp3', audio_urls: ['https://example.com/example-suno.mp3'],
  tracks: [{ id: 'example-track', title: 'Example music', model: 'chirp-v6', audio_url: 'https://example.com/example-suno.mp3' }],
};
const outputFields = [
  { key: 'task_id', label: 'Ace Task ID' },
  { key: 'status', label: 'Task Status' },
  { key: 'success', label: 'Generation Succeeded', type: 'boolean' },
  { key: 'audio_url', label: 'First Completed Audio URL' },
  { key: 'audio_urls', label: 'Completed Audio URLs', list: true },
  { key: 'trace_id', label: 'Trace ID' },
  { key: 'error_message', label: 'Safe Error Message' },
  { key: 'tracks[]id', label: 'Track ID' },
  { key: 'tracks[]title', label: 'Track Title' },
  { key: 'tracks[]audio_url', label: 'Track Audio URL' },
  { key: 'tracks[]duration', label: 'Track Duration (Seconds)', type: 'number' },
];
module.exports = { MODELS, submit, retrieve, taskId, outputFields, sample };
