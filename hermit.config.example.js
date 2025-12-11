import { defineConfig } from './src/hermit.js';

export default defineConfig({
  models: [
    {
      name: 'local',
      provider: 'local',
      model: 'your-model-name',
      // Optional parameters for local models:
      max_tokens: 65536,
      temperature: 0.7,
      top_p: 0.8,
    },
    {
      name: 'gpt-oss',
      provider: 'openrouter',
      model: 'openai/gpt-oss-120b',
    },
    {
      name: 'kimi',
      provider: 'openrouter',
      model: 'moonshotai/kimi-k2-0905',
    },
    {
      name: 'gpt',
      provider: 'huggingface',
      model: 'openai/gpt-oss-120b',
    },
    // Enable real Anthropic API
    // {
    //   name: 'claude',
    //   provider: 'anthropic',
    //   model: '*',  // Use '*' to match all Anthropic models
    // },
  ],
});
