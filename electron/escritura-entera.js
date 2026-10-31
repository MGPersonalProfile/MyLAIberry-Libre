const fs = require('fs/promises');
const crypto = require('crypto');

async function escribirEntero(ruta, contenido, { rename = fs.rename, intentos = 6 } = {}) {
  const temporal = `${ruta}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporal, contenido, 'utf-8');
    for (let i = 0; ; i++) {
      try {
        await rename(temporal, ruta);
        return;
      } catch (e) {
        if (!e || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
        if (i === intentos - 1) return await fs.writeFile(ruta, contenido, 'utf-8');
        await new Promise(r => setTimeout(r, 80 * (i + 1)));
      }
    }
  } finally {
    await fs.rm(temporal, { force: true }).catch(() => {});
  }
}

module.exports = { escribirEntero };
