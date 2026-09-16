/*
 * BGM 재생 엔진.
 *
 * 전체 파일을 fetch/decodeAudioData로 기다리지 않고 HTMLAudioElement의 점진
 * 로딩을 사용한다. 재생 가능한 앞부분이 준비되면 곧바로 재생되고, 챕터·엔딩
 * 전환에서는 두 플레이어를 겹쳐 1.2초 크로스페이드한다.
 */

var ONYU_BGM_TRACKS = {
  title: 'assets/bgm/T title-theme.mp3',
  // everyday-1/2는 같은 무드의 대체 버전이다. 한 세션에서 하나를 골라 챕터 간
  // 재생 위치를 이어가므로 같은 무드 전환 때 트랙이 갑자기 바뀌지 않는다.
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

var ONYU_BGM_BY_CHAPTER = {
  ch01: 'everyday', ch03: 'everyday', ch04: 'everyday', ch06: 'everyday',
  ch09: 'everyday', ch10: 'everyday', ch11: 'everyday', ch14: 'everyday',
  ch17: 'everyday', ch20: 'everyday',
  ch02: 'flutter', ch08: 'flutter', ch12: 'flutter', ch13: 'flutter',
  ch16: 'flutter', ch24: 'flutter',
  ch07: 'focus', ch18: 'focus', ch19: 'focus', ch25: 'focus',
  ch21: 'friction', ch22: 'friction',
  ch05: 'festival', ch15: 'festival',
  ch23: 'reconcile', ch26: 'reconcile', ch27: 'reconcile',
};

(function () {
  var players = [];
  var preloaders = {};
  var activeIndex = -1;
  var activeKey = null;
  var selectedEveryday = null;
  var unlocked = false;
  var muted = false;
  var fadeTimer = null;
  var initialized = false;
  var CROSSFADE_MS = 1200;

  function volume() {
    var settings = window.ONYU_STATE && window.ONYU_STATE.settings;
    return settings ? Math.max(0, Math.min(1, Number(settings.bgmVolume) || 0)) : 0.5;
  }

  function sourceFor(key) {
    var source = ONYU_BGM_TRACKS[key];
    if (Array.isArray(source)) {
      if (!selectedEveryday) selectedEveryday = source[Math.floor(Math.random() * source.length)];
      return selectedEveryday;
    }
    return source || null;
  }

  function makePlayer() {
    var audio = new Audio();
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = 0;
    audio.addEventListener('error', function () {
      // BGM 실패는 대사·선택지 진행을 막지 않는다.
      audio.dataset.failed = '1';
    });
    return audio;
  }

  function ensurePlayer(audio, key) {
    var src = sourceFor(key);
    if (!src) return false;
    if (audio.dataset.source === src) return true;
    audio.pause();
    audio.currentTime = 0;
    audio.dataset.source = src;
    audio.dataset.key = key;
    audio.dataset.failed = '';
    audio.src = src;
    audio.load();
    return true;
  }

  function preload(key) {
    var src = sourceFor(key);
    if (!src || preloaders[key]) return;
    var audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    audio.load();
    preloaders[key] = audio;
  }

  function playNow(audio) {
    var result;
    try { result = audio.play(); } catch (e) { return; }
    if (result && typeof result.catch === 'function') result.catch(function () {});
  }

  function stopFade() {
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  }

  function switchTrack(key, immediate) {
    if (!initialized || !unlocked || muted || !key || !ONYU_BGM_TRACKS[key]) return;
    if (activeKey === key && activeIndex >= 0) {
      players[activeIndex].volume = volume();
      return;
    }

    var nextIndex = (activeIndex + 1) % players.length;
    var next = players[nextIndex];
    if (!ensurePlayer(next, key)) return;
    stopFade();
    next.volume = activeIndex < 0 || immediate ? volume() : 0;
    // 사용자 제스처로 unlock된 이후에는 버퍼가 덜 받아졌어도 play()를 먼저
    // 호출할 수 있다. 브라우저가 버퍼를 받는 동안 재생 위치를 준비한다.
    playNow(next);

    var oldIndex = activeIndex;
    activeIndex = nextIndex;
    activeKey = key;
    if (oldIndex < 0 || immediate) {
      players.forEach(function (player, i) { if (i !== nextIndex) player.pause(); });
    } else {
      var old = players[oldIndex];
      var startedAt = Date.now();
      fadeTimer = setInterval(function () {
        var progress = Math.min(1, (Date.now() - startedAt) / CROSSFADE_MS);
        next.volume = volume() * progress;
        old.volume = volume() * (1 - progress);
        if (progress >= 1) {
          stopFade();
          old.pause();
          old.volume = 0;
        }
      }, 40);
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    players = [makePlayer(), makePlayer()];
    // 타이틀 BGM은 페이지를 보는 동안 앞부분부터 점진적으로 준비한다.
    preload('title');

    var unlockOverlay = document.getElementById('sound-unlock-overlay');
    var unlockButton = document.getElementById('sound-unlock-btn');
    var muteButton = document.getElementById('sound-mute-btn');
    unlockButton.addEventListener('click', function () { onyuAudioUnlock(); });
    muteButton.addEventListener('click', function () { onyuAudioMute(); });
    unlockOverlay.addEventListener('click', function (event) {
      if (event.target === unlockOverlay) onyuAudioUnlock();
    });
  }

  window.onyuAudioShowUnlockPrompt = function () {
    init();
    if (unlocked || muted) return;
    var overlay = document.getElementById('sound-unlock-overlay');
    overlay.hidden = false;
  };

  window.onyuAudioUnlock = function () {
    init();
    unlocked = true;
    muted = false;
    document.getElementById('sound-unlock-overlay').hidden = true;
    // 이 함수는 안내 버튼의 사용자 제스처 안에서 호출되므로 자동재생 제한을
    // 안정적으로 통과한다. 파일 전체 로드를 기다리지 않고 즉시 재생을 시작한다.
    switchTrack('title', true);
  };

  window.onyuAudioMute = function () {
    init();
    muted = true;
    unlocked = false;
    document.getElementById('sound-unlock-overlay').hidden = true;
    stopFade();
    players.forEach(function (player) { player.pause(); player.volume = 0; });
  };

  window.onyuAudioPlayTitle = function () { switchTrack('title', false); };

  window.onyuAudioPlayForChapter = function (chapterId) {
    var key = ONYU_BGM_BY_CHAPTER[chapterId] || 'everyday';
    switchTrack(key, false);
    var idx = window.ONYU_CHAPTERS ? onyuChapterIndexById(chapterId) : -1;
    var next = idx >= 0 ? window.ONYU_CHAPTERS[idx + 1] : null;
    if (next) preload(ONYU_BGM_BY_CHAPTER[next.id] || 'everyday');
  };

  window.onyuAudioPlayEnding = function (endingId) {
    switchTrack('ending-' + endingId, false);
  };

  window.onyuAudioRefreshVolume = function () {
    if (activeIndex >= 0 && !fadeTimer) players[activeIndex].volume = volume();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
