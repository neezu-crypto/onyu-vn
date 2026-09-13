/*
 * 게임 상태. localStorage 저장/로드는 save.js가 담당하고, 여기서는 순수 상태 객체와
 * 상태를 만지는 헬퍼만 둔다.
 */

window.ONYU_STATE = {
  playerName: '',
  affection: 0,
  addressStage: 0, // 0: 초반 호칭, 1: 이름으로(CH13~), 2: 애칭(연인 엔딩)
  currentChapterId: null,
  chapterCheckpoints: {}, // { [chapterId]: affection at chapter start } — 타임머신용
  completedChapters: {}, // { [chapterId]: true } — "이미 읽은 텍스트 스킵" 판단용(챕터 단위)
  unlockedGallery: { cg: {}, endings: {} }, // 세이브와 무관한 영구 기록
  settings: {
    textSpeed: 'normal', // 'slow' | 'normal' | 'fast'
    autoPlay: false,
    skipRead: true,
    reduceMotion: false,
    bgmVolume: 0.7,
    sfxVolume: 0.85,
  },
};

function onyuChapterIndexById(id) {
  return window.ONYU_CHAPTERS.findIndex(function (c) { return c.id === id; });
}

function onyuResetNewGame() {
  window.ONYU_STATE.playerName = '';
  window.ONYU_STATE.affection = 0;
  window.ONYU_STATE.addressStage = 0;
  window.ONYU_STATE.currentChapterId = window.ONYU_CHAPTERS[0].id;
  window.ONYU_STATE.chapterCheckpoints = {};
  window.ONYU_STATE.completedChapters = {};
  // unlockedGallery는 의도적으로 초기화하지 않는다 — 새 게임을 시작해도 이미 언락한
  // CG·엔딩 기록은 영구 보존(기획서 SAVE & UI 원칙).
}
