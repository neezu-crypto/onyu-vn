/*
 * 화면 전환. 지금은 타이틀 · 플레이 두 화면만 실제로 존재한다(Phase 3에서 챕터선택 ·
 * 갤러리 · 저장 · 설정 추가 예정). 목업은 라디오+CSS로 화면을 껐지만, 실제 게임은
 * 챕터 잠금 상태 등 동적 데이터가 필요해서 JS로 전환한다.
 */

function onyuShowScreen(name) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.toggle('is-active', el.dataset.screen === name);
  });
}

function onyuRequestFullscreen() {
  var el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(function () { /* 미지원/거부 시 조용히 일반 화면 진행 */ });
  }
}
