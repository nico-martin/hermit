import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { PROVIDERS } from './providers.js';

export function generateConfig(models, cacheDir) {
  console.log('⚙️  Generating config.yaml from hermit.config.js...');

  try {
    // Ensure .cache directory exists
    mkdirSync(cacheDir, { recursive: true });

    if (!models || models.length === 0) {
      console.error('Error: No models found in hermit.config.js');
      process.exit(1);
    }

    const modelList = [];

    for (const model of models) {
      const { name, provider, model: modelId } = model;

      if (!name || !provider || !modelId) {
        console.warn('Warning: Skipping incomplete model definition:', model);
        continue;
      }

      if (!(provider in PROVIDERS)) {
        console.warn(
          `Warning: Unknown provider '${provider}' for model '${name}'. Skipping.`
        );
        continue;
      }

      const template = PROVIDERS[provider];

      const litellmParams = {
        model: `${template.model_prefix}${modelId}`,
        api_key: template.api_key,
      };

      if (template.api_base) {
        litellmParams.api_base = template.api_base;
      }

      // Add optional parameters for local provider
      if (provider === 'local') {
        if (model.max_tokens) litellmParams.max_tokens = model.max_tokens;
        if (model.repetition_penalty)
          litellmParams.repetition_penalty = model.repetition_penalty;
        if (model.temperature) litellmParams.temperature = model.temperature;
        if (model.top_k) litellmParams.top_k = model.top_k;
        if (model.top_p) litellmParams.top_p = model.top_p;
      }

      modelList.push({
        model_name: name,
        litellm_params: litellmParams,
      });
    }

    const config = { model_list: modelList };
    const configFile = join(cacheDir, 'config.yaml');
    writeFileSync(configFile, YAML.stringify(config));

    console.log(`✓ Generated config.yaml with ${modelList.length} model(s)`);
    return configFile;
  } catch (error) {
    console.error('Error generating config:', error.message);
    process.exit(1);
  }
}
