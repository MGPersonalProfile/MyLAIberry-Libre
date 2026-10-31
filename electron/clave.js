const { safeStorage } = require('electron');
const sistema = require('./credenciales-sistema.js');

const MARCA = 'enc:v1:';

const MARCA_TPM = 'tpm:v1:';
const NOMBRE_TPM = 'mylaiberry-claveIA';

function safeStorageDisponible() {
  try { return !!safeStorage?.isEncryptionAvailable(); } catch { return false; }
}

function estadoDelCifrado() {
  try {
    const disponible = safeStorageDisponible() || sistema.disponible();
    return {
      disponible,
      motivo: disponible
        ? null
        : 'El sistema no ofrece un almacén de credenciales (suele pasar en Linux sin llavero instalado).'
    };
  } catch (e) {
    return { disponible: false, motivo: e.message };
  }
}

function paraGuardar(texto) {
  const limpio = String(texto || '').trim();
  if (!limpio) return '';

  if (limpio.startsWith(MARCA) || limpio.startsWith(MARCA_TPM)) return limpio;

  try {
    if (safeStorageDisponible()) return MARCA + safeStorage.encryptString(limpio).toString('base64');
    if (sistema.disponible()) return MARCA_TPM + sistema.sellar(limpio, NOMBRE_TPM);
    return limpio;
  } catch {

    return limpio;
  }
}

function paraUsar(guardado) {
  const dato = String(guardado || '');
  if (!dato) return '';
  if (dato.startsWith(MARCA_TPM)) {
    try { return sistema.abrir(dato.slice(MARCA_TPM.length), NOMBRE_TPM); } catch { return ''; }
  }
  if (!dato.startsWith(MARCA)) return dato;

  try {
    return safeStorage.decryptString(Buffer.from(dato.slice(MARCA.length), 'base64'));
  } catch {

    return '';
  }
}

function estaCifrada(guardado) {
  const d = String(guardado || '');
  return d.startsWith(MARCA) || d.startsWith(MARCA_TPM);
}

module.exports = { estadoDelCifrado, paraGuardar, paraUsar, estaCifrada, MARCA, MARCA_TPM };
