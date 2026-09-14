/* 부트스트랩 — DOM 참조 연결 + 타이틀 화면 버튼 배선. */

// 스탠딩 12장(장당 1.5~2MB)을 표정이 바뀌는 그 순간 처음 요청하면 네트워크·디코딩
// 지연 때문에 "대사는 바로 나오는데 표정만 한 박자 늦게 바뀌는" 현상이 생긴다.
// 그래서 페이지 로드 즉시(타이틀 화면을 보는 동안) 미리 받아서 브라우저 캐시에
// 데워둔다 — onyuApplySprite()가 나중에 .src를 바꿀 때는 캐시 히트라 즉시 반영된다.
var onyuPreloadedSprites = [];
['s1', 's2', 's3', 's4', 's5', 's6', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'].forEach(function (name) {
  var img = new Image();
  img.src = 'assets/standing/' + name + '.png';
  onyuPreloadedSprites.push(img); // 참조를 들고 있어야 로드 도중 GC로 취소되지 않는다
});

// 재사용 배경 13종(B1~B13, 기획서 ARTWORK 기준)도 스탠딩과 같은 이유로 부팅 시 통째로
// 프리로드한다 — 개수가 적고(13장) 여러 챕터에서 계속 재사용되니 스탠딩과 성격이 같다.
var onyuPreloadedBackgrounds = [];
for (var onyuBgI = 1; onyuBgI <= 13; onyuBgI++) {
  var bgImg = new Image();
  bgImg.src = 'assets/backgrounds/b' + onyuBgI + '.png';
  onyuPreloadedBackgrounds.push(bgImg);
}

// 일부 배경엔 계절 요소가 원화 자체에 그려져 있어(예: 교문 배경의 벚꽃) 다른
// 계절 챕터에 재사용하면 텍스트와 안 맞는 경우가 실사로 확인됐다(2026-09-14) —
// 가장 두드러진 곳들에 계절 전용 변형을 준비 중. 부팅 시 "b2-winter.png" 같은
// 변형 파일이 실제로 존재하는지 미리 probe해서 onyuBgVariantAvailable에
// 캐시해두고, engine.js의 onyuApplyBackground()가 렌더 시점에 동기적으로
// 참조한다 — 파일이 아직 없으면(404) 조용히 기본 배경으로 폴백, 나중에 파일만
// 넣으면 이 목록에 추가하는 것만으로 코드 수정 없이 바로 적용된다.
var ONYU_BG_SEASON_VARIANTS = {
  b2: ['winter'], b3: ['winter'], // CH08·CH27(교문) / CH26(하굣길) — 실제 적용됨
  b5: ['winter'], b6: ['autumn'], b8: ['winter'], b9: ['winter'], // CH07/CH05/CH17/CH16 — 프롬프트만 준비, 이미지 대기 중
};
var onyuBgVariantAvailable = {};
Object.keys(ONYU_BG_SEASON_VARIANTS).forEach(function (key) {
  ONYU_BG_SEASON_VARIANTS[key].forEach(function (season) {
    var variantKey = key + '-' + season;
    var probe = new Image();
    probe.onload = function () { onyuBgVariantAvailable[variantKey] = true; };
    probe.onerror = function () { onyuBgVariantAvailable[variantKey] = false; };
    probe.src = 'assets/backgrounds/' + variantKey + '.png';
  });
});

// 사복 등 "후보 2종 중 택 1" 스탠딩 세트 — 최종 채택 전까지는 game-data.js의
// chapter.spriteSet에 직접 못박지 않고, 여기 우선순위 목록만 정의해둔다. 부팅 시
// 각 접두사의 1번 파일이 실제로 있는지 probe해서 먼저 발견되는 쪽을 그 챕터의
// 스탠딩으로 자동 채택한다 — onyu-vn-standing-prompts.html의 prompt-no(C1-/P1- 등)
// 표기를 그대로 파일명 접두사로 써서, 이미지 파일만 assets/standing/에 넣으면
// 코드 수정 없이 바로 적용된다(파일이 전혀 없으면 기존처럼 season 기반 s/w로 폴백).
// 우선순위는 대본 대조로 판단한 각 챕터의 정본 후보를 앞에 둔 것 — 순서를
// 바꾸고 싶으면 이 배열만 뒤집으면 된다.
var ONYU_SPRITE_CANDIDATES = {
  ch12: ['C1-', 'P1-'],   // 우연한 만남 — 편한 코디가 대본 톤에 더 맞음
  ch13: ['P13-', 'C13-'], // 첫 데이트 — 대본에 "신경 쓴 차림"이 명시돼 꾸민 쪽이 정본
  ch16: ['C16-', 'P16-'], // 크리스마스 — 대본에 옷차림 명시 없음, 둘 다 무방
  ch24: ['C24-', 'P24-'], // 둘만의 하루 — 피시방행이라 편한 코디가 더 맞음
  ch27: ['GR-'],          // 졸업식 — 후보 없이 하나뿐
};
var onyuSpriteVariantAvailable = {};
Object.keys(ONYU_SPRITE_CANDIDATES).forEach(function (chapterId) {
  ONYU_SPRITE_CANDIDATES[chapterId].forEach(function (prefix) {
    var probe = new Image();
    probe.onload = function () { onyuSpriteVariantAvailable[prefix] = true; };
    probe.onerror = function () { onyuSpriteVariantAvailable[prefix] = false; };
    probe.src = 'assets/standing/' + prefix + '1.png';
  });
});

function onyuResolveSpriteCandidate(chapterId) {
  var candidates = ONYU_SPRITE_CANDIDATES[chapterId];
  if (!candidates) return null;
  for (var i = 0; i < candidates.length; i++) {
    if (onyuSpriteVariantAvailable[candidates[i]]) return candidates[i];
  }
  return null;
}

document.addEventListener('DOMContentLoaded', function () {
  onyuBootLoadGallery();
  onyuBootLoadSettings();

  onyuEl.bg = document.getElementById('play-bg');
  onyuEl.chapterTag = document.getElementById('play-chapter-tag');
  onyuEl.spriteWrap = document.getElementById('play-sprite-wrap');
  onyuEl.spriteImg = document.getElementById('play-sprite-img');
  onyuEl.particleLayer = document.getElementById('play-particle-layer');
  onyuEl.speakerTag = document.getElementById('play-speaker-tag');
  onyuEl.dialogueLine = document.getElementById('play-dialogue-line');
  onyuEl.situation = document.getElementById('play-situation');
  onyuEl.choiceList = document.getElementById('play-choice-list');
  onyuEl.nameForm = document.getElementById('play-name-form');
  onyuEl.nameInput = document.getElementById('play-name-input');
  onyuEl.nameError = document.getElementById('play-name-error');
  onyuEl.dialogueBox = document.getElementById('dialogue-box');

  // 대사창뿐 아니라 플레이 화면 빈 곳 아무 데나 클릭해도 진행되게(모바일 시청 편의).
  // 선택지·이름입력 중에는 onyuHandleDialogueClick 자체가 no-op이라 별도 예외 처리가 필요 없다.
  document.getElementById('screen-play').addEventListener('click', onyuHandleDialogueClick);
  onyuEl.nameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    onyuSubmitName();
  });

  // 표지 CG(기획서 CG #1)가 준비되면 자동으로 타이틀 일러스트를 그쪽으로 교체.
  // 아직 없으면(404) 지금처럼 스탠딩 일러스트를 그대로 쓴다.
  (function tryTitleCoverCg() {
    var titleImg = document.querySelector('.title-figure img');
    var probe = new Image();
    probe.onload = function () { titleImg.src = 'assets/cg/cover.png'; };
    probe.src = 'assets/cg/cover.png';
  })();

  var continueBtn = document.getElementById('title-continue');
  var autosave = onyuLoadAutosave();
  if (!autosave) {
    continueBtn.disabled = true;
    continueBtn.classList.add('is-disabled');
  }

  document.getElementById('title-new-game').addEventListener('click', function () {
    onyuResetNewGame();
    onyuRequestFullscreen();
    onyuStartChapter(window.ONYU_STATE.currentChapterId);
  });

  continueBtn.addEventListener('click', function () {
    var snap = onyuLoadAutosave();
    if (!snap) return;
    onyuApplySnapshot(snap);
    onyuRequestFullscreen();
    onyuStartChapter(snap.currentChapterId);
  });

  // 회전 안내 화면을 탭하면 그 탭 자체(유효한 사용자 제스처)로 전체화면 재시도 —
  // 일부 모바일 브라우저는 새 게임/이어하기 클릭 시점의 requestFullscreen이 조용히
  // 실패하는 경우가 있어(주소창이 그대로 남음), 세로 화면일 때 계속 떠 있는 이
  // 오버레이가 다시 시도할 자연스러운 탭 지점이 되어준다.
  document.getElementById('rotate-overlay').addEventListener('click', onyuRequestFullscreen);

  document.getElementById('title-chapters').addEventListener('click', function () { onyuNavigateTo('chapters'); });
  document.getElementById('title-gallery').addEventListener('click', function () { onyuNavigateTo('gallery'); });
  document.getElementById('title-save').addEventListener('click', function () { onyuNavigateTo('save'); });
  document.getElementById('title-settings').addEventListener('click', function () { onyuNavigateTo('settings'); });

  // 플레이 화면 상단바 아이콘 — 저장/설정은 플레이 중에도 접근 가능. 같은 'save'
  // 화면이 title-save를 통해서도 열리지만, onyuReturnScreen이 'play'인지 'title'인지에
  // 따라 menus.js가 슬롯 클릭 동작을 저장/불러오기로 다르게 배선한다.
  document.getElementById('play-save-btn').addEventListener('click', function () { onyuNavigateTo('save'); });
  document.getElementById('play-settings-btn').addEventListener('click', function () { onyuNavigateTo('settings'); });

  document.querySelectorAll('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', onyuNavigateBack);
  });

  onyuInitGallerySubtabs();
  onyuInitSettingsControls();

  onyuShowScreen('title');
});
