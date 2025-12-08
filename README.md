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
- Claude Code CLI

## Setup

1. **Clone or download this repository**

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
         name: 'local',
         provider: 'local',
         model: 'qwen3-coder-30b',
         max_tokens: 65536,
         temperature: 0.7,
       },
       {
         name: 'kimi',
         provider: 'huggingface',
         model: 'moonshotai/Kimi-K2-Instruct-0905',
       },
     ],
   });
   ```

   Supported providers: `local`, `huggingface`, `openrouter`, `anthropic`

## Usage

### Start Hermit

**Terminal 1 - Start Hermit:**
```bash
hermit
# or if not linked: npm start
```

This will:
- Generate `config.yaml` from `hermit.config.js`
- Start Docker Desktop (if not running)
- Start LM Studio (if not running)
- Launch LiteLLM proxy on `localhost:4000`
- Create `.hermit-env` file with environment variables
- Run in silent mode (no logs)

**Terminal 2 - Enable Claude Code:**
```bash
# Source the environment file (only needed once per shell session)
source .cache/.hermit-env

# Now use Claude Code with any configured model
claude --model local
claude --model kimi

# When done, clear Hermit environment
hermit_clear
```

**Show logs:**
```bash
hermit --logs
# or
npm run start:logs
```

### Stop Hermit

Press `Ctrl+C` in the Hermit terminal to stop all services.

To clear the environment variables in your shell, run:
```bash
hermit_clear
```

Or simply restart your shell.

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

- **`local`**: Routes to LM Studio on `localhost:1234`
- **`huggingface`**: Uses Hugging Face Router with `HF_API_KEY`
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

This project is a wrapper around [LiteLLM](https://github.com/BerriAI/litellm). See their repository for license information.