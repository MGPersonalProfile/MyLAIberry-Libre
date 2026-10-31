const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mylaiberryPC', {
  entrarEnSitio: (id) => ipcRenderer.invoke('pc-entrar-en-sitio', String(id)),
  entrarEnWeb: (url) => ipcRenderer.invoke('pc-entrar-en-web', String(url)),

  marcador: "javascript:(function(){window.location.href='mylaiberry-libre://importar?url='+encodeURIComponent(window.location.href)})()",
});
