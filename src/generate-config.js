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

      // Add template-level params if they exist
      if (template.drop_params) {
        litellmParams.drop_params = template.drop_params;
      }

      // Add provider-specific parameters
      if (provider === 'local') {
        // Optional parameters for local provider
        if (model.max_tokens) litellmParams.max_tokens = model.max_tokens;
        if (model.repetition_penalty)
          litellmParams.repetition_penalty = model.repetition_penalty;
        if (model.temperature) litellmParams.temperature = model.temperature;
        if (model.top_k) litellmParams.top_k = model.top_k;
        if (model.top_p) litellmParams.top_p = model.top_p;
      } else if (provider === 'huggingface') {
        // TODO: does not work yet
        // For HuggingFace Router, use custom_llm_provider to bypass model validation
        const maxTokens = model.max_tokens || 8192;
        // Use openai_compatible prefix instead to bypass OpenAI model validation
        litellmParams.model = `openai_compatible/${modelId}`;
        litellmParams.max_tokens = maxTokens;
        litellmParams.stream_timeout = 600;
        litellmParams.supports_vision = false;
        litellmParams.supports_function_calling = true;
        litellmParams.model_info = {
          max_tokens: maxTokens,
          max_input_tokens: 100000,
          max_output_tokens: maxTokens,
          supports_vision: false,
          supports_function_calling: true,
        };
      }

      modelList.push({
        model_name: name,
        litellm_params: litellmParams,
      });
    }

    const config = {
      model_list: modelList,
      general_settings: {
        num_retries: 0, // Disable retries globally for providers that don't support it
        allowed_fails: 0,
      },
    };
    const configFile = join(cacheDir, 'config.yaml');
    writeFileSync(configFile, YAML.stringify(config));

    console.log(`✓ Generated config.yaml with ${modelList.length} model(s)`);
    return configFile;
  } catch (error) {
    console.error('Error generating config:', error.message);
    process.exit(1);
  }
}
