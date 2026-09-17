/*
 * localStorage 기반 저장 — 수동 5슬롯 + 자동 1슬롯 + 영구 갤러리 기록(세이브와 무관)
 * + 설정값. 저장/불러오기 화면(Phase 3)에서 이 모듈의 함수를 그대로 쓴다.
 */

var ONYU_AUTOSAVE_KEY = 'onyu_autosave_v1';
var ONYU_SLOT_KEY_PREFIX = 'onyu_slot_v1_';
var ONYU_GALLERY_KEY = 'onyu_gallery_v1';
var ONYU_SETTINGS_KEY = 'onyu_settings_v1';

function onyuSnapshotState() {
  var s = window.ONYU_STATE;
  return {
    playerName: s.playerName,
    affection: s.affection,
    addressStage: s.addressStage,
    currentChapterId: s.currentChapterId,
    chapterCheckpoints: s.chapterCheckpoints,
    completedChapters: s.completedChapters,
    chosenOutfits: s.chosenOutfits,
    savedAt: Date.now(),
  };
}

function onyuApplySnapshot(snap) {
  var s = window.ONYU_STATE;
  s.playerName = snap.playerName || '';
  s.affection = snap.affection || 0;
  s.addressStage = snap.addressStage || 0;
  s.currentChapterId = snap.currentChapterId;
  s.chapterCheckpoints = snap.chapterCheckpoints || {};
  s.completedChapters = snap.completedChapters || {};
  s.chosenOutfits = snap.chosenOutfits || {};
}

function onyuIsValidSnapshot(snap) {
  return !!(snap && typeof snap === 'object' && typeof snap.currentChapterId === 'string'
    && typeof onyuChapterIndexById === 'function' && onyuChapterIndexById(snap.currentChapterId) >= 0);
}

function onyuSaveAutosave() {
  try {
    localStorage.setItem(ONYU_AUTOSAVE_KEY, JSON.stringify(onyuSnapshotState()));
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('autosave_created', { chapterId: window.ONYU_STATE.currentChapterId || '' });
    if (typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('save-success');
  } catch (e) {
    console.warn('자동저장 실패', e);
  }
}

function onyuLoadAutosave() {
  try {
    var raw = localStorage.getItem(ONYU_AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function onyuSaveManualSlot(slotIndex) {
  try {
    localStorage.setItem(ONYU_SLOT_KEY_PREFIX + slotIndex, JSON.stringify(onyuSnapshotState()));
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('manual_save_created', { slot: Number(slotIndex) || 0, chapterId: window.ONYU_STATE.currentChapterId || '' });
    if (typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('save-success');
  } catch (e) {
    console.warn('수동저장 실패', e);
  }
}

function onyuLoadManualSlot(slotIndex) {
  try {
    var raw = localStorage.getItem(ONYU_SLOT_KEY_PREFIX + slotIndex);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function onyuDeleteManualSlot(slotIndex) {
  localStorage.removeItem(ONYU_SLOT_KEY_PREFIX + slotIndex);
}

function onyuLoadGalleryRecord() {
  try {
    var raw = localStorage.getItem(ONYU_GALLERY_KEY);
    var record = raw ? JSON.parse(raw) : null;
    if (!record || typeof record !== 'object') record = {};
    if (!record.cg || typeof record.cg !== 'object') record.cg = {};
    if (!record.cgFiles || typeof record.cgFiles !== 'object') record.cgFiles = {};
    if (!record.endings || typeof record.endings !== 'object') record.endings = {};
    return record;
  } catch (e) {
    return { cg: {}, cgFiles: {}, endings: {} };
  }
}

// 로컬 저장값은 사용자 측에서 임의로 바꿀 수 있으므로, 갤러리에서 사용할 CG는
// 해당 챕터에 실제로 허용된 파일명만 통과시킨다. 기존 버전에서 파일명 없이
// boolean만 저장된 기록은 의상 변형의 무료판을 기본값으로 복구한다.
function onyuGalleryCgFileForChapter(chapter, record) {
  if (!chapter || !record) return '';
  var variants = window.ONYU_OUTFIT_CG_VARIANTS && window.ONYU_OUTFIT_CG_VARIANTS[chapter.id];
  var allowed = variants ? [variants.free, variants.paid] : (chapter.cg ? [chapter.cg] : []);
  var saved = record.cgFiles && record.cgFiles[chapter.id];
  if (saved && allowed.indexOf(saved) !== -1) return saved;
  return allowed[0] || '';
}

function onyuUnlockGalleryItem(kind, id, metadata) {
  // kind: 'cg' | 'endings' — 언락 즉시 디스크에 반영(세이브 시점과 무관하게 영구 기록).
  var record = window.ONYU_STATE.unlockedGallery;
  if (!record[kind]) record[kind] = {};
  if (!record.cgFiles || typeof record.cgFiles !== 'object') record.cgFiles = {};
  var isNew = !record[kind][id];
  record[kind][id] = true;
  if (kind === 'cg' && metadata && metadata.file) {
    var chapter = (window.ONYU_CHAPTERS || []).find(function (item) { return item.id === id; });
    var allowedFile = onyuGalleryCgFileForChapter(chapter, { cgFiles: { [id]: metadata.file } });
    if (allowedFile === metadata.file) record.cgFiles[id] = metadata.file;
  }
  if (isNew && typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('gallery-unlock');
  if (isNew && typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('gallery_unlock', { kind: kind, itemId: id });
  try {
    localStorage.setItem(ONYU_GALLERY_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn('갤러리 기록 저장 실패', e);
  }
}

function onyuBootLoadGallery() {
  window.ONYU_STATE.unlockedGallery = onyuLoadGalleryRecord();
}

function onyuSaveSettings() {
  try {
    localStorage.setItem(ONYU_SETTINGS_KEY, JSON.stringify(window.ONYU_STATE.settings));
  } catch (e) {
    console.warn('설정 저장 실패', e);
  }
}

function onyuBootLoadSettings() {
  try {
    var raw = localStorage.getItem(ONYU_SETTINGS_KEY);
    if (raw) {
      var saved = JSON.parse(raw);
      Object.keys(saved).forEach(function (key) { window.ONYU_STATE.settings[key] = saved[key]; });
    }
  } catch (e) { /* 저장된 설정이 없거나 손상된 경우 기본값 유지 */ }
}
