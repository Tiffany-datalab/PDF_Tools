<template>
  <div class="container">
    <h1>PDF 小工具</h1>

    <!-- OCR 改名 -->
    <div v-if="mode === 'ocr'" class="form-box">
      <h2>報告改名</h2>
      <div class="form-row">
        <label>報告類型：</label>
        <select v-model="reportType">
          <option>食品檢驗報告</option>
          <option>環境檢驗報告</option>
        </select>
      </div>
      <div class="form-row">
        <label>PDF 資料夾：</label>
        <input v-model="ocrFolder" type="text" />
        <button class="btn-blue" @click="chooseFolder('ocr')">選擇資料夾</button>
      </div>
      <button class="btn-green" @click="runOcr">開始處理</button>
      <div class="progress-box">
        <progress :value="progress" :max="total"></progress>
        <span>{{ progress }}%</span>
      </div>
    </div>

    <!-- 蓋電子章 -->
    <div v-if="mode === 'stamp'" class="form-box">
      <h2>蓋電子章</h2>
      <div class="form-row">
        <label>原始報告資料夾：</label>
        <input v-model="inputFolder" type="text" />
        <button class="btn-blue" @click="chooseFolder('input')">選擇資料夾</button>
      </div>
      <div class="form-row">
        <label>簽章後存放位置：</label>
        <input v-model="outputFolder" type="text" />
        <button class="btn-blue" @click="chooseFolder('output')">選擇資料夾</button>
      </div>
      <div class="form-row">
        <label>電子章圖片：</label>
        <input v-model="stampImg" type="text" />
        <button class="btn-blue" @click="chooseFile">選擇圖片</button>
      </div>
      <button class="btn-green" @click="runStamp">開始處理</button>
      <div class="progress-box">
        <progress :value="progress" :max="total"></progress>
        <span>{{ progress }}%</span>
      </div>
    </div>
    <!-- ✅ 自訂彈窗 -->
    <div v-if="showResult" class="modal-overlay">
      <div class="modal">
        <h3>處理結果</h3>
        <p><b>成功數量：</b><span>{{ result.success }} 筆</span></p>
        <p class="error-text"><b>錯誤數量：</b>{{ result.fail }} 筆</p>
        <button class="btn-green" @click="showResult=false">關閉</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const mode = ref(""); // ocr | stamp
const progress = ref(0);
const total = ref(0);
const isProcessing = ref(false);

// ✅ Modal 狀態
const showResult = ref(false);
const result = ref({ success: 0, fail: 0 });

// OCR 狀態
const reportType = ref("食品檢驗報告");
const ocrFolder = ref("");

// Stamp 狀態
const inputFolder = ref("");
const outputFolder = ref("");
const stampImg = ref("");

// 🚀 載入時從 localStorage 恢復
onMounted(() => {
  if (window.electronAPI) {
    window.electronAPI.onMenuAction((_event, action) => {
      if (action === "ocr") mode.value = "ocr";
      else if (action === "stamp") mode.value = "stamp";
    });
  }

  ocrFolder.value = localStorage.getItem("ocrFolder") || "";
  inputFolder.value = localStorage.getItem("inputFolder") || "";
  outputFolder.value = localStorage.getItem("outputFolder") || "";
  stampImg.value = localStorage.getItem("stampImg") || "";
});

// OCR 改名
async function runOcr() {
  if (!ocrFolder.value) {
    alert("請先選擇 PDF 資料夾");
    return;
  }

  progress.value = 0;
  total.value = 100;
  isProcessing.value = true;

  const interval = setInterval(() => {
    if (progress.value < 95) progress.value += 5;
  }, 200);

  try {
    const data = await window.electronAPI.invoke(
      "ocr-rename",
      reportType.value,
      ocrFolder.value
    );

    clearInterval(interval);
    progress.value = 100;
    setTimeout(() => {
      isProcessing.value = false;
    }, 500);

    result.value = { success: data.success || 0, fail: data.fail || 0 };
    showResult.value = true;
  } catch (err) {
    clearInterval(interval);
    isProcessing.value = false;
    alert("OCR 執行失敗，請確認程式內有 ocr_rename.exe");
    console.error(err);
  }
}

// Stamp 蓋章
async function runStamp() {
  if (!inputFolder.value || !outputFolder.value || !stampImg.value) {
    alert("請先選擇完整的輸入、輸出、電子章路徑");
    return;
  }

  progress.value = 0;
  total.value = 100;
  isProcessing.value = true;

  const interval = setInterval(() => {
    if (progress.value < 95) progress.value += 5;
  }, 200);

  try {
    const data = await window.electronAPI.invoke(
      "pdf-stamp",
      inputFolder.value,
      outputFolder.value,
      stampImg.value
    );

    clearInterval(interval);
    progress.value = 100;
    setTimeout(() => {
      isProcessing.value = false;
    }, 500);

    result.value = { success: data.success || 0, fail: data.fail || 0 };
    showResult.value = true;
  } catch (err) {
    clearInterval(interval);
    isProcessing.value = false;
    alert("蓋章執行失敗，請確認程式內有 pdf_stamp.exe");
    console.error(err);
  }
}

// 選擇資料夾
async function chooseFolder(type) {
  const folder = await window.electronAPI.selectFolder();
  if (!folder) return;

  if (type === "ocr") {
    ocrFolder.value = folder;
    localStorage.setItem("ocrFolder", folder);
  }
  if (type === "input") {
    inputFolder.value = folder;
    localStorage.setItem("inputFolder", folder);
  }
  if (type === "output") {
    outputFolder.value = folder;
    localStorage.setItem("outputFolder", folder);
  }
}

// 選擇檔案
async function chooseFile() {
  const file = await window.electronAPI.selectFile();
  if (!file) return;
  stampImg.value = file;
  localStorage.setItem("stampImg", file);
}
</script>

<style>
/* === 原有表單樣式 === */
h1 {
  font-family: 'Roboto', sans-serif;
  font-weight: 900;
  color: #285372; /* 深藍 */
  margin-bottom: 20px;
}
h2 {
  font-family: 'Roboto', sans-serif;
  font-weight: bold;
  font-size: 25px;
  text-align: center;
  margin-bottom: 30px;
  color: #f06565;      
}
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}
.form-box {
  border: 1px solid #ccc;
  background: #f9f9f9;
  padding: 20px;
  margin-top: 20px;
  border-radius: 8px;
  width: 600px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  white-space: nowrap;
}
.form-row label {
  flex: 0 0 140px;
}
.form-row input{
  flex: 1;
  margin-right: 10px;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.form-row select {
  flex: unset;
  width: auto;
  height: 25px;
  border: #bbb4b4 solid 1px;
  min-width: 200px;   /* ✅ 預留最小寬度，避免太小 */
}

.btn-blue {
  background-color: #1b89ff;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 6px #00000033;
  transition: all 0.2s ease;
}
.btn-blue:hover {
  background-color: #0056b3;
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.3); /* hover 時陰影更強 */
}
.btn-green {
  background-color: #28a745;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: block;
  margin: 15px auto 20px auto;
  width: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}
.btn-green:hover {
  background-color: #1e7e34;
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.3); /* hover 時陰影更強 */
}

/* === 自訂 Modal 視窗 === */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal {
  background: #fff;
  border: 1px solid #333;
  padding: 20px;
  border-radius: 6px;
  text-align: center;
  width: 300px;
}
.modal h3 {
  margin-bottom: 15px;
}
.modal p {
  font-size: 18px;
  margin: 10px 0;
}
.modal .error-text {
  color: red;
  font-weight: bold;
}

progress {
  width: 100%;
  height: 20px;
  -webkit-appearance: none; /* 移除預設樣式 (Chromium/Electron) */
  appearance: none;
  border-radius: 10px;
  overflow: hidden; /* 防止圓角被填滿色塊蓋掉 */
  background-color: #eee; /* ✅ 未完成部分顏色 */
}

progress::-webkit-progress-value {
  background-color: #28a745; 
  border-radius: 10px;
}

progress::-webkit-progress-bar {
  background-color: #eee; 
  border-radius: 10px;
}

.progress-box {
  margin-top: 20px;
  text-align: center;
}

.progress-box span {
  color: #f8304b;
  display: block;        /* 讓數字換行 */
  margin-top: 6px;       /* ✅ 和進度條之間距離 */
  font-weight: bold;     /* ✅ 粗體 */
  font-size: 20px;       /* 可依需要調大小 */
}

</style>