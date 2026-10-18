const { actions, invalid } = require('../lib/media-task');
const input = require('../lib/media-inputs');
const MODELS = [
  "nano-banana",
  "nano-banana-2-lite",
  "nano-banana-2",
  "nano-banana-2.1",
  "nano-banana-pro",
  "nano-banana:official",
  "nano-banana-2-lite:official",
  "nano-banana-2:official",
  "nano-banana-pro:official"
];
const config = {
  key: 'nano_banana_image', label: 'Nano Banana Image', actionLabel: 'Generate or Edit Nano Banana Image', video: false,
  generate: '/nano-banana/images', tasks: '/nano-banana/tasks',
  fields: [
    { key: 'action', label: 'Image Operation', type: 'string', required: true, choices: ['generate', 'edit'] },
    { key: 'model', label: 'Nano Banana Model', type: 'string', required: true, choices: MODELS },
    { key: 'prompt', label: 'Image Prompt', type: 'text', required: true },
    { key: 'image_urls', label: 'Reference Image URLs', type: 'string', list: true, helpText: 'Required for edit; public HTTPS image URLs. Leave empty for generate.' },
    { key: 'count', label: 'Image Count', type: 'integer', helpText: 'Optional 1–4; successful images are charged separately.' },
    { key: 'aspect_ratio', label: 'Aspect Ratio', type: 'string', choices: ['1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4'] },
    { key: 'resolution', label: 'Resolution', type: 'string', choices: ['1K', '2K', '4K'], helpText: 'Nano Banana and 2 Lite support 1K only. 2, 2.1 and Pro also support 2K/4K.' },
  ],
  build: (z, data) => {
    const body = { action: input.choice(z, 'image operation', data.action, ['generate', 'edit']),
      model: input.choice(z, 'Nano Banana model', data.model, MODELS), prompt: input.prompt(z, data.prompt) };
    const references = data.image_urls;
    if (body.action === 'edit') {
      if (!Array.isArray(references) || !references.length) invalid(z, 'Image editing requires at least one reference image URL.');
      body.image_urls = references.map((x) => input.url(z, 'Reference image', x));
    } else if (input.present(references) && (!Array.isArray(references) || references.length)) {
      invalid(z, 'Reference images require Image Operation=edit; leave them empty for generate.');
    }
    if (input.present(data.count)) body.count = input.integer(z, 'Image Count', data.count, 1, 4);
    if (input.present(data.aspect_ratio)) body.aspect_ratio = input.choice(z, 'aspect ratio', data.aspect_ratio, ['1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4']);
    if (input.present(data.resolution)) {
      const base = body.model.split(':')[0];
      const choices = ['nano-banana', 'nano-banana-2-lite'].includes(base) ? ['1K'] : ['1K', '2K', '4K'];
      body.resolution = input.choice(z, 'resolution for this Nano Banana model', data.resolution, choices);
    }
    return body;
  },
};
module.exports = { actions: actions(config), config };
