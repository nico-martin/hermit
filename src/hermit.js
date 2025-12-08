#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
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

// Cleanup function
let composeProcess = null;
async function cleanup(rootDir) {
  console.log('\n🛑 Stopping Hermit services...');

  const dockerCompose = join(rootDir, 'docker', 'docker-compose.yml');
  try {
    await execAsync(`docker compose -f "${dockerCompose}" down`);
    console.log('✓ Stopped Hermit');
  } catch (error) {
    console.error('Error stopping services:', error.message);
  }

  // Remove env file
  const cacheDir = join(rootDir, '.cache');
  const envFile = join(cacheDir, '.hermit-env');
  if (existsSync(envFile)) {
    unlinkSync(envFile);
    console.log('✓ Removed environment file');
    console.log('');
    console.log('To clear environment variables, run: hermit_clear');
    console.log('(Or restart your shell)');
  }

  process.exit(0);
}

// Main function
export async function run(options = {}) {
  const silent = options.silent || false;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const rootDir = dirname(__dirname);

  // Handle cleanup signals
  process.on('SIGINT', () => cleanup(rootDir));
  process.on('SIGTERM', () => cleanup(rootDir));

  // Load hermit.config.js
  const config = await loadConfig(rootDir);

  // Generate config
  const cacheDir = join(rootDir, '.cache');
  generateConfig(config.models, cacheDir);

  // Ensure services are running
  await ensureLMStudio();
  await ensureDocker();

  // Generate auth token
  const authToken = `sk-hermit-${randomBytes(16).toString('hex')}`;

  // Start docker compose
  console.log('🚀 Starting Hermit services...');
  const dockerCompose = join(rootDir, 'docker', 'docker-compose.yml');

  try {
    await execAsync(
      `LITELLM_MASTER_KEY="${authToken}" docker compose -f "${dockerCompose}" up -d`
    );
  } catch (error) {
    console.error('Error starting services:', error.message);
    process.exit(1);
  }

  // Set environment variables for current process
  process.env.ANTHROPIC_AUTH_TOKEN = authToken;
  process.env.ANTHROPIC_BASE_URL = 'http://localhost:4000';
  process.env.ANTHROPIC_MODEL = 'local';
  process.env.ANTHROPIC_SMALL_FAST_MODEL = 'local';
  process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';

  // Write environment variables to file for sourcing
  const envFile = join(cacheDir, '.hermit-env');
  const envContent = `# Hermit environment variables
# Usage:
#   source ${envFile}     # Activate
#   hermit_clear          # Clear variables

export ANTHROPIC_AUTH_TOKEN="${authToken}"
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_MODEL="local"
export ANTHROPIC_SMALL_FAST_MODEL="local"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

# Function to unset Hermit environment variables
hermit_clear() {
  unset ANTHROPIC_AUTH_TOKEN
  unset ANTHROPIC_BASE_URL
  unset ANTHROPIC_MODEL
  unset ANTHROPIC_SMALL_FAST_MODEL
  unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
  unset -f hermit_clear
  echo "✓ Hermit environment variables cleared"
}
`;
  writeFileSync(envFile, envContent);

  console.log('✓ Hermit is running and Claude Code is configured');
  console.log('');
  console.log('Available models:');
  config.models.forEach((model) => {
    console.log(`  - ${model.name} (${model.provider})`);
  });
  console.log('');
  console.log('⚠️  Run this in your shell to enable Claude Code:');
  console.log('');
  console.log(`  source ${envFile}`);
  console.log('');
  console.log('Then run Claude Code:');
  console.log(`  claude --model ${config.models[0]?.name || 'local'}`);
  console.log('');
  console.log('To clear variables later, run: hermit_clear');
  console.log('');

  // Keep script running
  if (silent) {
    console.log(
      'Running in silent mode. Press Ctrl+C to stop services and clean up...'
    );
    // Wait indefinitely but wake up periodically to allow signal handling
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        // Just keep alive, signals will interrupt
      }, 1000);

      // Cleanup interval on process exit
      process.once('beforeExit', () => clearInterval(interval));
    });
  } else {
    console.log('Press Ctrl+C to stop services and clean up...');
    // Follow logs
    composeProcess = spawn(
      'docker',
      ['compose', '-f', dockerCompose, 'logs', '-f'],
      {
        stdio: 'inherit',
      }
    );

    // Wait for logs process to exit
    await new Promise((resolve) => {
      composeProcess.on('exit', resolve);
    });
  }
}

// If called directly, run the CLI
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && (
  process.argv[1] === __filename ||
  process.argv[1].endsWith('/hermit') ||
  process.argv[1].endsWith('/src/hermit.js')
);

if (isMainModule) {
  const silent = process.argv.includes('--silent');
  run({ silent }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
