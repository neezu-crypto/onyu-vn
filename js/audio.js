/*
 * BGM 재생 엔진.
 *
 * 전체 파일을 fetch/decodeAudioData로 기다리지 않고 HTMLAudioElement의 점진
 * 로딩을 사용한다. 재생 가능한 앞부분이 준비되면 곧바로 재생되고, 챕터·엔딩
 * 전환에서는 두 플레이어를 겹쳐 1.2초 크로스페이드한다.
 */

(function () {
  var players = [];
  var preloaders = {};
  var sfxTemplates = {};
  var activeIndex = -1;
  var activeKey = null;
  var activeTrackId = null;
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
    try { result = effect.play(); } catch (e) {
      if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('sfx_play_failed', { trackId: key });
      return;
    }
    if (result && typeof result.then === 'function') {
      result.then(function () {
        if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('sfx_played', { trackId: key });
      }).catch(function () {
        if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('sfx_play_failed', { trackId: key });
      });
    }
    effect.addEventListener('ended', function () { effect.src = ''; });
  }

  function galleryTrackIdFor(key, source) {
    var tracks = window.ONYU_BGM_GALLERY_TRACKS || [];
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      if (track.key !== key) continue;
      if (source && sourceFor(track.key, track.variantIndex) !== source) continue;
      return track.id;
    }
    return key || '';
  }

  function markBgmPlayed(trackId) {
    if (!trackId) return;
    if (typeof window.onyuUnlockGalleryItem === 'function') {
      window.onyuUnlockGalleryItem('bgm', trackId);
    }
  }

  function playNow(audio, key, trackId) {
    var result;
    function reportFailure(error) {
      var blocked = error && (error.name === 'NotAllowedError' || error.code === 9);
      if (typeof window.onyuTelemetryTrack === 'function') {
        window.onyuTelemetryTrack(blocked ? 'bgm_autoplay_blocked' : 'bgm_play_failed', { trackId: key || '' });
      }
    }
    try { result = audio.play(); } catch (e) {
      reportFailure(e);
      return;
    }
    if (result && typeof result.then === 'function') {
      result.then(function () {
        markBgmPlayed(trackId || galleryTrackIdFor(key, audio.dataset.source));
        if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('bgm_play_started', { trackId: key || audio.dataset.key || '' });
      }).catch(function (error) {
        reportFailure(error);
      });
    }
  }

  function stopFade() {
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  }

  function switchTrack(key, immediate, sourceOverride, restart) {
    if (!initialized || !unlocked || muted || !key || !ONYU_BGM_TRACKS[key]) return;
    var nextSource = sourceOverride || sourceFor(key);
    if (activeKey === key && players[activeIndex] && players[activeIndex].dataset.source === nextSource) {
      if (restart) {
        players[activeIndex].currentTime = 0;
        playNow(players[activeIndex], key, galleryTrackIdFor(key, nextSource));
      }
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
    activeTrackId = galleryTrackIdFor(key, nextSource);
    playNow(next, key, activeTrackId);

    var oldIndex = activeIndex;
    activeIndex = nextIndex;
    activeKey = key;
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('bgm_changed', { trackId: key });
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
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('sound_unlock_clicked');
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
    activeTrackId = null;
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

  window.onyuAudioPlayGalleryTrack = function (trackId) {
    init();
    var tracks = window.ONYU_BGM_GALLERY_TRACKS || [];
    var track = tracks.find(function (item) { return item.id === trackId; });
    if (!track || muted) return false;
    // 갤러리 카드 클릭 자체가 사용자 제스처이므로, 아직 사운드 안내를
    // 거치지 않은 경우에도 선택한 곡을 바로 재생할 수 있다.
    unlocked = true;
    var overlay = document.getElementById('sound-unlock-overlay');
    if (overlay) overlay.hidden = true;
    switchTrack(track.key, false, sourceFor(track.key, track.variantIndex), true);
    return true;
  };

  window.onyuAudioGetActiveTrackId = function () { return activeTrackId; };

  window.onyuAudioPlaySfx = playSfx;

  window.onyuAudioRefreshVolume = function () {
    if (activeIndex >= 0 && !fadeTimer) players[activeIndex].volume = volume();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
