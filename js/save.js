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

function onyuSaveAutosave() {
  try {
    localStorage.setItem(ONYU_AUTOSAVE_KEY, JSON.stringify(onyuSnapshotState()));
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
    return raw ? JSON.parse(raw) : { cg: {}, endings: {} };
  } catch (e) {
    return { cg: {}, endings: {} };
  }
}

function onyuUnlockGalleryItem(kind, id) {
  // kind: 'cg' | 'endings' — 언락 즉시 디스크에 반영(세이브 시점과 무관하게 영구 기록).
  var record = window.ONYU_STATE.unlockedGallery;
  if (!record[kind]) record[kind] = {};
  record[kind][id] = true;
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
