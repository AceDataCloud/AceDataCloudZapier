const suno = require('../lib/suno');

const perform = async (z, bundle) => {
  // Zapier holds the action until its callback arrives; never poll inside the 30-second execution window.
  return suno.submit(z, bundle, z.generateCallbackUrl());
};
const performResume = async (z, bundle) => {
  const id = suno.taskId(z, bundle.outputData?.task_id);
  if (bundle.cleanedRequest?.task_id !== id) {
    throw new z.errors.Error('The Suno callback does not match this task. Retrieve the original task ID.', 'TaskMismatch');
  }
  // A callback is a wake-up only: obtain authoritative output through the authenticated task API.
  const result = await suno.retrieve(z, bundle, id);
  if (result.status !== 'succeeded') {
    throw new z.errors.Error(
      `The Suno task is ${result.status}. Retrieve the same task ID before replaying generation.`,
      result.status === 'failed' ? 'SunoTaskFailed' : 'SunoTaskPending',
    );
  }
  return result;
};
module.exports = {
  key: 'generate_suno_music', noun: 'Suno Music',
  display: {
    label: 'Generate Suno Music',
    description: 'Creates music through Ace Data Cloud and waits for completed audio. Tests and runs consume Ace balance.',
  },
  operation: {
    cleanInputData: false,
    inputFields: [
      { key: 'model', label: 'Suno Model', type: 'string', required: true, choices: suno.MODELS,
        helpText: 'Choose the exact Suno model. Access and pricing depend on your Ace Data Cloud account.' },
      { key: 'prompt', label: 'Music Prompt', type: 'text', required: true,
        helpText: 'Describe music or a song in up to 500 characters. This action uses inspiration mode.' },
      { key: 'instrumental', label: 'Instrumental', type: 'boolean', default: 'false',
        helpText: 'Generate music without vocals when true.' },
    ],
    perform, performResume, sample: suno.sample, outputFields: suno.outputFields,
  },
};
