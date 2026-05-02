/**
 * Start all services (Docker Compose) before Next.js dev server
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const dockerComposeCmd = isWindows ? 'docker-compose' : 'docker compose';

function checkDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    // Check if Docker daemon is running
    try {
      execSync('docker ps', { stdio: 'ignore' });
      return true;
    } catch {
      console.error('\n❌ Docker is installed but Docker Desktop is not running!');
      console.error('💡 Please start Docker Desktop and try again.\n');
      return false;
    }
  } catch {
    console.error('❌ Docker is not installed or not in PATH');
    console.error('💡 Please install Docker Desktop: https://www.docker.com/products/docker-desktop\n');
    return false;
  }
}

function checkDockerComposeInstalled() {
  try {
    execSync(`${dockerComposeCmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    console.error(`❌ Docker Compose is not installed or not in PATH`);
    return false;
  }
}

async function startDockerServices() {
  console.log('🚀 Starting Docker services...');
  
  try {
    // Check if services are already running
    let psOutput;
    try {
      psOutput = execSync(`${dockerComposeCmd} ps --services --filter "status=running"`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch {
      // docker-compose ps might fail if no services exist, continue
      psOutput = '';
    }
    
    const runningServices = psOutput.trim().split('\n').filter(s => s);
    
    if (runningServices.length >= 2) { // At least PostgreSQL and Redis
      console.log('✅ Docker services are already running');
      return true;
    }
    
    // Start services in detached mode
    console.log('📦 Starting PostgreSQL, Redis, NMR Engine, Celery, OPSIN...');
    execSync(`${dockerComposeCmd} up -d`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('⏳ Waiting for services to be ready...');
    
    // Wait for services to be healthy
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    
    while (attempts < maxAttempts) {
      try {
        // Check PostgreSQL
        execSync('docker exec spectromind_postgres pg_isready -U spectromind', {
          stdio: 'ignore'
        });
        
        // Check Redis
        execSync('docker exec spectromind_redis redis-cli ping', {
          stdio: 'ignore'
        });
        
        // Check NMR Engine (HTTP health check)
        const http = require('http');
        const isHealthy = await new Promise((resolve) => {
          const req = http.get('http://localhost:8000/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (data.includes('healthy') || data.includes('degraded')) {
                resolve(true);
              } else {
                resolve(false);
              }
            });
          });
          req.on('error', () => resolve(false));
          req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
          });
        });
        
        if (isHealthy) {
          console.log('\n✅ All services (including NMR Engine) are ready!');
          return true;
        }
        
        console.log('\n✅ Core services (PostgreSQL, Redis) are ready!');
        return true;
        
      } catch {
        attempts++;
        process.stdout.write(`\r⏳ Waiting... (${attempts}/${maxAttempts})`);
        // Wait 1 second (cross-platform)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n⚠️  Services started but health check timed out. Continuing anyway...');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error.message);
    console.log('\n💡 Make sure Docker Desktop is running');
    console.log('💡 You can start services manually with: docker-compose up -d');
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SpectroMind v2.0 - Service Startup');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Check prerequisites
  if (!checkDockerInstalled()) {
    console.log('\n⚠️  Docker Desktop is not running.');
    console.log('⚠️  Starting Next.js only (backend services will not be available).\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Starting Next.js development server...');
    console.log('═══════════════════════════════════════════════════════\n');
    return;
  }
  
  if (!checkDockerComposeInstalled()) {
    console.log('\n⚠️  Docker Compose is required but not found.');
    console.log('⚠️  Starting Next.js only (backend services will not be available).\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Starting Next.js development server...');
    console.log('═══════════════════════════════════════════════════════\n');
    return;
  }
  
  // Start Docker services
  const servicesStarted = await startDockerServices();
  
  if (!servicesStarted) {
    console.log('\n⚠️  Could not start Docker services.');
    console.log('⚠️  Starting Next.js anyway (backend services will not be available).\n');
    console.log('💡 To fix:');
    console.log('   1. Make sure Docker Desktop is running');
    console.log('   2. Try: docker-compose up -d\n');
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Starting Next.js development server...');
  console.log('═══════════════════════════════════════════════════════\n');
}

// If run directly
if (require.main === module) {
  main();
}

module.exports = { startDockerServices, checkDockerInstalled, checkDockerComposeInstalled };

