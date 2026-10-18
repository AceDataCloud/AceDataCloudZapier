const { actions, invalid } = require('../lib/media-task');
const input = require('../lib/media-inputs');
const MODELS = [
  "gpt-image-1",
  "gpt-image-1.5",
  "gpt-image-2",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-flare:official",
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-sunburst:official",
  "gpt-image-2:official"
];
const config = {
  key: 'gpt_image', label: 'GPT Image', actionLabel: 'Generate GPT Image', video: false, modelPrefix: 'gpt-image-',
  generate: '/openai/images/generations', tasks: '/openai/tasks',
  fields: [
    { key: 'model', label: 'GPT Image Model', type: 'string', required: true, choices: MODELS },
    { key: 'prompt', label: 'Image Prompt', type: 'text', required: true, helpText: 'Image generation only; image editing is not part of this action.' },
    { key: 'n', label: 'Image Count', type: 'integer', helpText: 'Optional 1–10. Each successful image is charged; omitting uses one image.' },
    { key: 'size', label: 'Image Size', type: 'string', helpText: 'For GPT Image 2/2.5: auto or WIDTHxHEIGHT, multiples of 16, 655360–8294400 pixels, longest side <=3840, aspect ratio <=3:1. Leave unset for 1/1.5.' },
    { key: 'quality', label: 'Quality', type: 'string', choices: ['auto', 'high', 'medium', 'low'] },
  ],
  build: (z, data) => {
    const body = { model: input.choice(z, 'GPT Image model', data.model, MODELS), prompt: input.prompt(z, data.prompt, 32000) };
    if (input.present(data.n)) body.n = input.integer(z, 'Image Count', data.n, 1, 10);
    if (input.present(data.quality)) body.quality = input.choice(z, 'quality', data.quality, ['auto', 'high', 'medium', 'low']);
    if (input.present(data.size)) {
      if (!body.model.startsWith('gpt-image-2')) invalid(z, 'Leave Image Size unset for GPT Image 1/1.5 in this action.');
      if (data.size !== 'auto') {
        if (typeof data.size !== 'string' || !/^\d+x\d+$/.test(data.size)) invalid(z, 'Image Size must be auto or WIDTHxHEIGHT.');
        const [w, h] = data.size.split('x').map(Number);
        if (!w || !h || w % 16 || h % 16 || Math.max(w, h) > 3840 || w * h < 655360 || w * h > 8294400 || Math.max(w, h) / Math.min(w, h) > 3) {
          invalid(z, 'Image Size must use multiples of 16 within the documented GPT Image 2 pixel and aspect limits.');
        }
      }
      body.size = data.size;
    }
    return body;
  },
};
module.exports = { actions: actions(config), config };
