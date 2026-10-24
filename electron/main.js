"use strict";

const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const defaultSettings = {
  notes: [],
  wrapText: false,
  fontSize: 13,
};

let mainWindow;
let settings = { ...defaultSettings };
let saveQueue = Promise.resolve();

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function loadSettings() {
  try {
    const serialized = await fs.readFile(settingsPath(), "utf8");
    const stored = JSON.parse(serialized);
    settings = {
      notes: Array.isArray(stored.notes) ? stored.notes : [],
      wrapText: stored.wrapText === true,
      fontSize:
        Number.isInteger(stored.fontSize) && stored.fontSize >= 10 && stored.fontSize <= 32
          ? stored.fontSize
          : 13,
    };
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
}

function saveSettings() {
  const targetPath = settingsPath();
  const temporaryPath = `${targetPath}.tmp`;
  const pendingWrite = saveQueue.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(temporaryPath, JSON.stringify(settings), "utf8");
    await fs.rename(temporaryPath, targetPath);
  });
  saveQueue = pendingWrite;
  return pendingWrite;
}

function showError(message) {
  dialog.showErrorBox("D-Writing-Pad", message);
}

async function handleMessage(message) {
  if (!message || typeof message.action !== "string") {
    throw new TypeError("The app received an invalid request.");
  }

  switch (message.action) {
    case "persist":
      if (!Array.isArray(message.notes)) throw new TypeError("The notes data is invalid.");
      settings.notes = message.notes;
      await saveSettings();
      break;
    case "wrapPreference":
      if (typeof message.enabled !== "boolean") throw new TypeError("The text-wrap setting is invalid.");
      settings.wrapText = message.enabled;
      await saveSettings();
      break;
    case "fontSizePreference":
      if (!Number.isInteger(message.fontSize) || message.fontSize < 10 || message.fontSize > 32) {
        throw new TypeError("The font-size setting is invalid.");
      }
      settings.fontSize = message.fontSize;
      await saveSettings();
      break;
    case "open":
      await openFiles();
      break;
    case "save":
      if (typeof message.name !== "string" || typeof message.content !== "string") {
        throw new TypeError("The note data is invalid.");
      }
      await saveNote(message.name, message.content);
      break;
    default:
      throw new Error(`Unknown app request: ${message.action}`);
  }
}

async function openFiles() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Text files", extensions: ["txt", "md", "text"] }],
  });
  if (result.canceled) return;

  const files = [];
  const failures = [];
  for (const filePath of result.filePaths) {
    try {
      files.push({
        name: path.basename(filePath, path.extname(filePath)),
        content: await fs.readFile(filePath, "utf8"),
      });
    } catch (error) {
      failures.push(`${path.basename(filePath)}: ${error.message}`);
    }
  }

  if (files.length > 0) mainWindow.webContents.send("notepad:open-files", files);
  if (failures.length > 0) showError(`Some files could not be opened:\n\n${failures.join("\n")}`);
}

async function saveNote(name, content) {
  const safeName = name.trim().replace(/[\\/:*?"<>|]/g, "-") || "Untitled";
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${safeName}.txt`,
    filters: [{ name: "Text files", extensions: ["txt"] }],
  });
  if (result.canceled || !result.filePath) return;

  try {
    await fs.writeFile(result.filePath, content, "utf8");
  } catch (error) {
    showError(`The file could not be saved: ${error.message}`);
  }
}

function sendEditorAction(selector) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(
    `document.querySelector(${JSON.stringify(selector)})?.click()`,
  ).catch((error) => showError(`The requested action could not be run: ${error.message}`));
}

function createMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        { label: "New Note", accelerator: "Ctrl+N", click: () => sendEditorAction("#new-button") },
        { label: "Open…", accelerator: "Ctrl+O", click: () => openFiles().catch((error) => showError(error.message)) },
        { label: "Save As…", accelerator: "Ctrl+S", click: () => sendEditorAction("#save-button") },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Input",
      submenu: [
        {
          label: "Toggle Manglish Input",
          accelerator: "Ctrl+M",
          click: () => sendEditorAction("#manglish-button"),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

ipcMain.on("notepad:get-settings", (event) => {
  event.returnValue = settings;
});

ipcMain.on("notepad:message", (_event, message) => {
  handleMessage(message).catch((error) => showError(error.message));
});

app.whenReady().then(async () => {
  try {
    await loadSettings();
  } catch (error) {
    showError(`Saved settings could not be loaded: ${error.message}`);
    app.quit();
    return;
  }

  createMenu();
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 640,
    minHeight: 460,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "index.html")).catch((error) => {
    showError(`The app window could not be opened: ${error.message}`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMenu();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
