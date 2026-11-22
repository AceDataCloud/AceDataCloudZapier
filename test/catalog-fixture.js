const nock = require('nock');
const contracts = require('./fixtures/api-contracts.json');
const mockCatalogs = () => {
  for (const [id, body] of Object.entries(contracts)) {
    nock('https://platform.acedata.cloud', { badheaders: ['authorization'] })
      .get(`/api/v1/apis/${id}/`).optionally().reply(200, body).persist();
  }
};
module.exports = { mockCatalogs, contracts };
