/*
 * 화면 전환. 타이틀 · 플레이 · 챕터선택 · 갤러리 · 저장 · 설정 6개 화면 전부 실제로
 * 존재한다. 목업은 라디오+CSS로 화면을 껐지만, 실제 게임은 챕터 잠금 상태 등 동적
 * 데이터가 필요해서 JS로 전환한다.
 */

// 챕터선택/갤러리/저장/설정 화면의 "← 타이틀로" 버튼이 어디로 돌아가야 하는지 —
// 타이틀에서 들어왔으면 타이틀로, 플레이 중 상단바 아이콘으로 들어왔으면 플레이로.
var onyuReturnScreen = 'title';

function onyuShowScreen(name) {
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
