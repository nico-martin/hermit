# Hermit

Route Claude Code requests to local or alternative AI models while maintaining the same interface.

Like a hermit crab - same shell (Claude's interface), different crab inside (your choice of model).

## What It Does

Hermit uses LiteLLM to intercept API calls from Claude Code and route them to:
- Local models running in LM Studio
- Open-weight models via Hugging Face Router
- Alternative providers like OpenRouter
- Or even the real Anthropic API

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [LM Studio](https://lmstudio.ai/) (for local models)
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Claude Code CLI](https://code.claude.com/docs/en/setup)

## Setup

1. **Clone or download this repository**
   ```bash
   git clone git@github.com:nico-martin/hermit.git
   ```
   
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Link the hermit command** (optional, to use `hermit` globally):
   ```bash
   npm link
   ```

4. **Configure your API keys** in `.env`:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

   5. **Create your config** in `hermit.config.js`:
      ```bash
      cp hermit.config.example.js hermit.config.js
      # Edit hermit.config.js to configure your models
      ```

      Example config:
      ```javascript
      import { defineConfig } from './src/hermit.js';

      export default defineConfig({
        models: [
          {
            name: 'qwen3-coder',
            provider: 'lmstudio',
            model: 'qwen3-coder-30b',
            max_tokens: 65536,
            temperature: 0.7,
          },
          {
            name: 'gpt',
            provider: 'huggingface',
            model: 'openai/gpt-oss-120b',
          },
          {
            name: 'kimi',
            provider: 'openrouter',
            model: 'moonshotai/kimi-k2-0905',
          },
        ],
      });
      ```

      Supported providers: `lmstudio` (local), `huggingface`, `openrouter`, `anthropic`

## Usage

### Run Claude Code with Hermit

Simply run:
```bash
hermit
```

This will:
1. Check if services are already running (reuses them if so)
2. If not running:
   - Generate `config.yaml` from `hermit.config.js`
   - Start Docker Desktop (if not running)
   - Start LM Studio (if not running, and if you have local models)
   - Launch LiteLLM proxy on `localhost:4000`
3. Start Claude Code with environment configured
4. When you exit Claude, services keep running in the background

**Pass arguments to Claude Code:**
```bash
hermit --model kimi-or
hermit --help
hermit <any-claude-args>
```

**Multiple instances:**
You can run `hermit` multiple times - it will reuse the same backend services and share the auth token.

### Stop Services

When you're done with all your Hermit sessions:
```bash
hermit stop
```

This will:
- Stop Docker containers
- Clean up cache files
- Remove auth token

> This will run automatically when all hermit/claude instances are exited `/exit`

## How It Works

1. **LiteLLM Proxy**: Acts as a translation layer between Claude Code and your chosen model
2. **Environment Variables**: Tell Claude Code to use `localhost:4000` instead of Anthropic's API
3. **Model Routing**: LiteLLM routes requests based on the model name to the appropriate backend

```
Claude Code → LiteLLM (localhost:4000) → Your Model
```

## Configuration

### Adding More Models

Edit `hermit.config.js` to add new models:

```javascript
export default defineConfig({
  models: [
    {
      name: 'my-model',
      provider: 'openrouter',
      model: 'provider/model-id',
    },
  ],
});
```

The script automatically generates the full `config.yaml` with all provider-specific settings.

### Changing Local Model

1. Load a different model in LM Studio
2. Update the `model` field in `hermit.config.js` under the `local` entry
3. Restart: `Ctrl+C` then `hermit`

### Provider Configuration

Each provider has automatic configuration:

- **`lmstudio`**: Routes to LM Studio (local) on `localhost:1234`
- **`huggingface`**: Uses Hugging Face Router with `HF_TOKEN`
- **`openrouter`**: Uses OpenRouter with `OPENROUTER_API_KEY`
- **`anthropic`**: Uses real Anthropic API with `ANTHROPIC_API_KEY`

## Troubleshooting

**Docker won't start**: Make sure Docker Desktop is installed and you have permissions to run it.

**LM Studio connection failed**: Ensure the local server is started in LM Studio and a model is loaded.

**Wrong model responding**: Check which model name you're using and verify it matches an entry in `hermit.config.js`.

**API errors**: Check the logs (run without `--silent`) to see detailed error messages.

## Project Structure

```
hermit/
├── hermit.config.js     # Your model configuration (edit this!)
├── src/
│   ├── hermit.js        # Main entry point & defineConfig export
│   ├── providers.js     # Provider templates
│   ├── generate-config.js # Config generator
│   └── services.js      # LM Studio & Docker helpers
├── docker/
│   └── docker-compose.yml # Docker services (LiteLLM + Postgres)
├── package.json         # Node.js dependencies
├── .env                 # API keys and secrets
├── .cache/              # Generated files (config.yaml, etc.)
└── README.md            # This file
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

This project is a wrapper around [LiteLLM](https://github.com/BerriAI/litellm). See their repository for license information.