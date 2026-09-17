/* 부트스트랩 — DOM 참조 연결 + 타이틀 화면 버튼 배선. */

// 스탠딩 12장(장당 1.5~2MB)을 표정이 바뀌는 그 순간 처음 요청하면 네트워크·디코딩
// 지연 때문에 "대사는 바로 나오는데 표정만 한 박자 늦게 바뀌는" 현상이 생긴다.
// 그래서 페이지 로드 즉시(타이틀 화면을 보는 동안) 미리 받아서 브라우저 캐시에
// 데워둔다 — onyuApplySprite()가 나중에 .src를 바꿀 때는 캐시 히트라 즉시 반영된다.
// s/w(교복) 12장과 함께, 이미 확정돼 챕터에 고정 배선된 g(체육복 CH05)·a(활동복
// CH20/21) 12장도 여기 포함한다 — 이 둘은 chapter.spriteSet에 직접 못박힌 채로
// 항상 쓰이므로 s/w와 성격이 같다(조건부 후보가 아님). 실제 화면에 뜨기 전까지는
// 존재 확인이 필요 없어 probe 없이 바로 프리로드.
var onyuPreloadedSprites = [];
['s1', 's2', 's3', 's4', 's5', 's6', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6',
 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'].forEach(function (name) {
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
// 재사용 13곳 중 어디에도 안 맞아 추가된 전용 배경(CH06 b14, CH15 b15)과,
// 계절 자동감지 대상이 아니라 ONYU_BG_SEASON_VARIANTS를 안 타는 챕터별 직접
// 오버라이드(CH04 b3-rain)는 위 루프에 안 걸려서 프리로드가 빠져 있었다 —
// 셋 다 이미 확정돼 실제 쓰이는 파일이라 g/a 스탠딩과 같은 이유로 바로 추가.
['b14', 'b15', 'b3-rain'].forEach(function (name) {
  var bgImg = new Image();
  bgImg.src = 'assets/backgrounds/' + name + '.png';
  onyuPreloadedBackgrounds.push(bgImg);
});

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

// 스탠딩 파일명 접두사(assets/standing/{prefix}1.png)가 실제로 존재하는지 부팅 시
// probe해서 onyuSpriteVariantAvailable에 캐시해두는 공용 헬퍼 — 배경 계절변형과
// 같은 패턴. outfit-picker.js(사복 후원 픽커)와 아래 ONYU_SPRITE_CANDIDATES(후보
// 없이 이미지만 있으면 바로 쓰는 단일 세트, 예: CH27 졸업 가운)가 공유해서 쓴다.
var onyuSpriteVariantAvailable = {};
function onyuProbeSpritePrefix(prefix) {
  if (prefix in onyuSpriteVariantAvailable) return; // 이미 probe했으면 중복 요청 안 함
  onyuSpriteVariantAvailable[prefix] = false;
  var probe = new Image();
  probe.onload = function () {
    onyuSpriteVariantAvailable[prefix] = true;
    // 1번(표정 probe용) 말고 나머지 5장도 존재가 확인된 시점에 마저 프리로드—
    // 안 그러면 이 세트로 표정이 처음 바뀌는 순간에만 s/w 12장과 똑같은 "대사는
    // 나왔는데 표정만 한 박자 늦게 바뀌는" 네트워크·디코딩 지연이 재현된다.
    for (var n = 2; n <= 6; n++) {
      var img = new Image();
      img.src = 'assets/standing/' + prefix + n + '.png';
      onyuPreloadedSprites.push(img);
    }
  };
  probe.src = 'assets/standing/' + prefix + '1.png';
}

// "후보 없이 이미지만 있으면 바로 쓰는" 단일 스탠딩 세트. 사복처럼 무료/후원 2종
// 중 골라야 하는 챕터는 outfit-picker.js의 ONYU_OUTFIT_CHOICES가 따로 담당한다.
var ONYU_SPRITE_CANDIDATES = {
  ch27: ['GR-'], // 졸업식 — 졸업 가운, 후보 없이 하나뿐
};
Object.keys(ONYU_SPRITE_CANDIDATES).forEach(function (chapterId) {
  ONYU_SPRITE_CANDIDATES[chapterId].forEach(onyuProbeSpritePrefix);
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
  onyuEl.uiToggleBtn = document.getElementById('play-ui-toggle-btn');
  onyuEl.endingOverlay = document.getElementById('ending-overlay');
  onyuEl.endingKicker = document.getElementById('ending-kicker');
  onyuEl.endingTitle = document.getElementById('ending-title');
  onyuEl.cgViewerOverlay = document.getElementById('cg-viewer-overlay');
  onyuEl.cgViewerImg = document.getElementById('cg-viewer-img');
  onyuEl.cgViewerHint = document.getElementById('cg-viewer-hint');
  onyuEl.endingCreditsOverlay = document.getElementById('ending-credits-overlay');
  onyuEl.endingCreditsImg = document.getElementById('ending-credits-img');
  onyuEl.transitionCg = document.getElementById('screen-transition-cg');

  // CH27 완주 후 엔딩 화면의 "타이틀로 돌아가기" — state는 그대로 두고(새 게임을
  // 눌러야 리셋됨, 다른 타이틀 메뉴 이동과 동일 원칙) 화면만 전환한다. 시그니처
  // 오프닝은 페이지 전용 24시간 주기를 따르므로 직접 재생하지 않고 공통 게이트를
  // 호출한다.
  document.getElementById('ending-title-btn').addEventListener('click', function () {
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('return_to_title');
    onyuEl.endingOverlay.classList.remove('is-active');
    // 시그니처 오프닝을 띄우기 전에 플레이 화면을 먼저 숨기고 타이틀을
    // 하위 레이어에 준비한다. 기존에는 엔딩 오버레이를 300ms 뒤에 숨긴 다음
    // 오프닝을 시작해, 이전 플레이 화면의 CG가 오프닝 아래로 비칠 수 있었다.
    // 즉시 화면을 교체하므로 시그니처가 재생되는 처음부터 타이틀이 안전하게
    // 배경으로 깔린다.
    onyuEl.endingOverlay.hidden = true;
    onyuSwapScreen('title');
    onyuMaybeShowBootSplash(function () { onyuSwapScreen('title'); });
  });

  // 대사창뿐 아니라 플레이 화면 빈 곳 아무 데나 클릭해도 진행되게(모바일 시청 편의).
  // 선택지·이름입력 중에는 onyuHandleDialogueClick 자체가 no-op이라 별도 예외 처리가 필요 없다.
  document.getElementById('screen-play').addEventListener('click', onyuHandleDialogueClick);
  onyuEl.uiToggleBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    onyuToggleUi();
  });
  document.addEventListener('keydown', function (e) {
    var activeScreen = document.querySelector('.screen.is-active');
    if (!activeScreen || activeScreen.dataset.screen !== 'play') return;
    var target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      onyuToggleUi();
    } else if (e.key === 'Escape' && onyuUiHidden) {
      e.preventDefault();
      onyuShowUi();
    }
  });
  onyuEl.nameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    onyuSubmitName();
  });

  // 표지 CG(기획서 CG #1)가 준비되면 자동으로 타이틀 배경을 그쪽으로 교체.
  // 세로형 스탠딩 컷(.title-figure)과 달리 가로형 풀신이라 화면 전체를 덮는
  // 별도 레이어(#title-cover-bg)로 깔고, 기존 스탠딩 컷은 숨긴다(css의
  // #screen-title.is-cg-cover 규칙 참고). 로드가 끝날 때까지(성공이든 404
  // 실패든) #title-loading 핑크 로딩화면이 전부 가리고 있어서, 스탠딩 컷이
  // 잠깐 보였다가 CG로 바뀌는 깜빡임이 없다 - 실패 시엔 로딩화면만 걷고
  // 기존처럼 스탠딩 일러스트 폴백을 그대로 노출.
  (function tryTitleCoverCg() {
    var coverBg = document.getElementById('title-cover-bg');
    var loading = document.getElementById('title-loading');
    var phraseEl = document.getElementById('title-loading-phrase');

    // 로딩 문구 로테이션(2026-09-15, 사용자 지시) - 10개를 무작위 순서로 돌며
    // 페이드 교차. CG 로드가 끝나면(성공/실패 모두) stopPhraseRotation으로 정리.
    var phrases = [
      '온이유 만나러 가는 중',
      '벚꽃 잎을 하나씩 세는 중',
      '교실 문 앞에서 숨 고르는 중',
      '우산 하나를 나눠 쓸 준비하는 중',
      '첫눈 오는 날을 기다리는 중',
      '편지지에 마음을 옮겨 적는 중',
      '이름을 불러볼 용기를 내는 중',
      '함께 걸을 하굣길을 그리는 중',
      '두근거림을 살짝 숨기는 중',
      '세 번째 계절을 준비하는 중',
    ];
    var phraseOrder = phrases.map(function (_, i) { return i; });
    for (var i = phraseOrder.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = phraseOrder[i]; phraseOrder[i] = phraseOrder[j]; phraseOrder[j] = tmp;
    }
    var phraseIdx = 0;
    var phraseTimer = null;
    function showNextPhrase() {
      phraseEl.classList.remove('is-visible');
      setTimeout(function () {
        phraseEl.textContent = phrases[phraseOrder[phraseIdx % phraseOrder.length]];
        phraseEl.classList.add('is-visible');
        phraseIdx++;
      }, 350);
    }
    showNextPhrase();
    phraseTimer = setInterval(showNextPhrase, 2200);
    function stopPhraseRotation() {
      if (phraseTimer) { clearInterval(phraseTimer); phraseTimer = null; }
    }

    var probe = new Image();
    probe.onload = function () {
      coverBg.src = 'assets/cg/cover.png';
      coverBg.hidden = false;
      document.getElementById('screen-title').classList.add('is-cg-cover');
      loading.classList.add('is-hidden');
      stopPhraseRotation();
    };
    probe.onerror = function () {
      loading.classList.add('is-hidden');
      stopPhraseRotation();
    };
    probe.src = 'assets/cg/cover.png';
  })();

  var continueBtn = document.getElementById('title-continue');
  var autosave = onyuLoadAutosave();
  if (!autosave) {
    continueBtn.disabled = true;
    continueBtn.classList.add('is-disabled');
  }

  function startNewGameAfterAccess() {
    onyuResetNewGame();
    onyuRequestFullscreen();
    window.onyuGameSessionActive = true;
    window.onyuGameCompleted = false;
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_started', { resumed: false });
    onyuStartChapter(window.ONYU_STATE.currentChapterId);
  }
  document.getElementById('title-new-game').addEventListener('click', function () {
    if (window.onyuEnsureGameAccess) window.onyuEnsureGameAccess().then(function (allowed) { if (allowed) startNewGameAfterAccess(); });
    else startNewGameAfterAccess();
  });

  continueBtn.addEventListener('click', function () {
    var snap = onyuLoadAutosave();
    if (!snap || (typeof onyuIsValidSnapshot === 'function' && !onyuIsValidSnapshot(snap))) {
      if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'auto', reason: snap ? 'invalid' : 'missing' });
      return;
    }
    function continueAfterAccess() {
      try { onyuApplySnapshot(snap); } catch (error) {
        if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'auto', reason: 'exception' });
        return;
      }
      onyuRequestFullscreen();
      window.onyuGameSessionActive = true;
      window.onyuGameCompleted = false;
      if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_started', { resumed: true, chapterId: snap.currentChapterId || '' });
      onyuStartChapter(snap.currentChapterId);
    }
    if (window.onyuEnsureGameAccess) window.onyuEnsureGameAccess().then(function (allowed) { if (allowed) continueAfterAccess(); });
    else continueAfterAccess();
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

  // 정상 부팅 시엔 페이지 전용 localStorage 타임스탬프 기준으로 24시간에 한 번
  // 시그니처 오프닝을 보여주고 타이틀로 진입한다.
  onyuMaybeShowBootSplash(function () {
    onyuShowScreen('title');
    if (typeof onyuAudioShowUnlockPrompt === 'function') onyuAudioShowUnlockPrompt();
  });
});
