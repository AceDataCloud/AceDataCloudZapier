const { actions, invalid } = require('../lib/media-task');
const input = require('../lib/media-inputs');
const catalog = require('../lib/catalog');
const API_ID = '8f01fe72-8a3e-4872-8d8d-330cde179b3a';
const PATH = '/openai/images/generations';
const currentSchema = (z) => catalog.requestSchema(z, API_ID, PATH);
const config = {
  key: 'gpt_image', label: 'GPT Image', actionLabel: 'Generate GPT Image', video: false,
  generate: '/openai/images/generations', tasks: '/openai/tasks',
  fields: [
    { key: 'model', label: 'GPT Image Model', type: 'string', required: true, choices: catalog.choices(API_ID, PATH, 'model') },
    { key: 'prompt', label: 'Image Prompt', type: 'text', required: true, helpText: 'Image generation only; image editing is not part of this action.' },
    { key: 'n', label: 'Image Count', type: 'integer', helpText: 'Optional 1–10. Each successful image is charged; omitting uses one image.' },
    { key: 'size', label: 'Image Size', type: 'string', helpText: 'Use auto or WIDTHxHEIGHT supported by the selected model. GPT Image 2/2.5/2.6 support documented custom and 4K sizes; DALL-E has fixed sizes.' },
    { key: 'quality', label: 'Quality', type: 'string', choices: catalog.choices(API_ID, PATH, 'quality'), helpText: 'Choose a quality supported by the selected model. DALL-E uses standard/hd; GPT Image 2.5/2.6 also support xhigh/max.' },
  ],
  validateTask: async (z, record) => {
    const model = record.request?.model;
    // Preserve recovery of historical GPT Image tasks while accepting every
    // currently published compatible model on this image API.
    const valid = typeof model === 'string' && (model.startsWith('gpt-image-')
      || catalog.enumValues(z, await currentSchema(z), 'model').includes(model));
    if (!valid) throw new z.errors.Error('This task is not from the image service. Use its original service action.', 'TaskServiceMismatch');
  },
  build: async (z, data) => {
    const schema = await currentSchema(z);
    const models = catalog.enumValues(z, schema, 'model');
    const body = { model: input.choice(z, 'GPT Image model', data.model, models), prompt: input.prompt(z, data.prompt, 32000) };
    if (input.present(data.n)) body.n = input.integer(z, 'Image Count', data.n, 1, body.model === 'dall-e-3' ? 1 : 10);
    if (input.present(data.quality)) body.quality = input.choice(z, 'quality', data.quality, catalog.enumValues(z, schema, 'quality'));
    if (input.present(data.size)) {
      if (data.size !== 'auto') {
        if (typeof data.size !== 'string' || !/^\d+x\d+$/.test(data.size)) invalid(z, 'Image Size must be auto or WIDTHxHEIGHT.');
        const [w, h] = data.size.split('x').map(Number);
        if (body.model.startsWith('gpt-image-2')) {
          if (!w || !h || w % 16 || h % 16 || Math.max(w, h) > 3840 || w * h < 655360 || w * h > 8294400 || Math.max(w, h) / Math.min(w, h) > 3) {
            invalid(z, 'Image Size must use multiples of 16 within the documented GPT Image 2 pixel and aspect limits.');
          }
        }
        const fixedSizes = { 'dall-e-2': ['256x256', '512x512', '1024x1024'], 'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'] }[body.model];
        if (fixedSizes && !fixedSizes.includes(data.size)) invalid(z, 'Choose a documented fixed size for this DALL-E model.');
      }
      body.size = data.size;
    }
    return body;
  },
};
module.exports = { actions: actions(config), config };
