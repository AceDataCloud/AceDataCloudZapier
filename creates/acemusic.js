const { invalid, request, secureUrl, taskId } = require('../lib/media-task');

const config = { label: 'ACE Music', generate: '/acemusic/audios', tasks: '/acemusic/tasks' };
const models = ['acemusic-v1.1', 'acemusic-v1'];
const sample = { id: 'example-task', task_id: 'example-task', status: 'succeeded', success: true,
  audio_urls: ['https://example.com/song.mp3'], tracks: [{ audio_url: 'https://example.com/song.mp3' }] };
const outputFields = [
  { key: 'task_id', label: 'Original Task ID' }, { key: 'status', label: 'Status' },
  { key: 'success', label: 'Succeeded', type: 'boolean' },
  { key: 'audio_urls', label: 'Delivered Audio URLs', list: true },
  { key: 'tracks[]id', label: 'Track ID' }, { key: 'tracks[]audio_url', label: 'Delivered Audio URL' },
  { key: 'tracks[]title', label: 'Track Title' },
];
const fields = {
  model: { key: 'model', label: 'ACE Music Model', type: 'string', choices: models, default: models[0] },
  prompt: { key: 'prompt', label: 'Music Idea', type: 'text', required: true },
  lyric: { key: 'lyric', label: 'Lyrics', type: 'text', required: true },
  style: { key: 'style', label: 'Musical Style', type: 'string', required: true },
  title: { key: 'title', label: 'Title', type: 'string', required: true },
  audio_id: { key: 'audio_id', label: 'Owned Track ID', type: 'string', required: true },
  second_audio_id: { key: 'second_audio_id', label: 'Second Owned Track ID', type: 'string', required: true },
  audio_url: { key: 'audio_url', label: 'Public HTTPS MP3 URL', type: 'string', required: true },
  audio_influence: { key: 'audio_influence', label: 'Audio Influence (1–100)', type: 'number', default: '60' },
};

const operations = [
  { key: 'generate_acemusic_song', label: 'Generate ACE Music Song', action: 'generate', custom: false, fields: ['prompt', 'model'] },
  { key: 'create_custom_acemusic_song', label: 'Create Custom ACE Music Song', action: 'generate', custom: true, fields: ['lyric', 'style', 'title', 'model'] },
  { key: 'import_acemusic_reference', label: 'Import ACE Music Reference', action: 'upload', fields: ['audio_url'] },
  { key: 'cover_acemusic_track', label: 'Cover ACE Music Track', action: 'cover', fields: ['audio_id', 'lyric', 'style', 'audio_influence'] },
  { key: 'blend_acemusic_tracks', label: 'Blend ACE Music Tracks', action: 'mashup', fields: ['audio_id', 'second_audio_id', 'lyric', 'style', 'audio_influence'] },
];

function payload(z, op, data) {
  const body = { action: op.action, async: true };
  if (op.action === 'generate') body.custom = op.custom;
  if (op.action === 'cover' || op.action === 'mashup') body.model = models[0];
  for (const key of op.fields) {
    let value = data[key];
    if (key === 'model') {
      value = value || models[0];
      if (!models.includes(value)) invalid(z, 'Choose an available ACE Music model.');
    } else if (key === 'audio_influence') {
      if (value == null || value === '') continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 100) invalid(z, 'Audio influence must be from 1 to 100.');
    } else if (typeof value !== 'string' || !value.trim() || [...value].length > 20000) {
      invalid(z, 'Enter a valid ' + fields[key].label + '.');
    } else value = value.trim();
    if (key === 'audio_url' && !secureUrl(value)) invalid(z, 'Enter a public HTTPS MP3 URL.');
    body[key] = value;
  }
  if (op.action === 'mashup') {
    if (body.audio_id === body.second_audio_id) invalid(z, 'The two reference IDs must be distinct.');
    body.mashup_audio_ids = [body.audio_id, body.second_audio_id];
    delete body.audio_id;
    delete body.second_audio_id;
  }
  return body;
}

async function retrieve(z, bundle, value) {
  const id = taskId(z, value);
  const record = await request(z, bundle, config, config.tasks, { action: 'retrieve', id });
  if ((record.id || record.task_id) !== id || (record.response?.task_id && record.response.task_id !== id)) {
    throw new z.errors.Error('The returned task does not match the original task ID.', 'TaskMismatch');
  }
  const res = record.response || {};
  const state = String(record.status || record.state || '').toLowerCase();
  const group = String(res.status || '').toLowerCase();
  const partial = state === 'partial_failed' || group === 'partial_failed';
  const failed = state === 'failed' || group === 'failed' || res.success === false;
  const complete = state === 'succeeded' || group === 'succeeded' || (Boolean(record.finished_at) && res.success === true);
  const status = partial ? 'partial_failed' : failed ? 'failed' : complete ? 'succeeded' : 'pending';
  const items = Array.isArray(res.data) ? res.data : [];
  const tracks = ['succeeded', 'partial_failed'].includes(status) ? items.filter(t =>
    t && t.state === 'succeeded' && secureUrl(t.audio_url)).map(t => ({
    id: typeof t.id === 'string' ? t.id : '', title: typeof t.title === 'string' ? t.title : '', audio_url: t.audio_url,
  })) : [];
  return { id, task_id: id, status, success: status === 'succeeded', tracks, audio_urls: tracks.map(t => t.audio_url) };
}

const actions = operations.map(op => ({
  key: op.key, noun: 'ACE Music Task',
  display: { label: op.label, description: 'Creates an ACE Music task using the connected account and waits for its result. Tests and runs can incur a charge.' },
  operation: {
    cleanInputData: false, inputFields: op.fields.map(k => fields[k]), sample, outputFields,
    perform: async (z, bundle) => {
      const body = payload(z, op, bundle.inputData);
      const data = await request(z, bundle, config, config.generate, { ...body, callback_url: z.generateCallbackUrl() });
      const id = taskId(z, data.task_id);
      return { id, task_id: id, status: 'pending', success: false };
    },
    performResume: async (z, bundle) => {
      const id = taskId(z, bundle.outputData?.task_id);
      if (bundle.cleanedRequest?.task_id !== id) throw new z.errors.Error('The callback does not match the original task.', 'TaskMismatch');
      const result = await retrieve(z, bundle, id);
      if (result.status === 'pending' || result.status === 'failed') {
        throw new z.errors.Error('ACE Music task ' + id + ' is ' + result.status + '. Retrieve the same task before any resubmission.', 'AceMusicTaskIncomplete');
      }
      return result;
    },
  },
}));
actions.push({
  key: 'retrieve_acemusic_task', noun: 'ACE Music Task',
  display: { label: 'Retrieve ACE Music Task', description: 'Retrieves an existing ACE Music audio task and its delivered track URLs.' },
  operation: { cleanInputData: false, inputFields: [{ key: 'task_id', label: 'Original Task ID', type: 'string', required: true }],
    perform: (z, bundle) => retrieve(z, bundle, bundle.inputData.task_id), sample, outputFields },
});
module.exports = actions;
