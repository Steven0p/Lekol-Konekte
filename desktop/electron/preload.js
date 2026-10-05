// Pont sécurisé entre les pages de l'app (configuration, chargement) et le
// processus principal. Surface minimale, contextIsolation activée.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posteAPI', {
  config: () => ipcRenderer.invoke('poste:config'),
  enregistrer: (donnees) => ipcRenderer.invoke('poste:enregistrer', donnees),
  surLog: (cb) => ipcRenderer.on('poste:log', (_e, message) => cb(message)),
});
