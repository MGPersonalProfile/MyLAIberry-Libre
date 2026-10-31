const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
const BASE = `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${REVISION}`;
const DESTINO = path.join(__dirname, '..', 'frontend', 'public', 'modelos', 'Xenova', 'all-MiniLM-L6-v2');

const FICHEROS = [
  { ruta: 'config.json', sha256: '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7' },
  { ruta: 'tokenizer.json', sha256: 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0' },
  { ruta: 'tokenizer_config.json', sha256: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3' },
  { ruta: 'onnx/model_quantized.onnx', sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1' }
];

const huella = datos => crypto.createHash('sha256').update(datos).digest('hex');

async function bajar(rel, sha256) {
  const destino = path.join(DESTINO, rel);

  if (fs.existsSync(destino) && huella(fs.readFileSync(destino)) === sha256) {
    console.log('  ya está  ' + rel);
    return;
  }

  console.log('  bajando  ' + rel + '…');
  const r = await fetch(BASE + '/' + rel);
  if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`);

  const datos = Buffer.from(await r.arrayBuffer());
  if (huella(datos) !== sha256) {
    throw new Error(`${rel}: lo que llegó no es el fichero esperado (huella distinta)`);
  }

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, datos);
  console.log('  listo    ' + rel + '  (' + Math.round(datos.length / 1024) + ' KB)');
}

(async () => {
  console.log('Modelo de clasificación de género:');
  try {
    for (const f of FICHEROS) await bajar(f.ruta, f.sha256);
    console.log('Modelo preparado en frontend/public/modelos/');
  } catch (err) {
    console.error('\nNo se pudo preparar el modelo: ' + err.message);
    console.error('Hace falta conexión la primera vez. Después queda en disco.');
    process.exit(1);
  }
})();
