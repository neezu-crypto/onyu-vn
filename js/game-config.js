/*
 * 게임 설정(온이유 전용 내용) — 미연시 엔진 분리 1단계(2026-11-27).
 * 엔진 파일(audio·engine·main·menus·outfit-picker·save)에 섞여 있던 게임별 표·키를
 * 이름과 값 그대로 이곳으로 옮겼다. 다른 게임은 이 파일과 game-data.js만 바꾼다.
 * game-data.js 바로 다음, 엔진 스크립트보다 먼저 불러온다.
 */

// 히로인(스탠딩 표정을 쓰는 화자) 키 — game-data.js의 line.speaker 값.
var ONYU_HEROINE_SPEAKER = 'onyu';

// ── 이전 위치: js/audio.js
var ONYU_BGM_TRACKS = {
  title: 'assets/bgm/T title-theme.mp3',
  // everyday-1/2는 같은 무드의 대체 버전이다. 챕터에 진입할 때마다 둘 중 하나를
  // 추첨해 같은 일상 무드라도 챕터별로 다른 곡이 나올 수 있게 한다.
  everyday: ['assets/bgm/01 everyday-1.mp3', 'assets/bgm/01 everyday-2.mp3'],
  flutter: 'assets/bgm/02 flutter.mp3',
  focus: 'assets/bgm/03 focus.mp3',
  friction: 'assets/bgm/04 friction.mp3',
  festival: 'assets/bgm/05 festival.mp3',
  reconcile: 'assets/bgm/06 reconcile.mp3',
  'ending-friend': 'assets/bgm/07 ending-friend.mp3',
  'ending-crush': 'assets/bgm/08 ending-crush.mp3',
  'ending-lover': 'assets/bgm/09 ending-lover.mp3',
};

// 갤러리에 표시할 BGM 목록. everyday는 같은 무드의 두 파일을 별도 곡으로
// 기록해, 실제로 한 번 재생한 버전만 다시 들을 수 있게 한다.
var ONYU_BGM_GALLERY_TRACKS = [
  { id: 'title', key: 'title', title: '타이틀 테마', subtitle: '타이틀 화면' },
  { id: 'everyday-1', key: 'everyday', variantIndex: 0, title: '평범한 하루 1', subtitle: '일상 무드' },
  { id: 'everyday-2', key: 'everyday', variantIndex: 1, title: '평범한 하루 2', subtitle: '일상 무드' },
  { id: 'flutter', key: 'flutter', title: '설렘', subtitle: '설렘 무드' },
  { id: 'focus', key: 'focus', title: '집중', subtitle: '집중 무드' },
  { id: 'friction', key: 'friction', title: '마찰', subtitle: '갈등 무드' },
  { id: 'festival', key: 'festival', title: '축제', subtitle: '축제 무드' },
  { id: 'reconcile', key: 'reconcile', title: '화해', subtitle: '화해 무드' },
  { id: 'ending-friend', key: 'ending-friend', title: '우정 엔딩', subtitle: '엔딩 BGM' },
  { id: 'ending-crush', key: 'ending-crush', title: '썸 엔딩', subtitle: '엔딩 BGM' },
  { id: 'ending-lover', key: 'ending-lover', title: '연인 엔딩', subtitle: '엔딩 BGM' },
];

var ONYU_BGM_BY_CHAPTER = {
  ch01: 'everyday', ch03: 'everyday', ch06: 'everyday',
  ch09: 'everyday', ch10: 'everyday', ch11: 'everyday', ch14: 'everyday',
  ch17: 'everyday', ch20: 'everyday',
  ch02: 'flutter', ch04: 'flutter', ch08: 'flutter', ch12: 'flutter', ch13: 'flutter',
  ch16: 'flutter', ch24: 'flutter',
  ch07: 'focus', ch18: 'focus', ch19: 'focus', ch25: 'focus',
  ch21: 'friction', ch22: 'friction',
  ch05: 'festival', ch15: 'festival',
  ch23: 'reconcile', ch26: 'reconcile', ch27: 'reconcile',
};

var ONYU_SFX_TRACKS = {
  'choice-select': 'assets/sfx/choice-select.mp3',
  'ending-title-reveal': 'assets/sfx/ending-title-reveal.mp3',
  'gallery-unlock': 'assets/sfx/gallery-unlock.mp3',
  'save-success': 'assets/sfx/save-success.mp3',
  'ui-toggle': 'assets/sfx/ui-toggle.mp3',
  'name-submit-error': 'assets/sfx/name-submit-error.mp3',
  'name-submit-ok': 'assets/sfx/name-submit-ok.mp3',
  'chapter-chime': 'assets/sfx/chapter-chime.mp3',
  'menu-transition': 'assets/sfx/menu-transition.mp3',
  'choice-appear': 'assets/sfx/choice-appear.mp3',
};


// ── 이전 위치: js/main.js
// "후보 없이 이미지만 있으면 바로 쓰는" 단일 스탠딩 세트. 사복처럼 무료/후원 2종
// 중 골라야 하는 챕터는 outfit-picker.js의 ONYU_OUTFIT_CHOICES가 따로 담당한다.
var ONYU_SPRITE_CANDIDATES = {
  ch27: ['GR-'], // 졸업식 — 졸업 가운, 후보 없이 하나뿐
};

// 일부 배경엔 계절 요소가 원화 자체에 그려져 있어(예: 교문 배경의 벚꽃) 다른
// 계절 챕터에 재사용하면 텍스트와 안 맞는 경우가 실사로 확인됐다(2026-09-14) —
// 가장 두드러진 곳들에 계절 전용 변형을 준비 중. 챕터 진입 시 해당 챕터에
// 필요한 변형 파일만 probe해서 onyuBgVariantAvailable에 캐시해두고,
// engine.js의 onyuApplyBackground()가 렌더 시점에 동기적으로 참조한다 — 파일이
// 아직 없으면(404) 조용히 기본 배경으로 폴백한다.
var ONYU_BG_SEASON_VARIANTS = {
  b2: ['winter'], b3: ['winter'], // CH08·CH27(교문) / CH26(하굣길) — 실제 적용됨
  b5: ['winter'], b6: ['autumn'], b8: ['winter'], b9: ['winter'], // CH07/CH05/CH17/CH16 — 프롬프트만 준비, 이미지 대기 중
};

// ── 이전 위치: js/menus.js
var ONYU_SEASON_COLORS = {
  spring: { accent: '#b8607e', soft: '#fbe7ee' },
  summer: { accent: '#3f8177', soft: '#e1f0ec' },
  autumn: { accent: '#a8632b', soft: '#f5e6d3' },
  winter: { accent: '#5d7f95', soft: '#e8eef2' },
};

var ONYU_ENDING_DEFS = [
  { id: 'friend', name: '곁에 남은 사람' },
  { id: 'crush', name: '여백' },
  { id: 'lover', name: '온 이유' },
];

// ── 이전 위치: js/outfit-picker.js
// { [chapterId]: { free, paid, price } } — 두 접두사 이미지가 assets/standing/에 실제로
// 있어야 픽커가 뜬다. 하나라도 없으면 조용히 기존 season 폴백으로 진행 — 이미지
// 파일만 두 프리픽스 다 넣으면 코드 수정 없이 바로 픽커가 활성화된다.
var ONYU_OUTFIT_CHOICES = {
  ch12: { free: 'C1-', paid: 'P1-', price: 50 },
  ch13: { free: 'C13-', paid: 'P13-', price: 50 },
  ch16: { free: 'C16-', paid: 'P16-', price: 50 },
  ch24: { free: 'C24-', paid: 'P24-', price: 50 },
};


// ── 이전 위치: js/save.js
var ONYU_AUTOSAVE_KEY = 'onyu_autosave_v1';
var ONYU_SLOT_KEY_PREFIX = 'onyu_slot_v1_';
var ONYU_GALLERY_KEY = 'onyu_gallery_v1';
var ONYU_SETTINGS_KEY = 'onyu_settings_v1';

// ── 이전 위치: js/engine.js
// onyu-vn-standing-prompts.html 기준 S1~S6 / W1~W6 표정 순서
var ONYU_EXPR_INDEX = { calm: 1, smile: 2, surprised: 3, shy: 4, worried: 5, pouty: 6 };

function onyuSpeakerLabel(key) {
  if (key === 'player') return window.ONYU_STATE.playerName || '플레이어';
  return window.SPEAKER_LABELS[key] || key;
}



// ── 엔진 분리 1단계-② (2026-11-27)
// 스탠딩 기본 세트 접두사(계절별). chapter.spriteSet·의상 선택이 없을 때 쓴다.
var ONYU_SEASON_SPRITE_PREFIX = { spring: 's', summer: 's', autumn: 'w', winter: 'w', default: 's' };

// 챕터 선택 화면의 묶음(chapter.grade 값 → 줄 이름).
var ONYU_CHAPTER_GROUPS = [
  { grade: 1, label: '1학년' },
  { grade: 2, label: '2학년' },
  { grade: 3, label: '3학년' },
];

// 이 게임의 서버 함수 이름(auth.js가 사용). 공용 로그인·인증 함수는 auth.js에 그대로 둔다.
var ONYU_SERVER_FUNCTIONS = {
  getViewerAccess: 'onyuGetViewerAccess',
  startSession: 'onyuStartSession',
  submitPlayerReview: 'onyuSubmitReview',
  submitStreamerProductionInquiry: 'onyuSubmitStreamerProductionInquiry',
  listPublicPlayerReviews: 'onyuVnListPublicReviews',
  trackEvents: 'onyuTrackEvents',
  logVerifiedOnyuStreamerVisit: 'onyuVnLogVerifiedStreamerVisit',
  getDonationIntegrationStatus: 'onyuGetDonationIntegrationStatus',
  refreshSoopChatToken: 'onyuRefreshSoopChatToken',
  setDonationIntegrationPreparation: 'onyuSetDonationIntegrationPreparation',
  registerOutfitDonationSession: 'onyuRegisterOutfitDonationSession',
  consumeOutfitDonationSession: 'onyuConsumeOutfitDonationSession',
  closeOutfitDonationSession: 'onyuCloseOutfitDonationSession',
  startSoopChatConsent: 'onyuStartSoopChatConsent',
  logDonationDiagnostics: 'onyuLogDonationDiagnostics',
};

// 엔진 공용 이름 공간: 다른 게임은 VN.* 로 읽는다(기존 ONYU_* 이름은 같은 객체를 가리키는 별칭).
var VN = window.VN = {
  gameId: 'onyuVn',
  heroineSpeaker: ONYU_HEROINE_SPEAKER,
  storageKeys: { autosave: ONYU_AUTOSAVE_KEY, slotPrefix: ONYU_SLOT_KEY_PREFIX, gallery: ONYU_GALLERY_KEY, settings: ONYU_SETTINGS_KEY },
  bgm: { tracks: ONYU_BGM_TRACKS, galleryTracks: ONYU_BGM_GALLERY_TRACKS, byChapter: ONYU_BGM_BY_CHAPTER },
  sfx: ONYU_SFX_TRACKS,
  sprites: { candidates: ONYU_SPRITE_CANDIDATES, seasonPrefix: ONYU_SEASON_SPRITE_PREFIX, exprIndex: ONYU_EXPR_INDEX },
  backgrounds: { seasonVariants: ONYU_BG_SEASON_VARIANTS },
  seasonColors: ONYU_SEASON_COLORS,
  endings: ONYU_ENDING_DEFS,
  outfitChoices: ONYU_OUTFIT_CHOICES,
  chapterGroups: ONYU_CHAPTER_GROUPS,
  serverFunctions: ONYU_SERVER_FUNCTIONS,
};
