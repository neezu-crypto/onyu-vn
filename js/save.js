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
  var chapter = (window.ONYU_CHAPTERS || []).find(function (item) { return item.id === s.currentChapterId; });
  var thumbnailBackground = chapter && chapter.bg ? chapter.bg : '';
  // 플레이 중 실제로 보고 있던 배경(챕터 안에서 장소가 바뀐 경우 포함)을
  // 저장한다. 엔진이 아직 초기화되지 않은 타이틀 화면에서는 챕터 기본값을 쓴다.
  if (typeof onyuCurrentBg !== 'undefined' && onyuCurrentBg) thumbnailBackground = onyuCurrentBg;
  return {
    playerName: s.playerName,
    affection: s.affection,
    addressStage: s.addressStage,
    currentChapterId: s.currentChapterId,
    chapterCheckpoints: s.chapterCheckpoints,
    completedChapters: s.completedChapters,
    chosenOutfits: s.chosenOutfits,
    thumbnail: { background: thumbnailBackground },
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
    if (!record.cgVariants || typeof record.cgVariants !== 'object') record.cgVariants = {};
    if (!record.endings || typeof record.endings !== 'object') record.endings = {};
    if (!record.bgm || typeof record.bgm !== 'object') record.bgm = {};
    return record;
  } catch (e) {
    return { cg: {}, cgFiles: {}, cgVariants: {}, endings: {}, bgm: {} };
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
  if (variants && record.cgVariants && record.cgVariants[chapter.id]) {
    for (var i = 0; i < allowed.length; i++) {
      if (record.cgVariants[chapter.id][allowed[i]]) return allowed[i];
    }
  }
  return allowed[0] || '';
}

// 갤러리에서 보여줄 CG 변형 목록. 의상 선택 챕터는 무료·꾸민 의상을
// 별도 카드로 만들고, 기존 챕터는 기존처럼 한 장만 만든다.
function onyuGalleryCgEntriesForChapter(chapter, record) {
  if (!chapter) return [];
  var variants = window.ONYU_OUTFIT_CG_VARIANTS && window.ONYU_OUTFIT_CG_VARIANTS[chapter.id];
  var files = variants ? [
    { file: variants.free, label: '편한 의상' },
    { file: variants.paid, label: '꾸민 의상' },
  ] : (chapter.cg ? [{ file: chapter.cg, label: '' }] : []);
  return files.map(function (entry) {
    var variantRecord = record && record.cgVariants && record.cgVariants[chapter.id];
    var savedFile = record && record.cgFiles && record.cgFiles[chapter.id];
    var hasVariantRecord = !!(variantRecord && typeof variantRecord === 'object'
      && Object.keys(variantRecord).length);
    // cgVariants 도입 전의 기록은 cgFiles에 저장된 선택 변형만 복구한다.
    // 파일 정보가 전혀 없는 오래된 기록은 무료 변형을 기본 복구한다.
    var unlocked = !!(variantRecord && variantRecord[entry.file])
      || savedFile === entry.file
      || (!hasVariantRecord && !savedFile && record && record.cg && record.cg[chapter.id]
        && (!variants || entry.file === variants.free));
    return { file: entry.file, label: entry.label, unlocked: unlocked };
  });
}

// 엔딩 크레딧에서 재생할, 실제로 해금된 파일만 반환한다.
function onyuGalleryUnlockedCgFilesForChapter(chapter, record) {
  return onyuGalleryCgEntriesForChapter(chapter, record).filter(function (entry) {
    return entry.unlocked;
  }).map(function (entry) { return entry.file; });
}

function onyuUnlockGalleryItem(kind, id, metadata) {
  // kind: 'cg' | 'endings' | 'bgm' — 언락 즉시 디스크에 반영(세이브 시점과 무관하게 영구 기록).
  var record = window.ONYU_STATE.unlockedGallery;
  if (!record[kind]) record[kind] = {};
  if (!record.cgFiles || typeof record.cgFiles !== 'object') record.cgFiles = {};
  if (!record.cgVariants || typeof record.cgVariants !== 'object') record.cgVariants = {};
  var isNew = !record[kind][id];
  var isNewCgVariant = false;
  record[kind][id] = true;
  if (kind === 'cg' && metadata && metadata.file) {
    var chapter = (window.ONYU_CHAPTERS || []).find(function (item) { return item.id === id; });
    var allowedFile = onyuGalleryCgFileForChapter(chapter, { cgFiles: { [id]: metadata.file } });
    if (allowedFile === metadata.file) {
      if (!record.cgVariants[id] || typeof record.cgVariants[id] !== 'object') record.cgVariants[id] = {};
      var outfitVariants = window.ONYU_OUTFIT_CG_VARIANTS && window.ONYU_OUTFIT_CG_VARIANTS[id];
      var wasLegacyUnlocked = !record.cgVariants[id][metadata.file]
        && record.cg[id]
        && (!record.cgFiles[id] && (!outfitVariants || metadata.file === outfitVariants.free));
      isNewCgVariant = !record.cgVariants[id][metadata.file] && !record.cgFiles[id] && !wasLegacyUnlocked;
      record.cgVariants[id][metadata.file] = true;
      record.cgFiles[id] = metadata.file;
    }
  }
  if ((isNew || isNewCgVariant) && typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('gallery-unlock');
  if ((isNew || isNewCgVariant) && typeof window.onyuTelemetryTrack === 'function') {
    window.onyuTelemetryTrack('gallery_unlock', { kind: kind, itemId: id, variant: metadata && metadata.file || '' });
  }
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
