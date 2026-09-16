/*
 * 오목지면시그 시그니처 오프닝 — 6개 게임 공용 브랜드 모먼트(기획서 아티팩트
 * https://claude.ai/code/artifact/0ccfdea6-acc9-42b5-b22e-e94cccde4e22 기준).
 * "스트리머 게임시리즈" 라벨 → 게임 라인업 릴이 이 게임 이름에 정지 → "제작
 * 오목지면시그" 크레딧, 총 약 3.4초. 언제든 클릭/탭 한 번으로 스킵.
 *
 * 정상 부팅·엔딩 후 타이틀 복귀 모두 페이지 전용 localStorage 타임스탬프를
 * 사용해 24시간에 한 번만 표시한다.
 */

var ONYU_SIG_LAST_SHOWN_KEY = 'ojmSigSplashLastShown_onyuVn_v1';
var ONYU_SIG_INTERVAL_MS = 24 * 60 * 60 * 1000;
var ONYU_SIG_DURATION_MS = 3400;

function onyuPlaySigOpening(onDone) {
  var stage = document.getElementById('sig-opening-stage');
  var reduceMotion = window.ONYU_STATE.settings.reduceMotion;
  stage.classList.toggle('is-reduced-motion', reduceMotion);
  stage.classList.add('is-playing');

  var finished = false;
  var timer = setTimeout(finish, ONYU_SIG_DURATION_MS);
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    stage.removeEventListener('click', finish);
    stage.removeEventListener('keydown', onKeydown);
    // display:none으로 바로 끊지 않고 opacity 페이드아웃(.is-leaving)을 먼저
    // 걸어 게임 화면(또는 타이틀)으로 부드럽게 넘어가게 한다. is-playing은
    // 이 동안 그대로 둬서(display:flex 유지) 트랜지션이 실제로 재생될 시간을 번다.
    stage.classList.add('is-leaving');
    var fadeMs = reduceMotion ? 0 : 400;
    setTimeout(function () {
      stage.classList.remove('is-playing', 'is-leaving');
      onDone();
    }, fadeMs);
  }
  function onKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); }
  }
  stage.addEventListener('click', finish);
  stage.addEventListener('keydown', onKeydown);
}

function onyuMaybeShowBootSplash(onDone) {
  onDone = typeof onDone === 'function' ? onDone : function () {};
  var now = Date.now();
  var lastShownAt = 0;
  try { lastShownAt = Number(localStorage.getItem(ONYU_SIG_LAST_SHOWN_KEY)) || 0; } catch (e) { /* localStorage 접근 불가 시 표시 */ }
  if (lastShownAt > 0 && now >= lastShownAt && now - lastShownAt < ONYU_SIG_INTERVAL_MS) {
    onDone();
    return;
  }
  onyuPlaySigOpening(function () {
    try { localStorage.setItem(ONYU_SIG_LAST_SHOWN_KEY, String(Date.now())); } catch (e) { /* 저장 실패해도 진행에는 지장 없음 */ }
    onDone();
  });
}
