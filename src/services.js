import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Check if a service is running
async function isServiceRunning(command) {
  try {
    await execAsync(command);
    return true;
  } catch {
    return false;
  }
}

// Wait for a service to be ready
async function waitForService(checkFn, maxSeconds) {
  for (let i = 0; i < maxSeconds; i++) {
    if (await checkFn()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

// Start LM Studio
export async function ensureLMStudio() {
  const isRunning = await isServiceRunning(
    'curl -s http://localhost:1234/v1/models > /dev/null 2>&1'
  );

  if (!isRunning) {
    console.log('🤖 LM Studio is not running, starting LM Studio...');
    exec('open -a "LM Studio"');

    console.log('⏳ Waiting for LM Studio to start...');
    const ready = await waitForService(
      () =>
        isServiceRunning(
          'curl -s http://localhost:1234/v1/models > /dev/null 2>&1'
        ),
      30
    );

    if (ready) {
      console.log('✓ LM Studio server is ready');
      console.log('⚠️  Please ensure your model is loaded in LM Studio');
    } else {
      console.log('⚠️  LM Studio started but server may not be ready');
      console.log('   Please manually start the server and load your model');
    }
  } else {
    console.log('✓ LM Studio is already running');
  }
}

// Start Docker
export async function ensureDocker() {
  const isRunning = await isServiceRunning('docker info > /dev/null 2>&1');

  if (!isRunning) {
    console.log('🐳 Docker is not running, starting Docker Desktop...');
    exec('open -a Docker');

    console.log('⏳ Waiting for Docker to start...');
    const ready = await waitForService(
      () => isServiceRunning('docker info > /dev/null 2>&1'),
      60
    );

    if (ready) {
      console.log('✓ Docker is ready');
    } else {
      console.error('❌ Docker failed to start within 60 seconds');
      process.exit(1);
    }
  } else {
    console.log('✓ Docker is already running');
  }
}
