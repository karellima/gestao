import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const defaultDatabaseUrl = 'postgresql://gestao:gestao@127.0.0.1:5432/gestao_e2e';
const defaultSecretKey = 'e2e-local-secret-key';

function findPython(backendDir) {
  const virtualenvPython = process.platform === 'win32'
    ? resolve(backendDir, '.venv', 'Scripts', 'python.exe')
    : resolve(backendDir, '.venv', 'bin', 'python');
  if (existsSync(virtualenvPython)) {
    return virtualenvPython;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function run(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${command} ${args.join(' ')} terminou com código ${code}`));
      }
    });
  });
}

async function globalSetup() {
  const setupDir = fileURLToPath(new URL('.', import.meta.url));
  const repositoryDir = resolve(setupDir, '../..');
  const backendDir = resolve(repositoryDir, 'backend');
  const python = findPython(backendDir);
  const environment = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || defaultDatabaseUrl,
    SECRET_KEY: process.env.SECRET_KEY || defaultSecretKey,
  };
  const options = { cwd: backendDir, env: environment };

  await run(python, ['reset_e2e.py'], options);
  await run(python, ['-m', 'alembic', 'upgrade', 'head'], options);
  await run(python, ['seed_e2e.py'], options);
}

export default globalSetup;
