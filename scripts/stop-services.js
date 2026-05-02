/**
 * Stop all Docker services
 */

const { execSync } = require('child_process');

const isWindows = process.platform === 'win32';
const dockerComposeCmd = isWindows ? 'docker-compose' : 'docker compose';

function stopDockerServices() {
  console.log('🛑 Stopping Docker services...');
  
  try {
    execSync(`${dockerComposeCmd} down`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ All services stopped');
  } catch (error) {
    console.error('❌ Failed to stop services:', error.message);
  }
}

if (require.main === module) {
  stopDockerServices();
}

module.exports = { stopDockerServices };

