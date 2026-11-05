(function () {
  'use strict';
  var base = document.body.getAttribute('data-base') || '';
  var CLAVE = 'mylaiberry:';

  function leerLocalCrudo(k) {
    try { return JSON.parse(localStorage.getItem(CLAVE + k) || 'null'); } catch (e) { return null; }
  }
  var ahoraDelPc = Number(document.body.getAttribute('data-ahora')) || 0;
  var desfase = ahoraDelPc ? ahoraDelPc - Date.now() : (leerLocalCrudo('desfase') || 0);
  if (ahoraDelPc) { try { localStorage.setItem(CLAVE + 'desfase', JSON.stringify(desfase)); } catch (e) {  } }
  function ahora() { return Date.now() + desfase; }
  function idUnico() {
    return globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function leerLocal(k) {
    try { return JSON.parse(localStorage.getItem(CLAVE + k) || 'null'); } catch (e) { return null; }
  }
  function guardarLocal(k, v) {
    try { localStorage.setItem(CLAVE + k, JSON.stringify(v)); } catch (e) {  }
  }
  function datos(el, nombre) {
    try { return JSON.parse(el.getAttribute('data-' + nombre) || 'null'); } catch (e) { return null; }
  }

  function adelantar(urls) {
    if (!urls || !urls.length || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(function (r) {
      if (r.active) r.active.postMessage({ tipo: 'adelantar', urls: urls });
    });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(base + '/sw.js').catch(function () {  });
  }
  var conAdelanto = document.querySelector('[data-adelantar]');
  if (conAdelanto) adelantar(datos(conAdelanto, 'adelantar'));

  function pendientes() { return leerLocal('pendientes') || {}; }
  function enviar(p) {
    var cola = pendientes();
    cola[p.obra] = p;
    guardarLocal('pendientes', cola);
    vaciar();
  }
  function vaciar() {
    var cola = pendientes();
    Object.keys(cola).forEach(function (obra) {
      fetch(base + '/progreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cola[obra]),
        keepalive: true
      }).then(function (r) {
        if (!r.ok && r.status !== 409) return;
        var ahora = pendientes();
        if (ahora[obra]?.mutationId === cola[obra].mutationId) {
          delete ahora[obra]; guardarLocal('pendientes', ahora);
          var revision = Number(r.headers.get('X-Lectura-Revision'));
          if (Number.isInteger(revision)) guardarLocal('rev:' + obra, revision);
          if (r.status === 409) guardarLocal('pos:' + obra, null);
        }
      }).catch(function () {  });
    });
  }
  window.addEventListener('online', vaciar);
  vaciar();

  var seguir = document.querySelector('a.seguir[data-obra]');
  if (seguir) {
    var local = leerLocal('pos:' + seguir.getAttribute('data-obra'));
    var delPc = datos(seguir, 'progreso');
    if (local && (!delPc || local.baseRevision === delPc.revision)
      && local.capitulo !== (delPc && delPc.capitulo)) {
      seguir.href = seguir.getAttribute('data-plantilla').replace('{n}', local.capitulo);
      seguir.textContent = 'Seguir por el capítulo ' + (local.capitulo + 1);
    }
  }

  var lectura = document.getElementById('lectura');
  if (!lectura) return;
  var obra = lectura.getAttribute('data-obra');
  var capitulo = Number(lectura.getAttribute('data-capitulo'));

  var hojas = Array.prototype.slice.call(lectura.querySelectorAll('.texto > *'))
    .filter(function (h) { return !h.closest('[hidden]'); });
  adelantar(datos(lectura, 'siguientes'));

  function anclaActual() {
    var y = window.scrollY;
    for (var i = 0; i < hojas.length; i++) {
      var h = hojas[i];
      var arriba = h.getBoundingClientRect().top + y;
      if (arriba + h.offsetHeight > y) {
        var fraccion = h.offsetHeight ? Math.min(1, Math.max(0, (y - arriba) / h.offsetHeight)) : 0;
        return { indice: i, fraccion: Math.round(fraccion * 1000) / 1000, total: hojas.length };
      }
    }
    return null;
  }
  function irA(ancla) {
    if (!ancla || !hojas.length) return;

    var i = ancla.total === hojas.length ? ancla.indice : Math.round(ancla.indice / ancla.total * hojas.length);
    var h = hojas[Math.min(hojas.length - 1, Math.max(0, i))];
    window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY + (ancla.fraccion || 0) * h.offsetHeight);
  }

  var delPc = datos(lectura, 'posicion');
  var mia = leerLocal('pos:' + obra);
  var buena = mia && mia.baseRevision >= (Number(document.body.getAttribute('data-revision')) || 0)
    && mia.capitulo === capitulo ? mia : delPc;
  if (buena) irA(buena.ancla);

  var espera = null;
  function apuntar() {
    var p = { obra: obra, capitulo: capitulo, ancla: anclaActual(), en: ahora(),
      deviceId: leerLocal('deviceId') || idUnico(), mutationId: idUnico(),
      baseRevision: Math.max(Number(leerLocal('rev:' + obra)) || 0,
        Number(document.body.getAttribute('data-revision')) || 0) };
    guardarLocal('deviceId', p.deviceId);
    guardarLocal('pos:' + obra, p);
    enviar(p);
  }
  window.addEventListener('scroll', function () {
    clearTimeout(espera);
    espera = setTimeout(apuntar, 1500);
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && espera) { clearTimeout(espera); espera = null; apuntar(); }
  });
})();
