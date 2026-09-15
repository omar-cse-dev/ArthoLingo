/* ============================================================
   ArthoLingo — Main Application Script
   Author: Omar Mohammad Chowdhury
   ============================================================ */

'use strict';

// ============================================================
// GLOBAL STATE
// ============================================================
const AppState = {
  currentImage: null,
  imageDataURL: null,
  rotation: 0,
  brightness: 20,
  contrast: 30,
  ocrText: '',
  translatedSentences: [], // [{en, bn}]
  vocabularyItems: [],     // [{word, meaning}]
  isScanning: false,
  isTranslating: false,
  cameraStream: null,
  torchTrack: null,
  torchOn: false,
  facingMode: 'environment',
  isOnline: navigator.onLine,
  mobileActiveTab: 'scanner',
  pdfExportMode: 'sentences',
};

// ============================================================
// DOM ELEMENT CACHE
// ============================================================
const $ = id => document.getElementById(id);
const $q = sel => document.querySelector(sel);

const Elements = {
  // Scanner
  dropzone: $('dropzone'),
  dropzoneContent: $('dropzone-content'),
  imagePreviewWrap: $('image-preview-wrap'),
  previewImg: $('preview-img'),
  scanWaveContainer: $('scan-wave-container'),
  removeImageBtn: $('remove-image-btn'),
  fileInput: $('file-input'),
  cameraWrap: $('camera-wrap'),
  cameraVideo: $('camera-video'),
  torchBtn: $('torch-btn'),
  cameraSwitchBtn: $('camera-switch-btn'),
  cameraBtn: $('camera-btn'),
  imageControls: $('image-controls'),
  scanActionRow: $('scan-action-row'),
  scanBtn: $('scan-btn'),
  // OCR
  ocrCard: $('ocr-card'),
  ocrEditor: $('ocr-text-editor'),
  charCount: $('char-count'),
  wordCount: $('word-count'),
  // Progress
  progressSteps: $('progress-steps'),
  progressLabel: $('progress-label'),
  progressPct: $('progress-pct'),
  progressBarFill: $('progress-bar-fill'),
  // Results
  emptyStateRight: $('empty-state-right'),
  translationCard: $('translation-card'),
  translationBody: $('translation-body'),
  vocabCard: $('vocab-card'),
  vocabTbody: $('vocab-tbody'),
  vocabCountBadge: $('vocab-count-badge'),
  // UI
  processingCanvas: $('processing-canvas'),
  onlineIndicator: $('online-indicator'),
  themeToggle: $('theme-toggle'),
  // Mobile
  panelScanner: $('panel-scanner'),
  panelResults: $('panel-results'),
  navSentenceBadge: $('nav-sentence-badge'),
  navVocabBadge: $('nav-vocab-badge'),
};

// Word classes are provided by src/config/word-classes.js
const STOPWORDS = window.ArthoLingoWordClasses.STOPWORDS;
const FUNCTION_WORDS = window.ArthoLingoWordClasses.FUNCTION_WORDS;

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=2.7.0', { updateViaCache: 'none' })
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

// Preload local dictionary before user translation actions.
ArthoLingoDictionary.ready();

// ============================================================
// THEME MANAGEMENT
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('artholingo-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  Elements.themeToggle.checked = saved === 'dark';
}

Elements.themeToggle.addEventListener('change', function() {
  const theme = this.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('artholingo-theme', theme);
});

// ============================================================
// ONLINE/OFFLINE STATUS
// ============================================================
function updateOnlineStatus() {
  AppState.isOnline = navigator.onLine;
  const el = Elements.onlineIndicator;
  const label = el.querySelector('.status-label');
  if (AppState.isOnline) {
    el.classList.remove('offline');
    el.classList.add('online');
    if (label) label.textContent = 'Online';
    el.title = 'Online';
  } else {
    el.classList.remove('online');
    el.classList.add('offline');
    if (label) label.textContent = 'Offline';
    el.title = 'Offline';
    showToast('Offline Mode', 'Switched to local translation fallback.', 'warning');
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
const toastIcons = {
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${toastIcons[type] || toastIcons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="removeToast(this.parentElement)" aria-label="Close notification">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;
  container.appendChild(toast);
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 280);
}

// ============================================================
// MODAL MANAGEMENT
// ============================================================
function closeBlurModal() {
  $('blur-modal').hidden = true;
}
function showBlurModal() {
  $('blur-modal').hidden = false;
}
function openPDFSettings(mode = 'sentences') {
  AppState.pdfExportMode = mode;
  if (mode === 'sentences' && !AppState.translatedSentences.length) {
    showToast('No Sentences Yet', 'Please scan and translate text first.', 'warning');
    return;
  }
  if (mode === 'vocab' && !AppState.vocabularyItems.length) {
    showToast('No Vocabulary Yet', 'Please translate text first to build the vocabulary list.', 'warning');
    return;
  }

  const title = $('pdf-modal-title');
  const note = $('pdf-export-mode-note');
  const button = $('pdf-generate-btn');
  if (mode === 'vocab') {
    title.textContent = 'Export Vocabulary PDF';
    note.textContent = 'Vocabulary-only PDF: English words in handwriting style with clean Bengali meanings.';
    button.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg> Download Vocabulary PDF`;
  } else {
    title.textContent = 'Export Sentence PDF';
    note.textContent = 'Sentence-only PDF: English sentence plus Bengali translation, with a protected footer area.';
    button.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg> Download Sentence PDF`;
  }
  $('pdf-modal').hidden = false;
}
function closePDFModal() {
  $('pdf-modal').hidden = true;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.hidden = true;
    }
  });
});

// ============================================================
// HISTORY DRAWER
// ============================================================
function openHistoryDrawer() {
  $('history-drawer').hidden = false;
  renderHistoryList();
}
function closeHistoryDrawer() {
  $('history-drawer').hidden = true;
}
$('history-drawer').addEventListener('click', e => {
  if (e.target === $('history-drawer')) closeHistoryDrawer();
});

// ============================================================
// MOBILE TAB NAVIGATION
// ============================================================
function switchMobileTab(tabName, btn) {
  AppState.mobileActiveTab = tabName;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const panels = document.querySelectorAll('.panel');
  panels.forEach(p => p.classList.remove('mobile-active'));

  if (tabName === 'scanner') {
    Elements.panelScanner.classList.add('mobile-active');
  } else if (tabName === 'sentences') {
    Elements.panelResults.classList.add('mobile-active');
    Elements.vocabCard.hidden = true;
    Elements.translationCard.hidden = false;
  } else if (tabName === 'vocabulary') {
    Elements.panelResults.classList.add('mobile-active');
    Elements.translationCard.hidden = true;
    Elements.vocabCard.hidden = false;
  }
}

// Initialize mobile panels
function initMobilePanels() {
  if (window.innerWidth <= 767) {
    Elements.panelScanner.classList.add('mobile-active');
  } else {
    Elements.panelScanner.classList.remove('mobile-active');
    Elements.panelResults.classList.remove('mobile-active');
  }
}
window.addEventListener('resize', initMobilePanels);

// ============================================================
// FILE INPUT & DRAG-DROP
// ============================================================
function triggerFileInput() {
  Elements.fileInput.click();
}

function handleDragOver(e) {
  e.preventDefault();
  Elements.dropzone.classList.add('drag-over');
}
function handleDragLeave(e) {
  Elements.dropzone.classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  Elements.dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    processImageFile(file);
  } else {
    showToast('Invalid File', 'Please drop an image file (JPG, PNG, WEBP).', 'error');
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processImageFile(file);
}

function processImageFile(file) {
  if (file.size > 20 * 1024 * 1024) {
    showToast('File Too Large', 'Maximum file size is 20MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const dataURL = ev.target.result;
    AppState.imageDataURL = dataURL;
    AppState.currentImage = file;
    AppState.rotation = 0;
    resetSliders();
    showImagePreview(dataURL);
    checkBlurriness(dataURL);
    autoApplyCamScannerFilter();
  };
  reader.readAsDataURL(file);
}

function showImagePreview(dataURL) {
  stopCamera();
  Elements.dropzoneContent.hidden = true;
  Elements.cameraWrap.hidden = true;
  Elements.imagePreviewWrap.hidden = false;
  Elements.previewImg.src = dataURL;
  Elements.imageControls.hidden = false;
  Elements.scanActionRow.hidden = false;
  Elements.torchBtn.hidden = true;
  Elements.cameraSwitchBtn.hidden = true;
  Elements.cameraBtn.style.display = '';
}

function removeImage(e) {
  e.stopPropagation();
  AppState.currentImage = null;
  AppState.imageDataURL = null;
  AppState.rotation = 0;
  Elements.imagePreviewWrap.hidden = true;
  Elements.dropzoneContent.hidden = false;
  Elements.imageControls.hidden = true;
  Elements.scanActionRow.hidden = true;
  Elements.scanWaveContainer.hidden = true;
  Elements.fileInput.value = '';
  hideProgress();
  showToast('Image Removed', 'Upload another image to continue.', 'info', 2500);
}

// ============================================================
// CAMSCANNER AUTO-FILTER
// ============================================================
function autoApplyCamScannerFilter() {
  const sliderB = $('brightness-slider');
  const sliderC = $('contrast-slider');
  sliderB.value = 20;
  sliderC.value = 30;
  $('brightness-val').textContent = 20;
  $('contrast-val').textContent = 30;
  AppState.brightness = 20;
  AppState.contrast = 30;
  applyFilters();
}

function resetSliders() {
  $('brightness-slider').value = 0;
  $('contrast-slider').value = 0;
  $('brightness-val').textContent = 0;
  $('contrast-val').textContent = 0;
}

function applyFilters() {
  const b = parseInt($('brightness-slider').value);
  const c = parseInt($('contrast-slider').value);
  $('brightness-val').textContent = b;
  $('contrast-val').textContent = c;
  AppState.brightness = b;
  AppState.contrast = c;

  const brightnessVal = 1 + b / 100;
  const contrastVal = 1 + c / 100;
  Elements.previewImg.style.filter = `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(0.9)`;
}

function rotateImage(degrees) {
  AppState.rotation = (AppState.rotation + degrees) % 360;
  Elements.previewImg.style.transform = `rotate(${AppState.rotation}deg)`;
}

function resetFilters() {
  AppState.rotation = 0;
  AppState.brightness = 0;
  AppState.contrast = 0;
  $('brightness-slider').value = 0;
  $('contrast-slider').value = 0;
  $('brightness-val').textContent = 0;
  $('contrast-val').textContent = 0;
  Elements.previewImg.style.filter = '';
  Elements.previewImg.style.transform = '';
}

// ============================================================
// BLUR DETECTION
// ============================================================
function checkBlurriness(dataURL) {
  const img = new Image();
  img.onload = () => {
    const canvas = Elements.processingCanvas;
    const ctx = canvas.getContext('2d');
    const w = Math.min(img.naturalWidth, 400);
    const h = Math.min(img.naturalHeight, 300);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const blurScore = laplacianVariance(imageData, w, h);
    if (blurScore < 80) {
      showBlurModal();
    }
  };
  img.src = dataURL;
}

function laplacianVariance(imageData, w, h) {
  const data = imageData.data;
  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const kernel = [0,-1,0,-1,4,-1,0,-1,0];
  let sum = 0, sum2 = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let lap = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          lap += gray[(y + ky) * w + (x + kx)] * kernel[ki++];
        }
      }
      sum += lap;
      sum2 += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  const variance = sum2 / count - mean * mean;
  return variance;
}

// ============================================================
// CAMERA ACCESS
// ============================================================
async function startCamera() {
  try {
    const constraints = {
      video: {
        facingMode: AppState.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    AppState.cameraStream = stream;
    Elements.cameraVideo.srcObject = stream;
    Elements.dropzoneContent.hidden = true;
    Elements.imagePreviewWrap.hidden = true;
    Elements.cameraWrap.hidden = false;
    Elements.torchBtn.hidden = false;
    Elements.cameraSwitchBtn.hidden = false;
    Elements.cameraBtn.style.display = 'none';
    Elements.imageControls.hidden = true;
    Elements.scanActionRow.hidden = true;
    showToast('Camera Active', 'Tap the capture button to take a photo.', 'info', 3000);
  } catch (err) {
    console.error('[Camera]', err);
    showToast('Camera Access Denied', 'Please allow camera permission in browser settings.', 'error');
  }
}

function stopCamera() {
  if (AppState.cameraStream) {
    AppState.cameraStream.getTracks().forEach(t => t.stop());
    AppState.cameraStream = null;
    AppState.torchTrack = null;
    AppState.torchOn = false;
  }
  Elements.cameraWrap.hidden = true;
  Elements.torchBtn.hidden = true;
  Elements.cameraSwitchBtn.hidden = true;
  Elements.cameraBtn.style.display = '';
  if (!AppState.imageDataURL) {
    Elements.dropzoneContent.hidden = false;
  }
}

async function toggleTorch() {
  if (!AppState.cameraStream) return;
  const tracks = AppState.cameraStream.getVideoTracks();
  if (!tracks.length) return;
  const track = tracks[0];
  const caps = track.getCapabilities();
  if (!caps || !caps.torch) {
    showToast('Torch Unavailable', 'This device does not support torch control.', 'warning');
    return;
  }
  AppState.torchOn = !AppState.torchOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: AppState.torchOn }] });
    Elements.torchBtn.style.color = AppState.torchOn ? 'var(--brand-warning)' : '';
    showToast(AppState.torchOn ? 'Torch On' : 'Torch Off', '', 'info', 1500);
  } catch (e) {
    showToast('Torch Error', 'Could not toggle torch.', 'error');
  }
}

async function switchCamera() {
  stopCamera();
  AppState.facingMode = AppState.facingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
}

function capturePhoto() {
  const video = Elements.cameraVideo;
  const canvas = Elements.processingCanvas;
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL('image/jpeg', 0.92);
  AppState.imageDataURL = dataURL;
  AppState.currentImage = { name: `scan_${Date.now()}.jpg`, type: 'image/jpeg' };
  AppState.rotation = 0;
  stopCamera();
  showImagePreview(dataURL);
  checkBlurriness(dataURL);
  autoApplyCamScannerFilter();
  showToast('Photo Captured', 'Ready to scan and extract text.', 'success', 2500);
}

// ============================================================
// OCR — TESSERACT.JS
// ============================================================
async function startOCR() {
  if (!AppState.imageDataURL) {
    showToast('No Image', 'Please upload or capture an image first.', 'warning');
    return;
  }
  if (AppState.isScanning) return;
  AppState.isScanning = true;

  Elements.scanBtn.disabled = true;
  Elements.scanBtn.innerHTML = `
    <div class="loading-dots"><span></span><span></span><span></span></div>
    Scanning...
  `;
  Elements.scanWaveContainer.hidden = false;
  Elements.progressSteps.hidden = false;
  setProgress(0, 'Initializing OCR Engine...');
  resetSteps();

  try {
    // Apply filters to processed image
    const processedDataURL = await getProcessedImageDataURL();
    setStep('scan', 'active');
    setProgress(10, 'Scanning Image...');

    const result = await Tesseract.recognize(
      processedDataURL,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(10 + m.progress * 70);
            setProgress(pct, 'Extracting Text...');
          }
        }
      }
    );

    setStep('scan', 'done');
    setStep('filter', 'active');
    setProgress(82, 'Filtering & Cleaning Text...');

    let text = result.data.text.trim();
    text = cleanOCRText(text);

    setStep('filter', 'done');
    setProgress(90, 'Preparing Editor...');

    AppState.ocrText = text;
    showOCREditor(text);
    setProgress(100, 'Text Extracted Successfully!');
    hideProgress();

    showToast('OCR Complete', `Extracted ${text.split(/\s+/).filter(Boolean).length} words.`, 'success');

  } catch (err) {
    console.error('[OCR]', err);
    setProgress(0, 'OCR Failed');
    showToast('OCR Failed', 'Could not extract text. Try a clearer image.', 'error');
    hideProgress();
  } finally {
    AppState.isScanning = false;
    Elements.scanWaveContainer.hidden = true;
    Elements.scanBtn.disabled = false;
    Elements.scanBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="4 7 4 4 20 4 20 7"></polyline>
        <line x1="9" y1="20" x2="15" y2="20"></line>
        <line x1="12" y1="4" x2="12" y2="20"></line>
      </svg>
      Scan &amp; Extract Text
    `;
  }
}

async function getProcessedImageDataURL() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = Elements.processingCanvas;
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.save();
      if (AppState.rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((AppState.rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }
      ctx.filter = `brightness(${1 + AppState.brightness / 100}) contrast(${1 + AppState.contrast / 100}) saturate(0.9)`;
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.src = AppState.imageDataURL;
  });
}

function cleanOCRText(text) {
  return String(text || '')
    .normalize('NFKC')
    // Remove control characters, but preserve Unicode punctuation and Bengali glyphs.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Normalize dash/quote variants without deleting punctuation.
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '—')
    // Remove common question-paper / MCQ markers at the start of lines.
    .replace(/^\s*(?:[A-Z]\.|[a-z]\)|\d+[.)])\s+/gm, '')
    // Never create a space before punctuation marks.
    .replace(/[ \t]+([,.;:!?%])/g, '$1')
    .replace(/[ \t]+([।॥])/g, '$1')
    // Avoid spaces just inside brackets.
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    // Collapse repeated horizontal whitespace only.
    .replace(/[ \t]{2,}/g, ' ')
    // Keep paragraph structure, but normalize excessive blank lines.
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

function showOCREditor(text) {
  Elements.ocrCard.hidden = false;
  Elements.ocrEditor.value = text;
  updateEditorStats(text);
}

Elements.ocrEditor.addEventListener('input', function() {
  AppState.ocrText = this.value;
  updateEditorStats(this.value);
});

function updateEditorStats(text) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  Elements.charCount.textContent = `${chars.toLocaleString()} characters`;
  Elements.wordCount.textContent = `${words.toLocaleString()} words`;
}

function copyOcrText() {
  const text = Elements.ocrEditor.value;
  if (!text.trim()) { showToast('Nothing to Copy', '', 'warning', 2000); return; }
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied!', 'OCR text copied to clipboard.', 'success', 2000);
  });
}

// ============================================================
// PROGRESS CONTROLS
// ============================================================
function setProgress(pct, label) {
  Elements.progressBarFill.style.width = `${pct}%`;
  Elements.progressLabel.textContent = label;
  Elements.progressPct.textContent = `${pct}%`;
}

function resetSteps() {
  ['step-scan','step-filter','step-translate','step-vocab'].forEach(id => {
    const el = $(id);
    el.classList.remove('active', 'done');
  });
}

function setStep(name, state) {
  const el = $(`step-${name}`);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (state) el.classList.add(state);
}

function hideProgress() {
  setTimeout(() => {
    Elements.progressSteps.hidden = true;
    resetSteps();
    setProgress(0, 'Initializing...');
  }, 800);
}

// ============================================================
// TRANSLATION ENGINE
// ============================================================
async function startTranslation() {
  const text = Elements.ocrEditor.value.trim();
  if (!text) {
    showToast('No Text', 'Please scan an image to extract text first.', 'warning');
    return;
  }
  if (AppState.isTranslating) return;
  AppState.isTranslating = true;

  const translateBtn = $('translate-btn');
  translateBtn.disabled = true;
  translateBtn.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div> Translating...`;

  Elements.progressSteps.hidden = false;
  resetSteps();
  setStep('translate', 'active');
  setProgress(5, 'Starting Translation...');

  Elements.emptyStateRight.hidden = true;
  Elements.translationCard.hidden = false;
  Elements.translationBody.innerHTML = '';
  AppState.translatedSentences = [];

  // Split into sentences
  const sentences = splitIntoSentences(text);
  const total = sentences.length;

  setProgress(10, `Translating ${total} sentences...`);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;

    const pct = Math.round(10 + ((i + 1) / total) * 70);
    setProgress(pct, `Translating sentence ${i + 1} of ${total}...`);

    const block = createSentenceBlock(sentence, i);
    Elements.translationBody.appendChild(block);

    const translation = await translateText(sentence);
    updateSentenceTranslation(i, translation);
    AppState.translatedSentences.push({ en: sentence, bn: translation });
  }

  setStep('translate', 'done');
  setStep('vocab', 'active');
  setProgress(85, 'Building Vocabulary...');

  await buildVocabulary(text);

  setStep('vocab', 'done');
  setProgress(100, 'Complete!');

  // Save to history
  saveToHistory(text, AppState.translatedSentences, AppState.vocabularyItems);

  hideProgress();
  AppState.isTranslating = false;
  translateBtn.disabled = false;
  translateBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>
    Translate
  `;

  // Update mobile badges
  updateMobileBadges();

  showToast('Translation Complete', `${AppState.translatedSentences.length} sentences translated.`, 'success');
}

function splitIntoSentences(text) {
  const raw = text.split(/(?<=[.!?])\s+|(?<=\n)/);
  return raw
    .map(s => s.trim())
    .filter(s => s.length > 2 && /[a-zA-Z]/.test(s));
}

function createSentenceBlock(sentence, index) {
  const block = document.createElement('div');
  block.className = 'sentence-block';
  block.id = `sentence-${index}`;
  block.style.animationDelay = `${index * 0.06}s`;
  block.innerHTML = `
    <div class="sentence-english">
      <span class="sentence-en-text">${escapeHTML(sentence)}</span>
      <button class="speak-btn" onclick="speakText('${escapeAttr(sentence)}', this)" title="Pronounce English">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      </button>
    </div>
    <div class="sentence-bengali" id="ben-${index}">
      <div class="sentence-loading">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <span>Translating...</span>
      </div>
    </div>
  `;
  return block;
}

function updateSentenceTranslation(index, translation) {
  const benEl = $(`ben-${index}`);
  if (!benEl) return;
  benEl.innerHTML = `
    <div class="sentence-ben-label">Bengali Translation</div>
    <div class="sentence-ben-text">${escapeHTML(translation)}</div>
  `;
}

// Content safety is provided by src/engines/safety/content-safety.js
const containsBlockedContent = text => window.ArthoLingoSafety.containsBlockedContent(text);
const sanitizeForLearning = text => window.ArthoLingoSafety.sanitizeForLearning(text);

// ============================================================
// TRANSLATION API CALLS — SENTENCE ENGINE ONLY
// ============================================================
async function translateText(text) {
  if (!text.trim()) return text;

  const safeText = sanitizeForLearning(text);
  if (safeText === null) {
    console.warn('[Safety] Blocked sentence from translation.');
    return '[Content blocked for safety]';
  }
  text = safeText;

  if (AppState.isOnline) {
    try {
      const result = await translateMyMemory(text);
      if (result && isPlausibleSentenceTranslation(text, result)) return result;
    } catch (e) {
      console.warn('[Sentence Translation] MyMemory failed, trying LibreTranslate...', e);
    }
    try {
      const result = await translateLibreTranslate(text);
      if (result && isPlausibleSentenceTranslation(text, result)) return result;
    } catch (e) {
      console.warn('[Sentence Translation] LibreTranslate failed, using offline fallback.', e);
    }
  } else {
    showToast('Offline Mode', 'Sentence translation is using the local fallback.', 'warning', 2000);
  }

  return offlineFallbackTranslation(text);
}

function isPlausibleSentenceTranslation(source, translated) {
  const output = String(translated || '').trim();
  if (!output) return false;

  // Reject raw API echoes for English text. Sentence translations may legitimately
  // contain a few Latin tokens, but a near-identical all-English response is suspect.
  const normalizedSource = source.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedOutput = output.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalizedOutput) return true;
  if (normalizedSource === normalizedOutput) return false;

  // If the source contains letters and the output contains no Bengali script and
  // is mostly alphabetic, do not present it as Bengali translation.
  const hasBengali = /[\u0980-\u09FF]/.test(output);
  const latinChars = (output.match(/[a-zA-Z]/g) || []).length;
  const totalLetters = (output.match(/[A-Za-z\u0980-\u09FF]/g) || []).length;
  if (!hasBengali && totalLetters > 0 && latinChars / totalLetters > 0.85) return false;
  return true;
}

async function translateMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|bn`;
  const resp = await fetchWithTimeout(url, 8000);
  if (!resp.ok) throw new Error('MyMemory API error');
  const data = await resp.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  throw new Error('Bad MyMemory response');
}

async function translateLibreTranslate(text) {
  const url = 'https://libretranslate.de/translate';
  const resp = await fetchWithTimeout(url, 8000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'en', target: 'bn', format: 'text' })
  });
  if (!resp.ok) throw new Error('LibreTranslate error');
  const data = await resp.json();
  if (data.translatedText) return data.translatedText;
  throw new Error('Bad LibreTranslate response');
}

async function fetchWithTimeout(url, timeout = 8000, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function offlineFallbackTranslation(text) {
  const localDict = {
    'hello': 'হ্যালো', 'world': 'বিশ্ব', 'book': 'বই', 'water': 'পানি',
    'food': 'খাবার', 'house': 'বাড়ি', 'school': 'স্কুল', 'teacher': 'শিক্ষক',
    'student': 'শিক্ষার্থী', 'family': 'পরিবার', 'friend': 'বন্ধু', 'love': 'ভালোবাসা',
    'time': 'সময়', 'year': 'বছর', 'day': 'দিন', 'night': 'রাত',
    'sun': 'সূর্য', 'moon': 'চাঁদ', 'sky': 'আকাশ', 'river': 'নদী',
    'country': 'দেশ', 'city': 'শহর', 'life': 'জীবন', 'people': 'মানুষ',
    'good': 'ভালো', 'bad': 'খারাপ', 'big': 'বড়', 'small': 'ছোট',
    'come': 'আসা', 'go': 'যাওয়া', 'read': 'পড়া', 'write': 'লেখা',
    'work': 'কাজ করা', 'play': 'খেলা করা', 'learn': 'শেখা', 'understand': 'বোঝা',
    'important': 'গুরুত্বপূর্ণ', 'information': 'তথ্য', 'knowledge': 'জ্ঞান',
    'technology': 'প্রযুক্তি', 'education': 'শিক্ষা', 'science': 'বিজ্ঞান',
    'computer': 'কম্পিউটার', 'internet': 'ইন্টারনেট', 'language': 'ভাষা',
    'english': 'ইংরেজি', 'bengali': 'বাংলা', 'translation': 'অনুবাদ',
  };
  const words = text.split(/(\s+)/);
  const translated = words.map(token => {
    if (/^\s+$/.test(token)) return token;
    const clean = token.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return token;
    return localDict[clean] || token;
  });
  return `[অফলাইন] ${translated.join('')}`;
}

// ============================================================
// WORD MEANING ENGINE — LOCAL, ALLOWLIST ONLY
// ============================================================
async function lookupWordMeaning(word) {
  await ArthoLingoDictionary.ready();
  const item = ArthoLingoDictionary.lookup(word);
  return item ? item.meaning_bn : null;
}

// ============================================================
// VOCABULARY BUILDER
// ============================================================
async function buildVocabulary(text) {
  await ArthoLingoDictionary.ready();

  const rawWords = text.match(/\b[a-zA-Z]{2,}\b/g) || [];
  const uniqueWords = [...new Set(rawWords.map(w => w.toLowerCase()))];
  const candidates = uniqueWords.filter(w => !STOPWORDS.has(w) || FUNCTION_WORDS.has(w));

  AppState.vocabularyItems = [];
  Elements.vocabCard.hidden = false;
  Elements.vocabTbody.innerHTML = '';

  for (const word of candidates) {
    if (!ArthoLingoDictionary.isSafeWord(word)) continue;
    const entry = ArthoLingoDictionary.lookup(word);
    if (!entry) continue; // Critical: unknown OCR tokens never go to a translation API.

    const item = { word, meaning: entry.meaning_bn, lemma: entry.lemma || word };
    AppState.vocabularyItems.push(item);
    appendVocabRow(item, AppState.vocabularyItems.length);
  }

  Elements.vocabCountBadge.textContent = `${AppState.vocabularyItems.length} words`;
  updateMobileBadges();

  if (!AppState.vocabularyItems.length) {
    Elements.vocabTbody.innerHTML = `
      <tr class="vocab-empty-row">
        <td colspan="4">No approved vocabulary matches were found in the local ArthoLingo dictionary.</td>
      </tr>`;
  }
}

function appendVocabRow(item, num) {
  const tr = document.createElement('tr');
  tr.style.animationDelay = `${num * 0.04}s`;
  tr.innerHTML = `
    <td class="vocab-num">${num}</td>
    <td class="vocab-word">${escapeHTML(item.word)}</td>
    <td class="vocab-bengali">${escapeHTML(item.meaning)}</td>
    <td class="vocab-speak">
      <button class="speak-btn" onclick="speakText('${escapeAttr(item.word)}', this)" title="Pronounce word" style="width:24px;height:24px;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      </button>
    </td>
  `;
  Elements.vocabTbody.appendChild(tr);
}

function updateMobileBadges() {
  const sc = AppState.translatedSentences.length;
  const vc = AppState.vocabularyItems.length;
  const sentBadge = $('nav-sentence-badge');
  const vocBadge = $('nav-vocab-badge');
  if (sc > 0) { sentBadge.textContent = sc; sentBadge.hidden = false; }
  if (vc > 0) { vocBadge.textContent = vc; vocBadge.hidden = false; }
}

// ============================================================
// WEB SPEECH API
// ============================================================
let currentUtterance = null;
function speakText(text, btn) {
  if (!('speechSynthesis' in window)) {
    showToast('Speech Unavailable', 'Web Speech API not supported in this browser.', 'warning');
    return;
  }
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.speak-btn.speaking').forEach(b => b.classList.remove('speaking'));
    if (currentUtterance.text === text) { currentUtterance = null; return; }
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.onstart = () => btn.classList.add('speaking');
  utterance.onend = () => { btn.classList.remove('speaking'); currentUtterance = null; };
  utterance.onerror = () => { btn.classList.remove('speaking'); currentUtterance = null; };
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

// ============================================================
// COPY TRANSLATION
// ============================================================
function copyTranslation() {
  if (!AppState.translatedSentences.length) {
    showToast('Nothing to Copy', '', 'warning', 2000); return;
  }
  const text = AppState.translatedSentences
    .map(s => `${s.en}\n${s.bn}`)
    .join('\n\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied!', 'Translation copied to clipboard.', 'success', 2000);
  });
}

// ============================================================
// PDF FONT SIZE CONTROLS
// ============================================================
const pdfFontSizes = { eng: 18, ben: 17 };

function adjustFontSize(type, delta) {
  pdfFontSizes[type] = Math.max(8, Math.min(24, pdfFontSizes[type] + delta));
  $(`${type}-font-size`).textContent = pdfFontSizes[type];
}

// ============================================================
// PDF GENERATION — DELEGATED TO pdf-generator.js
// ============================================================
async function generatePDF() {
  const mode = AppState.pdfExportMode || 'sentences';
  if (mode === 'sentences' && !AppState.translatedSentences.length) {
    showToast('No Sentences', 'Please translate text before generating a sentence PDF.', 'warning');
    return;
  }
  if (mode === 'vocab' && !AppState.vocabularyItems.length) {
    showToast('No Vocabulary', 'Please build the vocabulary list before generating a vocabulary PDF.', 'warning');
    return;
  }
  const config = {
    mode,
    engFont: $('pdf-eng-font').value,
    benFont: $('pdf-ben-font').value,
    engFontSize: pdfFontSizes.eng,
    benFontSize: pdfFontSizes.ben,
    sentences: AppState.translatedSentences,
    vocab: AppState.vocabularyItems,
  };
  const btn = $('pdf-generate-btn');
  if (btn) btn.disabled = true;
  try {
    await window.ArthoLingoPDF.generate(config);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// INDEXEDDB — SCAN HISTORY
// ============================================================
const DB_NAME = 'artholingo-db';
const DB_VERSION = 1;
const STORE_NAME = 'scans';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

async function saveToHistory(ocrText, translations, vocab) {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      timestamp: Date.now(),
      preview: AppState.imageDataURL ? AppState.imageDataURL.substring(0, 200) : null,
      imageDataURL: AppState.imageDataURL,
      ocrText: ocrText.substring(0, 500),
      translations,
      vocab,
    };
    store.add(record);

    // Keep only last 20
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const all = allReq.result;
      if (all.length > 20) {
        const toDelete = all.slice(0, all.length - 20);
        const delTx = database.transaction(STORE_NAME, 'readwrite');
        const delStore = delTx.objectStore(STORE_NAME);
        toDelete.forEach(item => delStore.delete(item.id));
      }
    };
  } catch (e) {
    console.warn('[IndexedDB] Save failed:', e);
  }
}

async function getAllHistory() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.reverse());
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return [];
  }
}

async function deleteHistoryItem(id) {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await renderHistoryList();
  } catch (e) {
    console.warn('[IndexedDB] Delete failed:', e);
  }
}

async function clearAllHistory() {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await renderHistoryList();
    showToast('History Cleared', 'All scan history has been deleted.', 'success', 2500);
  } catch (e) {
    console.warn('[IndexedDB] Clear failed:', e);
  }
}

async function renderHistoryList() {
  const list = $('history-list');
  const items = await getAllHistory();

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state-sm">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <p>No history yet</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="history-item" onclick="loadHistoryItem(${item.id})">
      ${item.imageDataURL
        ? `<img class="history-thumb" src="${item.imageDataURL}" alt="Scan thumbnail" loading="lazy" />`
        : `<div class="history-thumb" style="background:var(--bg-muted);display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
           </div>`
      }
      <div class="history-info">
        <div class="history-title">${escapeHTML(item.ocrText.substring(0, 50) + '...')}</div>
        <div class="history-meta">${formatHistoryDate(item.timestamp)} · ${item.translations?.length || 0} sentences</div>
      </div>
      <button class="history-del-btn" onclick="event.stopPropagation();deleteHistoryItem(${item.id})" aria-label="Delete history item">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path></svg>
      </button>
    </div>
  `).join('');
}

async function loadHistoryItem(id) {
  const database = await openDB();
  const tx = database.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(id);
  req.onsuccess = () => {
    const item = req.result;
    if (!item) return;
    closeHistoryDrawer();

    if (item.imageDataURL) {
      AppState.imageDataURL = item.imageDataURL;
      showImagePreview(item.imageDataURL);
    }

    AppState.ocrText = item.ocrText;
    showOCREditor(item.ocrText);

    if (item.translations?.length) {
      AppState.translatedSentences = item.translations;
      Elements.emptyStateRight.hidden = true;
      Elements.translationCard.hidden = false;
      Elements.translationBody.innerHTML = '';
      item.translations.forEach((s, i) => {
        const block = createSentenceBlock(s.en, i);
        Elements.translationBody.appendChild(block);
        updateSentenceTranslation(i, s.bn);
      });
    }

    if (item.vocab?.length) {
      AppState.vocabularyItems = item.vocab;
      Elements.vocabCard.hidden = false;
      Elements.vocabTbody.innerHTML = '';
      item.vocab.forEach((v, i) => appendVocabRow(v, i + 1));
      Elements.vocabCountBadge.textContent = `${item.vocab.length} words`;
    }

    updateMobileBadges();
    showToast('History Loaded', 'Previous scan restored.', 'success');
  };
}

function formatHistoryDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// UTILITY HELPERS
// ============================================================
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return String(str)
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, ' ');
}

// ============================================================
// APP INITIALIZATION
// ============================================================
function init() {
  initTheme();
  initMobilePanels();
  updateOnlineStatus();

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeBlurModal();
      closePDFModal();
      closeHistoryDrawer();
    }
  });

  // Touch: swipe dropzone to open history
  let touchStartX = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 80 && touchStartX > window.innerWidth - 60) {
      openHistoryDrawer();
    }
  }, { passive: true });

  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showToast('Install ArthoLingo', 'Add to home screen for the best experience.', 'info', 6000);
  });

  console.log('%cArthoLingo v2.0', 'font-size:18px;font-weight:bold;color:#6C63FF;');
  console.log('%cDeveloped by Omar Mohammad Chowdhury', 'color:#3B82F6;');
}

document.addEventListener('DOMContentLoaded', init);

document.addEventListener('contextmenu', event => event.preventDefault());

// F12, Ctrl+Shift+I, Ctrl+U বন্ধ করা
document.onkeydown = function (e) {
  if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 73) || (e.ctrlKey && e.keyCode == 85)) {
    return false;
  }
};