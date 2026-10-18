const { actions } = require('../lib/media-task');
const input = require('../lib/media-inputs');
const MODELS = ['happyhorse-1.0-t2v', 'happyhorse-1.1-t2v'];
const config = {
  key: 'happyhorse_video', label: 'HappyHorse Video', actionLabel: 'Generate HappyHorse Video', video: true,
  generate: '/happyhorse/videos', tasks: '/happyhorse/tasks',
  fields: [
    { key: 'model', label: 'HappyHorse Model', type: 'string', required: true, choices: MODELS },
    { key: 'prompt', label: 'Video Prompt', type: 'text', required: true, helpText: 'This action is text-to-video only; reference-image and editing modes are not included.' },
    { key: 'duration', label: 'Duration (Seconds)', type: 'integer', helpText: 'Optional 3–15 seconds; actual output and billing follow the completed task.' },
    { key: 'resolution', label: 'Resolution', type: 'string', choices: ['720P', '1080P'] },
    { key: 'ratio', label: 'Aspect Ratio', type: 'string', choices: ['16:9', '9:16', '1:1', '4:3', '3:4'] },
  ],
  build: (z, data) => {
    const body = { action: 'generate', model: input.choice(z, 'HappyHorse text-to-video model', data.model, MODELS), prompt: input.prompt(z, data.prompt) };
    if (input.present(data.duration)) body.duration = input.integer(z, 'Duration', data.duration, 3, 15);
    if (input.present(data.resolution)) body.resolution = input.choice(z, 'resolution', data.resolution, ['720P', '1080P']);
    if (input.present(data.ratio)) body.ratio = input.choice(z, 'aspect ratio', data.ratio, ['16:9', '9:16', '1:1', '4:3', '3:4']);
    return body;
  },
};
module.exports = { actions: actions(config), config };
