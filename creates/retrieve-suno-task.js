const suno = require('../lib/suno');
module.exports = {
  key: 'retrieve_suno_task', noun: 'Suno Task',
  display: {
    label: 'Retrieve Suno Music Task',
    description: 'Checks one existing Suno task through Ace Data Cloud. Returns completed audio only after success; does not generate music.',
  },
  operation: {
    cleanInputData: false,
    inputFields: [
      { key: 'task_id', label: 'Original Suno Task ID', type: 'string', required: true,
        helpText: 'Map or paste the original Ace task ID. Pending tasks must be checked using this same ID.' },
    ],
    perform: (z, bundle) => suno.retrieve(z, bundle, bundle.inputData.task_id),
    sample: suno.sample, outputFields: suno.outputFields,
  },
};
