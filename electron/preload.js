"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const settings = ipcRenderer.sendSync("notepad:get-settings");

contextBridge.exposeInMainWorld("webkit", {
  messageHandlers: {
    notepad: {
      postMessage(message) {
        ipcRenderer.send("notepad:message", message);
      },
    },
  },
});

contextBridge.exposeInMainWorld("__nativeNotes", settings.notes);
contextBridge.exposeInMainWorld("__nativeWrapText", settings.wrapText);
contextBridge.exposeInMainWorld("__nativeFontSize", settings.fontSize);

ipcRenderer.on("notepad:open-files", (_event, files) => {
  window.openNativeFiles(files);
});
