import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const services = [
  {
    name: 'PayPal:4000',
    color: '\x1b[36m', // Cyan
    cmd: npmCmd,
    args: ['--prefix', 'apps/payments', 'run', 'dev'],
    cwd: rootDir,
  },
  {
    name: 'API:5000',
    color: '\x1b[35m', // Magenta
    cmd: npmCmd,
    args: ['--prefix', 'apps/api', 'run', 'dev'],
    cwd: rootDir,
  },
  {
    name: 'Web:3000',
    color: '\x1b[32m', // Green
    cmd: npmCmd,
    args: ['--prefix', 'apps/web', 'run', 'dev'],
    cwd: rootDir,
  },
  {
    name: 'SLA-AI:8000',
    color: '\x1b[33m', // Yellow
    cmd: isWindows ? 'py' : 'python3',
    args: isWindows
      ? ['-3.14', '-m', 'uvicorn', 'main:app', '--port', '8000', '--reload']
      : ['-m', 'uvicorn', 'main:app', '--port', '8000', '--reload'],
    cwd: path.resolve(rootDir, 'apps/sla-service'),
  },
];

console.log('\x1b[1m\x1b[34m===============================================================');
console.log('🚀 PAY-FOR-PERFORMANCE MONOREPO — Starting All 4 Microservices');
console.log('   - [Web]       http://localhost:3000 (Next.js Dashboard)');
console.log('   - [Payments]  http://localhost:4000 (PayPal Engine)');
console.log('   - [API]       http://localhost:5000 (Main Hub & MongoDB)');
console.log('   - [SLA-AI]    http://localhost:8000 (FastAPI & Groq)');
console.log('===============================================================\x1b[0m\n');

const children = [];

for (const s of services) {
  const child = spawn(s.cmd, s.args, {
    cwd: s.cwd,
    shell: true,
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line) console.log(`${s.color}[${s.name}]\x1b[0m ${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line) console.error(`${s.color}[${s.name}]\x1b[0m ${line}`);
    }
  });

  child.on('close', (code) => {
    console.log(`${s.color}[${s.name}]\x1b[0m Exited with code ${code}`);
  });

  children.push(child);
}

const cleanup = () => {
  console.log('\n\x1b[31mShutting down all services...\x1b[0m');
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
