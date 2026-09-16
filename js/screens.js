/*
 * 화면 전환. 타이틀 · 플레이 · 챕터선택 · 갤러리 · 저장 · 설정 6개 화면 전부 실제로
 * 존재한다. 목업은 라디오+CSS로 화면을 껐지만, 실제 게임은 챕터 잠금 상태 등 동적
 * 데이터가 필요해서 JS로 전환한다.
 */

// 챕터선택/갤러리/저장/설정 화면의 "← 타이틀로" 버튼이 어디로 돌아가야 하는지 —
// 타이틀에서 들어왔으면 타이틀로, 플레이 중 상단바 아이콘으로 들어왔으면 플레이로.
var onyuReturnScreen = 'title';

var ONYU_TRANSITION_FADE_MS = 1000; // #screen-transition-overlay의 CSS transition 시간과 맞출 것 — 힐링물 톤에 맞춰 느긋하게(2026-09-16, 배경·CG 페이드 전부 1s로 통일)
var onyuTransitionDepth = 0; // >0이면 이미 오버레이가 화면을 덮고 있는 중 — 중첩 페이드 방지

// 실제 화면 전환(class 토글 + 각 화면의 렌더 함수 호출)은 항상 오버레이가 화면을
// 완전히 덮은 시점에만 일어나야 한다 — 그래야 전환 도중에 이전/다음 화면이 잠깐
// 비치는 일이 없다. onyuRunTransition의 callback으로만 호출하고, 직접 부르지 않는다.
function onyuSwapScreen(name) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.toggle('is-active', el.dataset.screen === name);
  });
  // 타이틀은 세로로 봐도 무방하지만, 나머지 화면은 전부 이 게임 고유의 좌우 분할/
  // 가로 전용 레이아웃이라 세로 화면에선 안 돌아간다 — 회전 안내 오버레이는 이
  // 클래스 + CSS의 (orientation: portrait) 미디어쿼리 조합으로 뜬다.
  document.body.classList.toggle('onyu-in-game', name !== 'title');

  if (name === 'chapters' && typeof onyuRenderChapterList === 'function') onyuRenderChapterList();
  if (name === 'gallery' && typeof onyuRenderGallery === 'function') onyuRenderGallery();
  if (name === 'save' && typeof onyuRenderSaveScreen === 'function') onyuRenderSaveScreen();
  if (name === 'settings' && typeof onyuRenderSettingsScreen === 'function') onyuRenderSettingsScreen();

  onyuUpdateBackButtonLabels();
}

// 모든 메뉴 이동(타이틀↔4개 화면, 플레이 상단바 아이콘 등)에 공용으로 쓰는 가벼운
// 화면 전환 — 페이드로 덮었다 걷는다. 이미 그 화면이면(예: 부팅 시 title로 최초
// 진입) 페이드 없이 그냥 렌더만 다시 한다.
function onyuShowScreen(name) {
  var current = document.querySelector('.screen.is-active');
  if (current && current.dataset.screen === name) {
    onyuSwapScreen(name);
    return;
  }
  onyuRunTransition({}, function () { onyuSwapScreen(name); });
}

// 화면 전환 오버레이 — 페이드인(덮기) → (옵션) 대기 시간 동안 챕터 타이틀 카드
// 노출 → callback 실행(실제 내용 교체) → 곧장 페이드아웃(걷기). 챕터↔챕터 전환처럼
// "잠깐 쉬어가는" 느낌이 필요한 곳은 holdMs/chapterLabel을 넘기고, 단순 메뉴 이동은
// 옵션 없이 기본 페이드만 쓴다. 이미 다른 전환이 화면을 덮고 있는 도중(예: 챕터
// 전환 콜백 안에서 onyuStartChapter가 다시 이 함수를 호출하는 경우)이거나 모션
// 줄이기가 켜져 있으면 페이드 없이 callback을 즉시 실행한다(중첩 깜빡임 방지).
function onyuRunTransition(options, callback) {
  options = options || {};
  if (onyuTransitionDepth > 0 || window.ONYU_STATE.settings.reduceMotion) {
    callback();
    return;
  }
  var holdMs = options.holdMs || 0;
  var chapterLabel = options.chapterLabel || '';
  var cgFile = options.cg || ''; // CG 노출 시스템 Mechanism 3(학년 전환 컷 09·19) 전용
  var overlay = document.getElementById('screen-transition-overlay');
  var label = document.getElementById('screen-transition-label');
  var cgImg = onyuEl.transitionCg;

  onyuTransitionDepth++;
  onyuLockInput();
  label.textContent = chapterLabel;
  label.classList.toggle('is-visible', !!chapterLabel);
  if (cgFile) {
    cgImg.onerror = function () { cgImg.classList.remove('is-visible'); }; // 파일 없으면 조용히 안 보임
    cgImg.src = 'assets/cg/' + cgFile;
    cgImg.classList.add('is-visible');
  } else {
    cgImg.classList.remove('is-visible');
  }
  overlay.classList.add('is-active');

  setTimeout(function () {
    setTimeout(function () {
      callback();
      overlay.classList.remove('is-active');
      label.classList.remove('is-visible');
      cgImg.classList.remove('is-visible');
      onyuTransitionDepth--;
      // .is-active를 제거하면 CSS 페이드아웃(1초)이 시작되지만, 그 즉시
      // 잠금을 풀면 투명해지는 마지막 구간의 클릭/터치가 새 대사를 진행시킨다.
      // 실제 페이드가 끝난 뒤에만 입력을 다시 허용한다.
      setTimeout(onyuUnlockInput, ONYU_TRANSITION_FADE_MS);
    }, holdMs);
  }, ONYU_TRANSITION_FADE_MS);
}

// 저장·설정 화면은 타이틀뿐 아니라 플레이 중에도 진입 가능해서, "뒤로" 버튼이
// 실제로 어디로 돌아가는지가 매번 다르다 — 문구를 "타이틀로"로 고정해두면
// 플레이 중 진입했을 때 실제로는 플레이로 돌아가면서 문구만 "타이틀로"라고
// 나와 사용자가 오해할 수 있다(실사용 피드백으로 발견). 화면을 보여줄 때마다
// 지금 onyuReturnScreen 값에 맞춰 문구를 다시 맞춘다(챕터선택·갤러리는 항상
// title에서만 들어오므로 이 값이 항상 'title'로 계산돼 기존 문구와 동일하다).
function onyuUpdateBackButtonLabels() {
  var target = (onyuReturnScreen === 'play') ? '플레이' : '타이틀';
  document.querySelectorAll('.sub-back[data-back]').forEach(function (btn) {
    btn.textContent = '← ' + target + '로';
  });
  document.querySelectorAll('.settings-danger-btn[data-back]').forEach(function (btn) {
    btn.textContent = target + '로 돌아가기';
  });
}

// 챕터선택/갤러리/저장/설정으로 들어갈 때 이 함수로 진입 — 지금 활성 화면이 play면
// "뒤로" 눌렀을 때 play로 돌아가고, 그 외(title)에서 들어왔으면 title로 돌아간다.
function onyuNavigateTo(name) {
  var current = document.querySelector('.screen.is-active');
  onyuReturnScreen = (current && current.dataset.screen === 'play') ? 'play' : 'title';
  onyuShowScreen(name);
}

function onyuNavigateBack() {
  onyuShowScreen(onyuReturnScreen);
}

function onyuTryLockLandscape() {
  // Android Chrome/Firefox 등은 지원하지만 iOS Safari는 이 API 자체가 없고, 대부분의
  // 브라우저가 전체화면 상태여야만 lock을 허용한다 — 실패해도 조용히 넘어가고,
  // 대신 CSS 회전 안내 오버레이가 모든 기기에서 동일하게 보완한다.
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(function () {});
  }
}

function onyuRequestFullscreen() {
  // 전체화면 진입이 실제로 끝난 뒤에 방향 고정을 시도해야 성공률이 높다(대부분의
  // 브라우저가 전체화면 상태를 방향 고정의 전제조건으로 요구).
  var el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().then(onyuTryLockLandscape).catch(function () { /* 미지원/거부 시 조용히 일반 화면 진행 */ });
  } else {
    onyuTryLockLandscape(); // Fullscreen API 자체가 없는 환경에서도 밑져야 본전으로 시도
  }
}

// 모바일에서 스와이프 제스처·홈 버튼 등으로 전체화면이 풀리는 경우가 흔하다.
// Fullscreen API는 사용자 제스처 없이는 재요청이 막히므로, 게임 진행 중 화면을
// 터치하는 그 순간(이미 사용자 제스처)에 슬쩍 끼워서 다시 전체화면으로 되돌린다.
function onyuMaybeRecoverFullscreen() {
  if (document.body.classList.contains('onyu-in-game') && !document.fullscreenElement) {
    onyuRequestFullscreen();
  }
}
