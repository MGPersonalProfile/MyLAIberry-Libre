const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function contarFanfics(dbPath) {
    try {
        const raw = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        return Array.isArray(raw.fanfics) ? raw.fanfics.length : 0;
    } catch {
        return 0;
    }
}

function motivoParaNoMigrar(legacyDir, targetDir, legacyDb) {
    if (path.resolve(legacyDir) === path.resolve(targetDir)) {
        return 'origen y destino son la misma carpeta';
    }
    if (!fs.existsSync(legacyDb)) return 'no hay datos antiguos que migrar';
    if (contarFanfics(legacyDb) === 0) return 'la biblioteca antigua está vacía';

    const targetDb = path.join(targetDir, 'mylaiberry-db.json');
    if (fs.existsSync(targetDb) && contarFanfics(targetDb) > 0) {
        return 'el destino ya tiene una biblioteca con contenido; no se toca';
    }
    return null;
}

function copiarFanfics(legacyDir, targetDir) {
    const desde = path.join(legacyDir, 'fanfics');
    const hasta = path.join(targetDir, 'fanfics');
    if (!fs.existsSync(desde)) return 0;

    fs.mkdirSync(hasta, { recursive: true });
    let chapters = 0;

    for (const entry of fs.readdirSync(desde, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const to = path.join(hasta, entry.name);
        if (fs.existsSync(to)) continue;
        fs.cpSync(path.join(desde, entry.name), to, { recursive: true });
        chapters += fs.readdirSync(to).filter(f => /^chapter_\d+\.html$/.test(f)).length;
    }
    return chapters;
}

function migrateUserData() {
    const result = { migrated: false, reason: '', fanfics: 0, chapters: 0 };

    try {
        const legacyDir = path.join(app.getPath('appData'), 'Electron');
        const targetDir = app.getPath('userData');
        const legacyDb = path.join(legacyDir, 'mylaiberry-db.json');

        const motivo = motivoParaNoMigrar(legacyDir, targetDir, legacyDb);
        if (motivo) {
            result.reason = motivo;
            return result;
        }

        const legacyCount = contarFanfics(legacyDb);
        fs.mkdirSync(targetDir, { recursive: true });

        fs.copyFileSync(legacyDb, path.join(targetDir, 'mylaiberry-db.json'));

        const chapters = copiarFanfics(legacyDir, targetDir);

        fs.renameSync(legacyDb, legacyDb + '.migrado');

        result.migrated = true;
        result.fanfics = legacyCount;
        result.chapters = chapters;
        result.reason = `migrados ${legacyCount} fanfics y ${chapters} capítulos desde ${legacyDir}`;
        return result;
    } catch (err) {

        result.reason = `error al migrar: ${err.message}`;
        return result;
    }
}

module.exports = { migrateUserData };
