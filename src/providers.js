export const PROVIDERS = {
  lmstudio: {
    api_base: 'http://host.docker.internal:1234/v1',
    api_key: 'lm-studio',
    model_prefix: 'openai/',
  },
  huggingface: {
    api_base: 'https://router.huggingface.co/v1',
    api_key: 'os.environ/HF_API_KEY',
    model_prefix: 'huggingface/',
    drop_params: true,
  },
  openrouter: {
    api_base: 'https://openrouter.ai/api/v1',
    api_key: 'os.environ/OPENROUTER_API_KEY',
    model_prefix: 'openrouter/',
  },
  anthropic: {
    api_key: 'os.environ/ANTHROPIC_API_KEY',
    model_prefix: 'anthropic/',
  },
};
