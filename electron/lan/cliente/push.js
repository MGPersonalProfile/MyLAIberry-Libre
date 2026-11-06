self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let dato;
    try { dato = e.data?.json(); } catch { return; }
    if (!dato || typeof dato.id !== 'string' || typeof dato.title !== 'string' || typeof dato.body !== 'string') return;
    await self.registration.showNotification(dato.title.slice(0, 160), {
      body: dato.body.slice(0, 300), tag: `mylaiberry-${dato.id}`, renotify: false,
      data: { url: `${BASE}/app/`, obraId: dato.obraId || null }
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const destino = new URL(e.notification.data?.url || `${BASE}/app/`, self.location.origin);
    if (!esNuestra(destino)) return;
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find(c => new URL(c.url).pathname.startsWith(`${BASE}/app/`));
    if (abierta) { await abierta.focus(); return; }
    await self.clients.openWindow(destino.href);
  })());
});
