const { actions, invalid } = require('../lib/media-task');
const input = require('../lib/media-inputs');
const MODELS = [
  "doubao-seedance-1-0-pro-250528",
  "doubao-seedance-1-0-pro-fast-251015",
  "doubao-seedance-1-5-pro-251215",
  "doubao-seedance-1-0-lite-t2v-250428",
  "doubao-seedance-1-0-lite-i2v-250428",
  "doubao-seedance-2-0-260128",
  "doubao-seedance-2-0-fast-260128",
  "doubao-seedance-2-0-mini-260615",
  "doubao-seedance-2-5-260628"
];
// The i2v-only 1.0 Lite model needs a first-frame image; other models can also take one.
const config = {
  key: 'seedance_video', label: 'Seedance Video', actionLabel: 'Generate Seedance Video', video: true,
  generate: '/seedance/videos', tasks: '/seedance/tasks',
  fields: [
    { key: 'model', label: 'Seedance Model', type: 'string', required: true, choices: MODELS },
    { key: 'prompt', label: 'Video Prompt', type: 'text', required: true, helpText: 'Up to 1000 characters. This action supports text and an optional first-frame image.' },
    { key: 'image_url', label: 'First-Frame Image URL', type: 'string', helpText: 'Optional public HTTPS image. Required for Seedance 1.0 Lite i2v.' },
    { key: 'duration', label: 'Duration (Seconds)', type: 'integer', helpText: '1.0: 2–12; 1.5: 4–12; 2.0: 4–15; 2.5: 4–30. Only 1.5/2.x allow -1 for automatic duration.' },
    { key: 'resolution', label: 'Resolution', type: 'string', choices: ['480p', '720p', '1080p', '4k'], helpText: '2.0 Fast/Mini: 480p/720p. 2.0 Standard: up to 4k. 2.5: up to 1080p.' },
    { key: 'ratio', label: 'Aspect Ratio', type: 'string', choices: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'] },
    { key: 'generate_audio', label: 'Generate Audio', type: 'boolean', helpText: 'Optional for 1.5 and 2.x models. Not supported on 1.0.' },
  ],
  build: (z, data) => {
    const model = input.choice(z, 'Seedance model', data.model, MODELS);
    const body = { model, content: [{ type: 'text', text: input.prompt(z, data.prompt, 1000) }] };
    const one = model.includes('-1-0-'); const five = model.includes('-1-5-'); const twoFive = model.includes('-2-5-');
    if (model.includes('-lite-i2v-') && !input.present(data.image_url)) invalid(z, 'Seedance 1.0 Lite i2v requires a first-frame image URL.');
    if (model.includes('-lite-t2v-') && input.present(data.image_url)) invalid(z, 'Seedance 1.0 Lite t2v is text-only; select an image-capable model explicitly.');
    if (input.present(data.image_url)) body.content.push({ type: 'image_url', role: 'first_frame', image_url: { url: input.url(z, 'First-frame image', data.image_url) } });
    if (input.present(data.duration)) {
      if (data.duration === -1 && !one) body.duration = -1;
      else body.duration = input.integer(z, 'Duration', data.duration, one ? 2 : 4, twoFive ? 30 : five || one ? 12 : 15);
    }
    if (input.present(data.resolution)) {
      let allowed = ['480p', '720p', '1080p'];
      if (model === 'doubao-seedance-2-0-260128') allowed.push('4k');
      if (model.includes('-2-0-fast-') || model.includes('-2-0-mini-')) allowed = ['480p', '720p'];
      body.resolution = input.choice(z, 'resolution for this Seedance model', data.resolution, allowed);
    }
    if (input.present(data.ratio)) body.ratio = input.choice(z, 'aspect ratio', data.ratio, ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive']);
    if (input.present(data.generate_audio)) {
      if (one) invalid(z, 'Generate Audio is not supported by Seedance 1.0 models. Leave it unset.');
      body.generate_audio = input.boolean(z, 'Generate Audio', data.generate_audio);
    }
    return body;
  },
};
module.exports = { actions: actions(config), config };
