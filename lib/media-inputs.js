const { invalid, secureUrl } = require('./media-task');
const present = (v) => v !== undefined && v !== null && v !== '';
const choice = (z, name, value, values) => {
  if (!values.includes(value)) invalid(z, `Choose a supported ${name}.`);
  return value;
};
const prompt = (z, value, max) => {
  if (typeof value !== 'string' || !value.trim() || (max && [...value].length > max)) {
    invalid(z, `Enter a non-empty prompt${max ? ` of at most ${max} characters` : ''}.`);
  }
  return value;
};
const integer = (z, name, value, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(z, `${name} must be a whole number from ${min} to ${max}.`);
  return value;
};
const boolean = (z, name, value) => {
  if (typeof value !== 'boolean') invalid(z, `${name} must be true or false.`);
  return value;
};
const url = (z, name, value) => {
  if (!secureUrl(value)) invalid(z, `${name} must be a public HTTPS media URL without credentials.`);
  return value;
};
module.exports = { present, choice, prompt, integer, boolean, url };
