/* 부트스트랩 — DOM 참조 연결 + 타이틀 화면 버튼 배선. */

// 초기 진입 때 모든 스탠딩·배경(약 77MB)을 한꺼번에 요청하면 타이틀 화면도
// 늦어지고 모바일에서는 불필요한 데이터 사용량이 커진다. 타이틀 표지가 준비된
// 직후 첫 챕터(CH01)에 필요한 파일만 먼저 캐시에 데워두고, 이후 챕터는 진입
// 시점에 필요한 파일만 같은 방식으로 지연 로드한다.
var onyuPreloadedSprites = [];
var onyuPreloadedSpriteNames = {};
var onyuPreloadAssetPromises = {};

// Image 객체를 만든 뒤 로드가 끝날 때까지 기다릴 수 있는 공용 프리로드 헬퍼.
// 같은 파일을 여러 경로(타이틀 부팅·챕터 진입·새 게임 버튼)에서 요청해도
// 네트워크 요청과 대기 Promise를 하나만 공유한다. 존재하지 않는 선택 CG처럼
// 폴백 가능한 파일은 오류여도 settled 상태로 처리하고, 새 게임처럼 필수 에셋을
// 엄격히 확인하는 호출만 아래 결과의 ok 값을 검사한다.
function onyuPreloadAsset(src, collection) {
  if (!src) return Promise.resolve({ ok: false, src: src });
  if (onyuPreloadAssetPromises[src]) return onyuPreloadAssetPromises[src];
  var img = new Image();
  var promise = new Promise(function (resolve) {
    var settled = false;
    function settle(ok) {
      if (settled) return;
      settled = true;
      resolve({ ok: ok, src: src });
    }
    img.onload = function () { settle(true); };
    img.onerror = function () { settle(false); };
  });
  onyuPreloadAssetPromises[src] = promise;
  collection.push(img); // 로드 중 GC로 취소되지 않도록 참조를 유지
  img.src = src;
  return promise;
}

function onyuPreloadSpriteFile(name) {
  if (!name) return Promise.resolve({ ok: false, src: name });
  var src = 'assets/standing/' + name + '.png';
  if (onyuPreloadedSpriteNames[name]) return onyuPreloadAssetPromises[src] || Promise.resolve({ ok: true, src: src });
  onyuPreloadedSpriteNames[name] = true;
  return onyuPreloadAsset(src, onyuPreloadedSprites);
}
function onyuPreloadSpriteSet(prefix) {
  if (!prefix) return Promise.resolve([]);
  var pending = [];
  for (var n = 1; n <= 6; n++) pending.push(onyuPreloadSpriteFile(prefix + n));
  return Promise.all(pending);
}

var onyuPreloadedBackgrounds = [];
var onyuPreloadedBackgroundNames = {};
function onyuPreloadBackgroundFile(name) {
  if (!name) return Promise.resolve({ ok: false, src: name });
  var src = 'assets/backgrounds/' + name + '.png';
  if (onyuPreloadedBackgroundNames[name]) return onyuPreloadAssetPromises[src] || Promise.resolve({ ok: true, src: src });
  onyuPreloadedBackgroundNames[name] = true;
  return onyuPreloadAsset(src, onyuPreloadedBackgrounds);
}
var onyuPreloadedCgs = [];
var onyuPreloadedCgNames = {};

function onyuPreloadCgFile(file) {
  if (!file) return Promise.resolve({ ok: false, src: file });
  var src = 'assets/cg/' + file;
  if (onyuPreloadedCgNames[file]) return onyuPreloadAssetPromises[src] || Promise.resolve({ ok: true, src: src });
  onyuPreloadedCgNames[file] = true;
  return onyuPreloadAsset(src, onyuPreloadedCgs);
}

// 일부 배경엔 계절 요소가 원화 자체에 그려져 있어(예: 교문 배경의 벚꽃) 다른
// 계절 챕터에 재사용하면 텍스트와 안 맞는 경우가 실사로 확인됐다(2026-09-14) —
// 가장 두드러진 곳들에 계절 전용 변형을 준비 중. 챕터 진입 시 해당 챕터에
// 필요한 변형 파일만 probe해서 onyuBgVariantAvailable에 캐시해두고,
// engine.js의 onyuApplyBackground()가 렌더 시점에 동기적으로 참조한다 — 파일이
// 아직 없으면(404) 조용히 기본 배경으로 폴백한다.
var ONYU_BG_SEASON_VARIANTS = {
  b2: ['winter'], b3: ['winter'], // CH08·CH27(교문) / CH26(하굣길) — 실제 적용됨
  b5: ['winter'], b6: ['autumn'], b8: ['winter'], b9: ['winter'], // CH07/CH05/CH17/CH16 — 프롬프트만 준비, 이미지 대기 중
};
var onyuBgVariantAvailable = {};
function onyuProbeBackgroundVariant(base, season) {
  var variantKey = base + '-' + season;
  if (variantKey in onyuBgVariantAvailable) return;
  onyuBgVariantAvailable[variantKey] = false;
  var probe = new Image();
  probe.onload = function () {
    onyuBgVariantAvailable[variantKey] = true;
    // 변형 로드가 챕터 진입 뒤 끝나는 경우에도 현재 화면을 즉시 교체한다.
    if (window.onyuCurrentBg === base && typeof onyuApplyBackground === 'function') {
      onyuApplyBackground();
    }
  };
  probe.onerror = function () { onyuBgVariantAvailable[variantKey] = false; };
  probe.src = 'assets/backgrounds/' + variantKey + '.png';
}

// 스탠딩 파일명 접두사(assets/standing/{prefix}1.png)가 실제로 존재하는지 필요한
// 챕터에서 probe해서 onyuSpriteVariantAvailable에 캐시해두는 공용 헬퍼 — 배경 계절변형과
// 같은 패턴. outfit-picker.js(사복 후원 픽커)와 아래 ONYU_SPRITE_CANDIDATES(후보
// 없이 이미지만 있으면 바로 쓰는 단일 세트, 예: CH27 졸업 가운)가 공유해서 쓴다.
var onyuSpriteVariantAvailable = {};
function onyuProbeSpritePrefix(prefix) {
  if (prefix in onyuSpriteVariantAvailable) return; // 이미 probe했으면 중복 요청 안 함
  onyuSpriteVariantAvailable[prefix] = false;
  var probe = new Image();
  probe.onload = function () {
    onyuSpriteVariantAvailable[prefix] = true;
    // 존재가 확인된 후보만 실제로 선택·사용할 때 전체 표정 세트를 데운다.
    onyuPreloadSpriteSet(prefix);
  };
  probe.src = 'assets/standing/' + prefix + '1.png';
}

// "후보 없이 이미지만 있으면 바로 쓰는" 단일 스탠딩 세트. 사복처럼 무료/후원 2종
// 중 골라야 하는 챕터는 outfit-picker.js의 ONYU_OUTFIT_CHOICES가 따로 담당한다.
var ONYU_SPRITE_CANDIDATES = {
  ch27: ['GR-'], // 졸업식 — 졸업 가운, 후보 없이 하나뿐
};

function onyuPreloadChapterAssets(chapterId, options) {
  options = options || {};
  var chapters = window.ONYU_CHAPTERS || [];
  var chapter = null;
  for (var i = 0; i < chapters.length; i++) {
    if (chapters[i].id === chapterId) { chapter = chapters[i]; break; }
  }
  if (!chapter) return Promise.resolve([]);
  var pending = [];

  var chosen = window.ONYU_STATE && window.ONYU_STATE.chosenOutfits
    ? window.ONYU_STATE.chosenOutfits[chapterId] : null;
  var candidate = ONYU_SPRITE_CANDIDATES[chapterId] && ONYU_SPRITE_CANDIDATES[chapterId][0];
  var prefix = chapter.spriteSet || chosen || candidate
    || ((chapter.season === 'autumn' || chapter.season === 'winter') ? 'w' : 's');
  if (candidate && !chosen && !chapter.spriteSet) onyuProbeSpritePrefix(prefix);
  else pending.push(onyuPreloadSpriteSet(prefix));

  if (chapter.bg) {
    pending.push(onyuPreloadBackgroundFile(chapter.bg));
    (ONYU_BG_SEASON_VARIANTS[chapter.bg] || []).forEach(function (season) {
      onyuProbeBackgroundVariant(chapter.bg, season);
    });
  }
  // 의상 선택 챕터는 기본 chapter.cg 파일이 없고 무료/꾸민 의상별 CG만
  // 존재한다. 두 변형을 모두 미리 받아 두면 실제 선택 결과와 무관하게
  // CG 팝업이 즉시 뜨고, 존재하지 않는 기본 파일(cg-13.png 등)을
  // 프리로드하는 404 요청도 발생하지 않는다.
  var outfitCgVariants = window.ONYU_OUTFIT_CG_VARIANTS && window.ONYU_OUTFIT_CG_VARIANTS[chapterId];
  if (outfitCgVariants) {
    pending.push(onyuPreloadCgFile(outfitCgVariants.free));
    pending.push(onyuPreloadCgFile(outfitCgVariants.paid));
  } else if (chapter.cg) {
    pending.push(onyuPreloadCgFile(chapter.cg));
  }
  return Promise.all(pending).then(function (results) {
    var flatResults = [];
    results.forEach(function (result) {
      if (Array.isArray(result)) flatResults = flatResults.concat(result);
      else flatResults.push(result);
    });
    if (options.required && flatResults.some(function (result) { return !result || !result.ok; })) {
      throw new Error('필수 챕터 에셋 로드 실패: ' + chapterId);
    }
    return flatResults;
  });
}

var onyuChapterEntryBusy = false;
function onyuPrepareChapterEntry(chapterId, options) {
  options = options || {};
  if (onyuChapterEntryBusy) {
    if (typeof options.onSettled === 'function') options.onSettled(false);
    return Promise.resolve(false);
  }
  onyuChapterEntryBusy = true;
  var loading = document.getElementById('game-entry-loading');
  var loadingTitle = document.getElementById('game-entry-loading-title');
  function closeLoading() { if (loading) loading.hidden = true; }
  function fail(error) {
    closeLoading();
    console.error('챕터 진입 준비 실패:', error);
    if (typeof options.onFailure === 'function') options.onFailure(error);
    else alert('게임 장면을 준비하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
    return false;
  }
  var access = options.skipAccess || !window.onyuEnsureGameAccess
    ? Promise.resolve(true)
    : window.onyuEnsureGameAccess();
  return Promise.resolve(access).then(function (allowed) {
    if (!allowed) return false;
    if (typeof options.beforeLoad === 'function') options.beforeLoad();
    if (loadingTitle) loadingTitle.textContent = options.message || '게임 장면을 준비하고 있어요';
    if (loading) loading.hidden = false;
    var assets = options.preloadedAssets || onyuPreloadChapterAssets(chapterId, { required: true });
    return Promise.resolve(assets).then(function () {
      onyuRequestFullscreen();
      window.onyuGameSessionActive = true;
      window.onyuGameCompleted = false;
      if (options.telemetry && typeof window.onyuTelemetryTrack === 'function') {
        window.onyuTelemetryTrack(options.telemetry.name || 'game_started', options.telemetry.data || {});
      }
      onyuStartChapter(chapterId);
      if (typeof options.afterStart === 'function') options.afterStart();
      closeLoading();
      return true;
    });
  }).catch(fail).then(function (started) {
    onyuChapterEntryBusy = false;
    if (!started && typeof options.onSettled === 'function') options.onSettled(false);
    return started;
  }, function (error) {
    onyuChapterEntryBusy = false;
    return fail(error);
  });
}
window.onyuPrepareChapterEntry = onyuPrepareChapterEntry;

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

  document.getElementById('ending-review-btn').addEventListener('click', function () {
    onyuEl.endingOverlay.classList.remove('is-active');
    onyuEl.endingOverlay.hidden = true;
    document.getElementById('review-text').value = '';
    document.getElementById('review-text').disabled = false;
    document.getElementById('review-save-btn').hidden = false;
    document.getElementById('review-save-btn').disabled = false;
    document.getElementById('review-save-btn').classList.remove('is-saved');
    document.getElementById('review-save-btn').textContent = '후기 저장';
    document.getElementById('review-status').textContent = '';
    window.onyuReviewRating = 0;
    document.querySelectorAll('.review-star').forEach(function (star) {
      star.textContent = '☆';
      star.classList.remove('active');
      star.setAttribute('aria-pressed', 'false');
    });
    document.getElementById('review-promote').checked = false;
    document.getElementById('review-promote-fields').hidden = true;
    document.getElementById('review-nickname').value = '';
    document.getElementById('review-soop-id').value = '';
    document.getElementById('review-promote').closest('.review-promote-toggle').hidden = false;
    document.getElementById('review-promote-help').hidden = false;
    onyuShowScreen('review');
  });

  document.querySelectorAll('.review-star').forEach(function (star) {
    star.addEventListener('click', function () {
      var rating = Number(star.dataset.rating);
      window.onyuReviewRating = rating;
      document.querySelectorAll('.review-star').forEach(function (item) {
        var active = Number(item.dataset.rating) <= rating;
        item.textContent = active ? '★' : '☆';
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(Number(item.dataset.rating) === rating));
      });
    });
  });
  document.getElementById('review-promote').addEventListener('change', function () {
    document.getElementById('review-promote-fields').hidden = !this.checked;
  });

  document.addEventListener('onyu-auth-changed', function (event) {
    var verifiedStreamer = event.detail && event.detail.role === 'streamer';
    var toggle = document.querySelector('.review-promote-toggle');
    var help = document.getElementById('review-promote-help');
    if (toggle) toggle.hidden = verifiedStreamer;
    if (help) {
      help.hidden = verifiedStreamer;
      if (verifiedStreamer) help.textContent = '인증된 스트리머의 방송국 정보가 후기에 자동으로 표시됩니다.';
    }
  });

  document.getElementById('review-save-btn').addEventListener('click', async function () {
    var saveBtn = document.getElementById('review-save-btn');
    var reviewText = document.getElementById('review-text');
    var status = document.getElementById('review-status');
    var text = reviewText.value.trim();
    var rating = Number(window.onyuReviewRating || 0);
    var promote = document.getElementById('review-promote').checked;
    var nickname = document.getElementById('review-nickname').value.trim();
    var soopId = document.getElementById('review-soop-id').value.trim().toLowerCase();
    if (saveBtn.disabled) return;
    if (!text) {
      status.textContent = '후기 내용을 입력해 주세요.';
      reviewText.focus();
      return;
    }
    if (text.length > 1000) {
      status.textContent = '후기는 1,000자 이내로 작성해 주세요.';
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      status.textContent = '별점을 선택해 주세요.';
      document.getElementById('review-rating').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (promote && (!nickname || !/^[a-z0-9]{2,20}$/.test(soopId))) {
      status.textContent = !nickname ? '스트리머 닉네임을 입력해 주세요.' : 'SOOP 아이디는 영문 소문자·숫자 2~20자로 입력해 주세요.';
      return;
    }
    if (window.ONYU_STATE.lastEndingId !== 'lover') {
      status.textContent = '연인 엔딩을 완료한 뒤 후기를 저장할 수 있어요.';
      return;
    }
    if (typeof window.onyuSubmitPlayerReview !== 'function') {
      status.textContent = '후기 저장을 준비 중이에요. 잠시 후 다시 시도해 주세요.';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';
    reviewText.disabled = true;
    status.textContent = '';
    try {
      var saved = await window.onyuSubmitPlayerReview({ endingId: 'lover', review: text, rating: rating, promoteBroadcast: promote, nickname: promote ? nickname : '', soopId: promote ? soopId : '' });
      saveBtn.classList.add('is-saved');
      status.textContent = '후기가 저장됐어요.';
      if (saved && saved.promoteRequested && typeof window.onyuRequestStreamerVerification === 'function') {
        try {
          await window.onyuRequestStreamerVerification({ nickname: saved.nickname || nickname, soopId: saved.soopId || soopId });
          status.textContent = '후기가 저장됐고 스트리머 인증 신청도 접수됐어요.';
        } catch (verificationError) {
          console.error('후기 연동 스트리머 인증 신청 실패:', verificationError);
          status.textContent = '후기는 저장됐지만 인증 신청은 접수되지 않았어요. 설정에서 다시 신청해 주세요.';
        }
      }
      setTimeout(function () { saveBtn.hidden = true; }, 380);
    } catch (error) {
      saveBtn.disabled = false;
      saveBtn.textContent = '후기 저장';
      reviewText.disabled = false;
      status.textContent = error && error.message
        ? '후기를 저장하지 못했어요: ' + error.message
        : '후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
      console.error('온이유 플레이 후기 저장 실패:', error);
    }
  });

  document.getElementById('review-title-btn').addEventListener('click', function () {
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('return_to_title');
    onyuSwapScreen('title');
    onyuMaybeShowBootSplash(function () { onyuSwapScreen('title'); });
  });

  // 대사창뿐 아니라 플레이 화면 빈 곳 아무 데나 클릭해도 진행되게(모바일 시청 편의).
  // 선택지·이름입력 중에는 onyuHandleDialogueClick 자체가 no-op이라 별도 예외 처리가 필요 없다.
  var playScreen = document.getElementById('screen-play');
  playScreen.addEventListener('click', onyuHandleDialogueClick);
  // Pointer Events는 마우스와 터치를 같은 경로로 전달하므로 관리자 전용 홀드
  // 진행을 두 입력 방식에서 동일하게 처리한다. pointerup은 화면 밖에서 손을
  // 떼는 경우도 놓치지 않도록 document 캡처 단계에서 받는다.
  playScreen.addEventListener('pointerdown', onyuHandleAdminHoldPointerDown, { passive: true });
  document.addEventListener('pointerup', onyuStopAdminHoldAdvance, true);
  document.addEventListener('pointercancel', onyuStopAdminHoldAdvance, true);
  window.addEventListener('blur', onyuStopAdminHoldAdvance);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) onyuStopAdminHoldAdvance();
  });
  document.addEventListener('onyu-auth-changed', function () {
    if (!onyuIsAdminHoldEnabled()) onyuStopAdminHoldAdvance();
  });
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
      // 표지 요청이 끝나는 즉시 첫 챕터의 배경·스탠딩·CG를 캐시에 데운다.
      // 사용자가 새 게임을 누를 때는 네트워크를 다시 기다리지 않는다.
      onyuPreloadChapterAssets('ch01');
    };
    probe.onerror = function () {
      loading.classList.add('is-hidden');
      stopPhraseRotation();
      // 표지 CG가 없는 배포본에서도 타이틀 폴백이 표시되는 즉시 CH01을 준비한다.
      onyuPreloadChapterAssets('ch01');
    };
    probe.src = 'assets/cg/cover.png';
  })();

  var continueBtn = document.getElementById('title-continue');
  var autosave = onyuLoadAutosave();
  if (!autosave) {
    continueBtn.disabled = true;
    continueBtn.classList.add('is-disabled');
  }

  var newGameBtn = document.getElementById('title-new-game');
  var newGamePreparing = false;
  var newGameAccessChecking = false;
  function setNewGamePreparing(preparing) {
    newGamePreparing = !!preparing;
    newGameBtn.disabled = newGamePreparing;
    newGameBtn.classList.toggle('is-disabled', newGamePreparing);
    newGameBtn.setAttribute('aria-busy', newGamePreparing ? 'true' : 'false');
    newGameBtn.textContent = newGamePreparing ? '게임을 시작하는 중' : '새 게임';
  }
  function startNewGameAfterAccess(preloadedAssets) {
    if (newGamePreparing && !preloadedAssets) return;
    setNewGamePreparing(true);
    var firstChapterId = window.ONYU_CHAPTERS[0].id;
    // 타이틀 화면의 프리로드를 재사용하되, 진입 전용 로딩 화면을 덮어
    // 에셋 준비가 끝날 때까지 현재 화면에서 기다리고 있음을 분명히 알린다.
    onyuPrepareChapterEntry(firstChapterId, {
      skipAccess: true,
      beforeLoad: onyuResetNewGame,
      preloadedAssets: preloadedAssets || onyuPreloadChapterAssets(firstChapterId, { required: true }),
      message: '첫 장면을 준비하고 있어요',
      telemetry: { name: 'game_started', data: { resumed: false } },
      onSettled: function (started) { if (!started) setNewGamePreparing(false); },
    }).then(function (started) {
      setNewGamePreparing(false);
      if (!started) return;
    });
  }
  newGameBtn.addEventListener('click', function () {
    if (newGamePreparing || newGameAccessChecking) return;
    newGameAccessChecking = true;
    setNewGamePreparing(true);
    // 권한 확인과 동시에 첫 챕터 에셋을 준비한다. 권한 모달을 거치는 동안에도
    // 이미지 다운로드가 진행되며, 허용되는 순간에는 이미 준비된 Promise를
    // 그대로 이어받는다.
    var ready = typeof onyuPreloadChapterAssets === 'function'
      ? onyuPreloadChapterAssets(window.ONYU_CHAPTERS[0].id, { required: true })
      : Promise.resolve([]);
    // 권한이 거절되어도 백그라운드 프리로드 실패가 unhandled rejection이 되지
    // 않도록 즉시 소비한다. 허용된 경우에는 아래에서 같은 Promise를 다시 기다린다.
    ready.catch(function () {});
    var access = window.onyuEnsureGameAccess ? window.onyuEnsureGameAccess() : Promise.resolve(true);
    Promise.resolve(access).then(function (allowed) {
      newGameAccessChecking = false;
      if (allowed) startNewGameAfterAccess(ready);
      else setNewGamePreparing(false);
    }).catch(function (error) {
      newGameAccessChecking = false;
      setNewGamePreparing(false);
      console.error('게임 접근 권한 확인 실패:', error);
    });
  });

  var continueLoading = false;
  function setContinueLoading(loading) {
    continueLoading = loading;
    continueBtn.disabled = loading;
    continueBtn.classList.toggle('is-disabled', loading);
    if (loading) continueBtn.setAttribute('aria-busy', 'true');
    else continueBtn.removeAttribute('aria-busy');
    continueBtn.textContent = loading ? '이어하는 중…' : '이어하기';
  }

  continueBtn.addEventListener('click', function () {
    if (continueLoading) return;
    var snap = onyuLoadAutosave();
    if (!snap || (typeof onyuIsValidSnapshot === 'function' && !onyuIsValidSnapshot(snap))) {
      if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'auto', reason: snap ? 'invalid' : 'missing' });
      return;
    }
    setContinueLoading(true);
    Promise.resolve().then(function () { return onyuPrepareChapterEntry(snap.currentChapterId, {
      beforeLoad: function () { onyuApplySnapshot(snap); },
      message: '이어하기 데이터를 불러오고 있어요',
      telemetry: { name: 'game_started', data: { resumed: true, chapterId: snap.currentChapterId || '' } },
      onFailure: function (error) {
        if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'auto', reason: 'exception' });
        console.error('이어하기 준비 실패:', error);
        alert('저장된 진행을 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
      },
      onSettled: function (started) {
        if (started) return;
        setContinueLoading(false);
      },
    }); }).then(function () {
      // 성공 시에도 화면을 나중에 다시 타이틀로 돌아오는 경우를 대비해
      // 버튼 상태를 복구한다. 현재 플레이 화면에선 보이지 않으므로 영향 없다.
      setContinueLoading(false);
    }).catch(function (error) {
      console.error('이어하기 진입 처리 실패:', error);
      setContinueLoading(false);
    });
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
