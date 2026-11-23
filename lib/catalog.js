const API_CATALOG = 'https://platform.acedata.cloud/api/v1/apis/';
const CHAT_CATALOG = 'https://platform.acedata.cloud/api/v1/models/?type=chat';

const load = async (z, url) => {
  const response = await z.request({ url, skipThrowForStatus: true });
  if (response.status >= 400 || !response.data || typeof response.data !== 'object') {
    throw new z.errors.Error('The current Ace Data Cloud catalog could not be loaded. Try again later.', 'CatalogUnavailable');
  }
  return response.data;
};
const requestSchema = async (z, apiId, path) => {
  const api = await load(z, `${API_CATALOG}${apiId}/`);
  const schema = api.definition?.paths?.[path]?.post?.requestBody?.content?.['application/json']?.schema;
  if (!schema?.properties) throw new z.errors.Error('The API input catalog is unavailable.', 'CatalogUnavailable');
  return schema;
};
const enumValues = (z, schema, key) => {
  const values = schema.properties[key]?.enum;
  if (!Array.isArray(values) || !values.length || values.some((value) => typeof value !== 'string')) {
    throw new z.errors.Error(`The current ${key} choices could not be loaded.`, 'CatalogUnavailable');
  }
  return [...new Set(values)];
};
const choices = (apiId, path, key) => ({ perform: async (z) => ({
  results: enumValues(z, await requestSchema(z, apiId, path), key).map((id) => ({ id, label: id })),
}) });
const chatModels = async (z) => {
  const data = await load(z, CHAT_CATALOG);
  if (!Array.isArray(data.data)) throw new z.errors.Error('The chat model catalog is unavailable.', 'CatalogUnavailable');
  return data.data.filter((model) => model.type === 'chat' && typeof model.id === 'string');
};
module.exports = { requestSchema, enumValues, choices, chatModels };
