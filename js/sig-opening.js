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
  var series = stage.querySelector('.sig-series');
  var seriesTag = stage.querySelector('.sig-series-tag');
  var reelTrack = stage.querySelector('.sig-reel-track');
  var underline = stage.querySelector('.sig-series-under');
  var titleFrame = stage.querySelector('.sig-title-frame');
  var rafId = null;
  var now = function () {
    return (window.performance && typeof window.performance.now === 'function')
      ? window.performance.now() : Date.now();
  };
  var requestFrame = window.requestAnimationFrame || function (callback) {
    return window.setTimeout(function () { callback(now()); }, 16);
  };
  var cancelFrame = window.cancelAnimationFrame || window.clearTimeout;
  var startedAt = now();

  // CSS animation은 브라우저가 프레임을 건너뛰는 상황에서 릴의 단계 전환이
  // 주사율별로 다르게 보일 수 있다. 모든 값을 단조 시계(performance.now)로
  // 계산해 현재 프레임과 무관한 시간축으로 직접 그린다.
  function clamp01(value) { return Math.max(0, Math.min(1, value)); }
  function smoothStep(value) {
    value = clamp01(value);
    return value * value * (3 - 2 * value);
  }
  function easeOutCubic(value) {
    value = clamp01(value);
    return 1 - Math.pow(1 - value, 3);
  }
  function progress(elapsed, start, duration) {
    if (elapsed < start) return 0;
    if (reduceMotion) return 1;
    return clamp01((elapsed - start) / duration);
  }
  function applyTimeline(timestamp) {
    var elapsed = Math.max(0, timestamp - startedAt);
    var seriesIn = progress(elapsed, 0, 700);
    var seriesOut = progress(elapsed, 2300, 500);
    var seriesOpacity = elapsed < 2300 ? seriesIn : 1 - seriesOut;
    series.style.opacity = String(seriesOpacity);
    series.style.transform = 'translateY(' + (14 * (1 - easeOutCubic(seriesIn))) + 'px)';

    var tagProgress = progress(elapsed, 0, 450);
    seriesTag.style.opacity = String(tagProgress);
    seriesTag.style.transform = 'translateY(' + (14 * (1 - easeOutCubic(tagProgress))) + 'px)';

    var reelProgress = progress(elapsed, 500, 1000);
    var reelStep = Math.min(5, Math.floor(reelProgress * 5 + 0.000001));
    reelTrack.style.transform = 'translateY(' + (-44 * reelStep) + 'px)';

    var underlineProgress = progress(elapsed, 1500, 500);
    underline.style.width = (100 * smoothStep(underlineProgress)) + '%';

    var titleProgress = progress(elapsed, 2600, 600);
    titleFrame.style.opacity = String(titleProgress);
    titleFrame.style.transform = 'translateY(' + (14 * (1 - easeOutCubic(titleProgress))) + 'px)';

    if (!finished) rafId = requestFrame(applyTimeline);
  }
  function resetInlineStyles() {
    [series, seriesTag, reelTrack, underline, titleFrame].forEach(function (element) {
      element.removeAttribute('style');
    });
  }
  stage.classList.toggle('is-reduced-motion', reduceMotion);
  stage.classList.remove('is-leaving');
  stage.classList.add('is-js-timeline', 'is-playing');
  if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('signature_shown');

  var finished = false;
  rafId = requestFrame(applyTimeline);
  var timer = setTimeout(function () { finish('auto'); }, ONYU_SIG_DURATION_MS);
  function finish(reason) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (rafId !== null) cancelFrame(rafId);
    stage.removeEventListener('click', finish);
    stage.removeEventListener('keydown', onKeydown);
    // display:none으로 바로 끊지 않고 opacity 페이드아웃(.is-leaving)을 먼저
    // 걸어 게임 화면(또는 타이틀)으로 부드럽게 넘어가게 한다. is-playing은
    // 이 동안 그대로 둬서(display:flex 유지) 트랜지션이 실제로 재생될 시간을 번다.
    stage.classList.add('is-leaving');
    if (typeof window.onyuTelemetryTrack === 'function') {
      window.onyuTelemetryTrack('signature_completed', { reason: reason || 'auto' });
      if (reason === 'skip') window.onyuTelemetryTrack('signature_skipped', { method: 'tap' });
    }
    var fadeMs = reduceMotion ? 0 : 400;
    setTimeout(function () {
      stage.classList.remove('is-js-timeline', 'is-playing', 'is-leaving');
      resetInlineStyles();
      onDone();
    }, fadeMs);
  }
  function onKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish('skip'); }
  }
  stage.addEventListener('click', function () { finish('skip'); });
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
