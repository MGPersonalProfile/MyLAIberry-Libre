const { spawn } = require('child_process');

const shell = process.platform === 'win32' ? 'powershell.exe' : true;

console.log('Iniciando MyLAIberry v2...');
console.log('Levantando Frontend (Vite) y Electron en paralelo...');

const frontend = spawn('npm', ['run', 'dev:frontend'], { stdio: 'inherit', shell });
const electron = spawn('npm', ['run', 'dev:electron'], { stdio: 'inherit', shell });

frontend.on('close', (code) => {
  if (electron) electron.kill();
  process.exit(code);
});

electron.on('close', (code) => {
  if (frontend) frontend.kill();
  process.exit(code);
});

process.on('SIGINT', () => {
  if (frontend) frontend.kill();
  if (electron) electron.kill();
  process.exit(0);
});
