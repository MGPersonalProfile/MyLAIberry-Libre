const cola = require('../cola.js');
const { getFanfics, getFanficById, getSettings, glosarioParaTraducir, setSinopsisTraducida } = require('../db.js');
const { traducirSinopsis } = require('../translate.js');

async function encolarSinopsisPendientes() {
  const ajustes = await getSettings();
  if (ajustes?.autoTranslate === false || !ajustes?.lang) return;
  const idioma = ajustes.lang;

  const pendientes = (await getFanfics()).filter(f =>
    f.origen !== 'descartada' &&
    (f.synopsis || '').trim() &&
    !f.sinopsisTraducida?.[idioma]
  );

  const puestas = await cola.encolarVarias(
    'traducir-sinopsis', pendientes.map(o => ({ fanficId: String(o.id) }))
  );
  if (puestas > 0) console.log(`[Sinopsis] ${puestas} sin traducir; en cola.`);
}

async function traducirSinopsisDeObra({ fanficId }) {
  const ajustes = await getSettings();
  if (ajustes?.autoTranslate === false || !ajustes?.lang) return;

  const id = String(fanficId);
  const obra = await getFanficById(id);
  if (!obra) return;

  const idioma = ajustes.lang;
  if (obra.sinopsisTraducida?.[idioma]) return;
  const original = (obra.synopsis || '').trim();
  if (!original) return;

  const texto = (await traducirSinopsis(original, idioma, await glosarioParaTraducir(id))).trim();

  await setSinopsisTraducida(id, idioma, texto || original);
}

module.exports = {
  traducirSinopsisDeObra,
  encolarSinopsisPendientes
};
