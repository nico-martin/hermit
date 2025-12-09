#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import {
  writeFileSync,
  unlinkSync,
  existsSync,
  readFileSync,
  mkdirSync,
} from 'fs';
import { generateConfig } from './generate-config.js';
import { ensureLMStudio, ensureDocker } from './services.js';

const execAsync = promisify(exec);

export function defineConfig(config) {
  return config;
}

// Load config
async function loadConfig(rootDir) {
  try {
    const configPath = join(rootDir, 'hermit.config.js');
    const config = await import(configPath);
    return config.default;
  } catch (error) {
    console.error('Error loading hermit.config.js:', error.message);
    process.exit(1);
  }
}

// Check if Docker containers are running
async function areContainersRunning() {
  try {
    const { stdout } = await execAsync(
      'docker ps --filter "name=hermit" --format "{{.Names}}"'
    );
    return stdout.includes('hermit');
  } catch {
    return false;
  }
}

// Get or create auth token
function getOrCreateToken(cacheDir) {
  const tokenFile = join(cacheDir, '.hermit-token');

  if (existsSync(tokenFile)) {
    return readFileSync(tokenFile, 'utf8').trim();
  }

  const token = `sk-hermit-${randomBytes(16).toString('hex')}`;
  writeFileSync(tokenFile, token);
  return token;
}

// Generate unique instance ID
function generateInstanceId() {
  return randomBytes(8).toString('hex');
}

// Register instance
function registerInstance(cacheDir, instanceId) {
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const instancesFile = join(cacheDir, '.instances');
  let instances = [];

  if (existsSync(instancesFile)) {
    const content = readFileSync(instancesFile, 'utf8').trim();
    if (content) {
      instances = content.split('\n');
    }
  }

  instances.push(instanceId);
  writeFileSync(instancesFile, instances.join('\n'));
}

// Unregister instance and check if any remain
function unregisterInstance(cacheDir, instanceId) {
  const instancesFile = join(cacheDir, '.instances');

  if (!existsSync(instancesFile)) {
    return true; // No instances file means no other instances
  }

  const content = readFileSync(instancesFile, 'utf8').trim();
  if (!content) {
    return true; // Empty file means no other instances
  }

  let instances = content.split('\n').filter((id) => id !== instanceId);

  if (instances.length === 0) {
    unlinkSync(instancesFile);
    return true; // No other instances
  }

  writeFileSync(instancesFile, instances.join('\n'));
  return false; // Other instances still exist
}

// Stop services
async function stopServices(rootDir) {
  console.log('\n🛑 Stopping Hermit services...');

  const dockerCompose = join(rootDir, 'docker', 'docker-compose.yml');
  try {
    await execAsync(`docker compose -f "${dockerCompose}" down`);
    console.log('✓ Stopped Hermit');
  } catch (error) {
    console.error('Error stopping services:', error.message);
  }

  // Remove cached files
  const cacheDir = join(rootDir, '.cache');
  const tokenFile = join(cacheDir, '.hermit-token');
  const envFile = join(cacheDir, '.hermit-env');

  if (existsSync(tokenFile)) {
    unlinkSync(tokenFile);
  }
  if (existsSync(envFile)) {
    unlinkSync(envFile);
  }

  console.log('✓ Cleaned up cache files');
}

// Main function
export async function run(options = {}) {
  const stopCmd = options.stop || false;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const rootDir = dirname(__dirname);

  // Handle stop command
  if (stopCmd) {
    await stopServices(rootDir);
    process.exit(0);
  }

  // Load hermit.config.js
  const config = await loadConfig(rootDir);

  // Generate config
  const cacheDir = join(rootDir, '.cache');
  generateConfig(config.models, cacheDir);

  // Generate and register instance ID
  const instanceId = generateInstanceId();
  registerInstance(cacheDir, instanceId);

  // Check if services are already running
  const isRunning = await areContainersRunning();
  let authToken;

  if (isRunning) {
    console.log('✓ Hermit services already running');
    authToken = getOrCreateToken(cacheDir);
  } else {
    // Ensure services are running
    const hasLocalModels = config.models.some((m) => m.provider === 'local');
    if (hasLocalModels) {
      await ensureLMStudio();
    }
    await ensureDocker();

    // Get or create auth token
    authToken = getOrCreateToken(cacheDir);

    // Start docker compose
    console.log('🚀 Starting Hermit services...');
    const dockerCompose = join(rootDir, 'docker', 'docker-compose.yml');

    try {
      await execAsync(
        `LITELLM_MASTER_KEY="${authToken}" docker compose -f "${dockerCompose}" up -d`
      );
      console.log('✓ Services started');
    } catch (error) {
      console.error('Error starting services:', error.message);
      process.exit(1);
    }
  }

  console.log('');
  console.log('Available models:');
  config.models.forEach((model) => {
    console.log(`  - ${model.name} (${model.provider})`);
  });
  console.log('');
  console.log('🚀 Starting Claude Code...');
  console.log('');

  // Run Claude Code with environment variables
  // Pass all arguments except 'stop' to Claude
  let claudeArgs = process.argv.slice(2).filter((arg) => arg !== 'stop');

  // Configure model aliases based on config
  const defaultModel = config.models[0]?.name;

  // If no --model specified, use the first model from config
  if (!claudeArgs.includes('--model') && !!defaultModel) {
    claudeArgs = ['--model', defaultModel, ...claudeArgs];
  }
  const env = {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: authToken,
    ANTHROPIC_BASE_URL: 'http://localhost:4000',
    ANTHROPIC_MODEL: defaultModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: defaultModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: defaultModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: defaultModel,
    CLAUDE_CODE_SUBAGENT_MODEL: defaultModel,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  };

  const claude = spawn('claude', claudeArgs, {
    stdio: 'inherit',
    env,
  });

  // Setup cleanup handler for signals
  const cleanup = async () => {
    const shouldStop = unregisterInstance(cacheDir, instanceId);
    if (shouldStop) {
      const dockerCompose = join(rootDir, 'docker', 'docker-compose.yml');
      try {
        await execAsync(`docker compose -f "${dockerCompose}" down`);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  };

  // Handle process termination signals
  process.on('SIGINT', async () => {
    claude.kill('SIGINT');
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    claude.kill('SIGTERM');
    await cleanup();
    process.exit(0);
  });

  // Wait for Claude to exit
  await new Promise((resolve) => {
    claude.on('exit', resolve);
  });

  console.log('');
  console.log('✓ Claude Code exited');
  console.log('');

  // Unregister instance and check if we should stop services
  const shouldStop = unregisterInstance(cacheDir, instanceId);

  if (shouldStop) {
    console.log('🛑 Stopping Hermit services (no other instances running)...');
    const dockerCompose = join(rootDir, 'docker', 'docker-compose.yml');
    try {
      await execAsync(`docker compose -f "${dockerCompose}" down`);
      console.log('✓ Stopped Hermit services');
    } catch (error) {
      console.error('Error stopping services:', error.message);
    }
  } else {
    console.log('Hermit services are still running (other instances active).');
    console.log('To stop them, run: hermit stop');
  }
}

// If called directly, run the CLI
const __filename = fileURLToPath(import.meta.url);
const isMainModule =
  process.argv[1] &&
  (process.argv[1] === __filename ||
    process.argv[1].endsWith('/hermit') ||
    process.argv[1].endsWith('/src/hermit.js'));

if (isMainModule) {
  const stop = process.argv.includes('stop');
  run({ stop }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
