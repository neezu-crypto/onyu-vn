/*
 * 화면 전환. 지금은 타이틀 · 플레이 두 화면만 실제로 존재한다(Phase 3에서 챕터선택 ·
 * 갤러리 · 저장 · 설정 추가 예정). 목업은 라디오+CSS로 화면을 껐지만, 실제 게임은
 * 챕터 잠금 상태 등 동적 데이터가 필요해서 JS로 전환한다.
 */

function onyuShowScreen(name) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.toggle('is-active', el.dataset.screen === name);
  });
  // 타이틀은 세로로 봐도 무방하지만, 실제 플레이 화면(과 앞으로 추가될 챕터선택·
  // 갤러리 등)은 좌우 분할 레이아웃이라 세로 화면에선 안 돌아간다 — 회전 안내
  // 오버레이는 이 클래스 + CSS의 (orientation: portrait) 미디어쿼리 조합으로 뜬다.
  document.body.classList.toggle('onyu-in-game', name !== 'title');
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
