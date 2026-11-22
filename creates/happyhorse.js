const { actions, invalid } = require('../lib/media-task');
const input = require('../lib/media-inputs');
const catalog = require('../lib/catalog');
const API_ID = 'd656e357-50cb-4390-b8c9-67464bc2a2f2';
const PATH = '/happyhorse/videos';
const config = {
  key: 'happyhorse_video', label: 'HappyHorse Video', actionLabel: 'Generate or Edit HappyHorse Video', video: true,
  generate: '/happyhorse/videos', tasks: '/happyhorse/tasks',
  fields: [
    { key: 'model', label: 'HappyHorse Model', type: 'string', required: true, choices: catalog.choices(API_ID, PATH, 'model') },
    { key: 'action', label: 'Video Operation', type: 'string', default: 'generate', choices: catalog.choices(API_ID, PATH, 'action'), helpText: 'Choose the operation matching the model: text, first image, reference images, or video edit.' },
    { key: 'image_url', label: 'First Image URL', type: 'string', helpText: 'Required for image_to_video.' },
    { key: 'image_urls', label: 'Reference Image URLs', type: 'string', list: true, helpText: 'Required for reference_to_video.' },
    { key: 'video_url', label: 'Original Video URL', type: 'string', helpText: 'Required for video_edit.' },
    { key: 'prompt', label: 'Video Prompt', type: 'text', required: true, helpText: 'Describe the video or edit. Use the matching input fields for the selected operation.' },
    { key: 'duration', label: 'Duration (Seconds)', type: 'integer', helpText: 'Optional 3–15 seconds; actual output and billing follow the completed task.' },
    { key: 'resolution', label: 'Resolution', type: 'string', choices: ['720P', '1080P'] },
    { key: 'ratio', label: 'Aspect Ratio', type: 'string', choices: ['16:9', '9:16', '1:1', '4:3', '3:4'] },
  ],
  build: async (z, data) => {
    const schema = await catalog.requestSchema(z, API_ID, PATH);
    const models = catalog.enumValues(z, schema, 'model');
    const action = input.choice(z, 'HappyHorse operation', data.action || 'generate', catalog.enumValues(z, schema, 'action'));
    const model = input.choice(z, 'HappyHorse model', data.model, models);
    // The published HappyHorse model IDs explicitly identify their input mode.
    const mode = { t2v: 'generate', i2v: 'image_to_video', r2v: 'reference_to_video', 'video-edit': 'video_edit' };
    const expected = Object.entries(mode).find(([suffix]) => model.endsWith(`-${suffix}`))?.[1];
    if (expected && action !== expected) invalid(z, 'Choose the Video Operation that matches the selected model.');
    const body = { action, model, prompt: input.prompt(z, data.prompt) };
    if (action === 'image_to_video') body.image_url = input.url(z, 'First image', data.image_url);
    if (action === 'reference_to_video') {
      if (!Array.isArray(data.image_urls) || !data.image_urls.length) invalid(z, 'Reference-to-video requires reference image URLs.');
      body.image_urls = data.image_urls.map((url) => input.url(z, 'Reference image', url));
    }
    if (action === 'video_edit') body.video_url = input.url(z, 'Original video', data.video_url);
    for (const key of ['image_url', 'image_urls', 'video_url']) {
      if (input.present(data[key]) && (!Array.isArray(data[key]) || data[key].length) && !(key in body)) {
        invalid(z, 'The supplied media does not match the selected Video Operation.');
      }
    }
    if (input.present(data.duration)) body.duration = input.integer(z, 'Duration', data.duration, 3, 15);
    if (input.present(data.resolution)) body.resolution = input.choice(z, 'resolution', data.resolution, ['720P', '1080P']);
    if (input.present(data.ratio)) body.ratio = input.choice(z, 'aspect ratio', data.ratio, ['16:9', '9:16', '1:1', '4:3', '3:4']);
    return body;
  },
};
module.exports = { actions: actions(config), config };
