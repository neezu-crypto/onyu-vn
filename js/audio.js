/*
 * BGM 재생 엔진.
 *
 * 전체 파일을 fetch/decodeAudioData로 기다리지 않고 HTMLAudioElement의 점진
 * 로딩을 사용한다. 재생 가능한 앞부분이 준비되면 곧바로 재생되고, 챕터·엔딩
 * 전환에서는 두 플레이어를 겹쳐 1.2초 크로스페이드한다.
 */

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

(function () {
  var players = [];
  var preloaders = {};
  var sfxTemplates = {};
  var activeIndex = -1;
  var activeKey = null;
  var pendingVariants = {};
  var unlocked = false;
  var muted = false;
  var fadeTimer = null;
  var initialized = false;
  var CROSSFADE_MS = 1200;

  function volume() {
    var settings = window.ONYU_STATE && window.ONYU_STATE.settings;
    return settings ? Math.max(0, Math.min(1, Number(settings.bgmVolume) || 0)) : 0.5;
  }

  function sourceFor(key, variantIndex) {
    var source = ONYU_BGM_TRACKS[key];
    if (Array.isArray(source)) {
      var index = (variantIndex === undefined) ? Math.floor(Math.random() * source.length) : variantIndex;
      return source[index % source.length];
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

  function ensurePlayer(audio, key, sourceOverride) {
    var src = sourceOverride || sourceFor(key);
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

  function preload(key, variantIndex) {
    var src = sourceFor(key, variantIndex);
    if (!src) return;
    var cacheKey = key + '|' + src;
    if (preloaders[cacheKey]) return;
    var audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    audio.load();
    preloaders[cacheKey] = audio;
  }

  function preloadSfx(key) {
    var src = ONYU_SFX_TRACKS[key];
    if (!src || sfxTemplates[key]) return;
    var audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    audio.load();
    sfxTemplates[key] = audio;
  }

  function playSfx(key) {
    if (!initialized || !unlocked || muted) return;
    var template = sfxTemplates[key];
    if (!template) return;
    var effect = template.cloneNode(true);
    effect.volume = Math.max(0, Math.min(1, Number(window.ONYU_STATE.settings.sfxVolume) || 0));
    var result;
    try { result = effect.play(); } catch (e) { return; }
    if (result && typeof result.catch === 'function') result.catch(function () {});
    effect.addEventListener('ended', function () { effect.src = ''; });
  }

  function playNow(audio) {
    var result;
    try { result = audio.play(); } catch (e) { return; }
    if (result && typeof result.catch === 'function') result.catch(function () {});
  }

  function stopFade() {
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  }

  function switchTrack(key, immediate, sourceOverride) {
    if (!initialized || !unlocked || muted || !key || !ONYU_BGM_TRACKS[key]) return;
    var nextSource = sourceOverride || sourceFor(key);
    if (activeKey === key && players[activeIndex] && players[activeIndex].dataset.source === nextSource) {
      players[activeIndex].volume = volume();
      return;
    }

    var nextIndex = (activeIndex + 1) % players.length;
    var next = players[nextIndex];
    if (!ensurePlayer(next, key, nextSource)) return;
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
    Object.keys(ONYU_SFX_TRACKS).forEach(preloadSfx);

    var unlockOverlay = document.getElementById('sound-unlock-overlay');
    unlockOverlay.addEventListener('click', function () { onyuAudioUnlock(); });
    unlockOverlay.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onyuAudioUnlock();
      }
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
    // 일상 무드는 챕터 진입마다 두 버전 중 하나를 새로 추첨한다.
    var variantIndex;
    if (key === 'everyday') {
      variantIndex = pendingVariants[chapterId];
      if (variantIndex === undefined) variantIndex = Math.floor(Math.random() * 2);
    }
    // 직전 챕터에서 다음 챕터용으로 준비한 추첨 결과만 소비하고, 타임머신
    // 점프 등으로 남아 있던 다른 예약 결과는 버려 새 진입으로 취급한다.
    pendingVariants = {};
    switchTrack(key, false, sourceFor(key, variantIndex));
    var idx = window.ONYU_CHAPTERS ? onyuChapterIndexById(chapterId) : -1;
    var next = idx >= 0 ? window.ONYU_CHAPTERS[idx + 1] : null;
    if (next) {
      var nextKey = ONYU_BGM_BY_CHAPTER[next.id] || 'everyday';
      var nextVariant = nextKey === 'everyday' ? Math.floor(Math.random() * 2) : undefined;
      if (nextKey === 'everyday') pendingVariants[next.id] = nextVariant;
      preload(nextKey, nextVariant);
    }
  };

  window.onyuAudioPlayEnding = function (endingId) {
    switchTrack('ending-' + endingId, false);
  };

  window.onyuAudioPlaySfx = playSfx;

  window.onyuAudioRefreshVolume = function () {
    if (activeIndex >= 0 && !fadeTimer) players[activeIndex].volume = volume();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
