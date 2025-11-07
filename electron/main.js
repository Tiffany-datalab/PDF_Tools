/* Made by Tiffany-datalab */

import { app, BrowserWindow, Menu } from 'electron';
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { ipcMain, dialog } from "electron";
import log from 'electron-log';

// 設定 electron-log
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
// ⚠️ 禁止輸出到 console，只寫入 main.log
log.transports.console.level = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

/* ======================
   建立主視窗
====================== */
function createWindow() {
  log.info("🪟 createWindow: 開始建立瀏覽器視窗");

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  log.info("⚡ 預期載入的 preload 路徑:", path.join(__dirname, 'preload.js'));

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:1420');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/web/index.html'));
  }

  // ✅ 啟動後檢查更新
  mainWindow.webContents.once("did-finish-load", () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // ✅ 自訂選單
  const menu = Menu.buildFromTemplate([
    {
      label: '功能選單',
      submenu: [
        {
          label: '報告改名',
          click: () => {
            mainWindow.webContents.send('menu-action', 'ocr');
            mainWindow.setTitle("PDF小工具 - 報告改名");
          }
        },
        {
          label: '蓋電子章',
          click: () => {
            mainWindow.webContents.send('menu-action', 'stamp');
            mainWindow.setTitle("PDF小工具 - 蓋電子章");
          }
        },
      ]
    },
    {
      label: '開發者工具',
      click: () => {
        mainWindow.webContents.toggleDevTools();
      }
    }
  ]);
  Menu.setApplicationMenu(menu);
}

/* ======================
   自動更新必要事件
====================== */
autoUpdater.on('error', (err) => {
  log.error('更新錯誤:', err);
});
autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall(true, true);
  log.info('更新下載完成，將在關閉程式後安裝');
});

/* ======================
   單一實例鎖
====================== */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
  });
}

/* ======================
   IPC 事件：OCR 改名 & 蓋章
====================== */
function runPythonExe(baseName, args) {
  return new Promise((resolve, reject) => {
    // dev 模式 → 用 .py；打包後 → 用 .exe
    const exePath = app.isPackaged
      ? path.join(process.resourcesPath, "backend", "ocr_engine", `${baseName}.exe`)
      : path.join(__dirname, "../backend/ocr_engine", `${baseName}.py`);

    log.info(`執行: ${exePath} ${args.join(" ")}`);

    let output = "";
    const command = app.isPackaged ? exePath : "py";   // ✅ dev 用 py，release 用 exe
    const spawnArgs = app.isPackaged ? args : [exePath, ...args];

    const py = spawn(command, spawnArgs);

    py.stdout.on("data", (data) => {
      output += data.toString();
    });

    py.stderr.on("data", (data) => {
      log.error(data.toString());
    });

    py.on("close", () => {
      try {
        const [success, fail] = output.trim().split(",");
        resolve({ success: parseInt(success), fail: parseInt(fail) });
      } catch (err) {
        reject(new Error(`解析失敗: ${output}`));
      }
    });
  });
}

// OCR 改名
ipcMain.handle("ocr-rename", async (event, reportType, folder) => {
  return runPythonExe("ocr_rename", [reportType, folder]);
});

// 蓋電子章
ipcMain.handle("pdf-stamp", async (event, inputFolder, outputFolder, stampImg, yOffset) => {
  return runPythonExe("pdf_stamp", [inputFolder, outputFolder, stampImg, String(yOffset)]);
});

/* ======================
   IPC 事件：檔案 / 資料夾選擇
====================== */
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg"] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

/* ======================
   App lifecycle
====================== */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});