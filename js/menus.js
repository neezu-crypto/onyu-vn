/*
 * 챕터선택(타임머신) · 갤러리 · 저장·불러오기 · 설정 4개 화면의 렌더링/조작 로직.
 * 전부 title 화면에서만 진입한다(플레이 중엔 저장·설정만 상단바 아이콘으로 진입).
 */

var ONYU_SEASON_COLORS = {
  spring: { accent: '#b8607e', soft: '#fbe7ee' },
  summer: { accent: '#3f8177', soft: '#e1f0ec' },
  autumn: { accent: '#a8632b', soft: '#f5e6d3' },
  winter: { accent: '#5d7f95', soft: '#e8eef2' },
};

var ONYU_ENDING_DEFS = [
  { id: 'friend', name: '곁에 남은 사람' },
  { id: 'crush', name: '여백' },
  { id: 'lover', name: '온 이유' },
];
var onyuPublicReviewsCache = [];
var onyuPublicReviewsCursor = null;
var onyuPublicReviewsHasMore = false;
var onyuPublicReviewsLoaded = false;

function onyuFormatDate(ts) {
  try { return new Date(ts).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
}

function onyuSaveThumbnailStyle(snap, chapter) {
  var bg = snap && snap.thumbnail && snap.thumbnail.background;
  // localStorage 값은 사용자가 직접 바꿀 수 있으므로 파일명으로 쓸 수 있는
  // 문자만 허용하고, 이전 버전 세이브는 챕터 기본 배경으로 복구한다.
  if (typeof bg !== 'string' || !/^[a-z0-9-]+$/i.test(bg)) bg = chapter && chapter.bg;
  if (typeof bg !== 'string' || !/^[a-z0-9-]+$/i.test(bg)) return '';
  return ' style="background-image: linear-gradient(150deg, rgba(255,255,255,.14), rgba(61,52,54,.24)), url(assets/backgrounds/' + bg + '.png)"';
}

/* ---------------- 챕터 선택 · 타임머신 ---------------- */

function onyuRenderChapterList() {
  // 진행상황(어디까지 도달했는지)은 자동저장 기록 기준 — "이어하기"와 같은 데이터.
  // 저장 기록이 있으면 그걸 현재 상태에 반영해서 목록에 그대로 보여준다.
  var snap = onyuLoadAutosave();
  if (typeof onyuIsValidSnapshot === 'function' && !onyuIsValidSnapshot(snap)) snap = null;
  if (snap) onyuApplySnapshot(snap);

  var reached = window.ONYU_STATE.chapterCheckpoints || {};
  var currentId = window.ONYU_STATE.currentChapterId;
  var container = document.getElementById('chapters-list');
  container.innerHTML = '';

  [1, 2, 3].forEach(function (grade) {
    var chapters = window.ONYU_CHAPTERS.filter(function (c) { return c.grade === grade; });
    if (!chapters.length) return;

    var row = document.createElement('div');
    row.className = 'year-row';
    var label = document.createElement('p');
    label.className = 'year-row-label';
    label.textContent = grade + '학년';
    row.appendChild(label);

    var grid = document.createElement('div');
    grid.className = 'chip-grid';
    chapters.forEach(function (ch) {
      var unlocked = !!reached[ch.id] || ch.order === 1;
      var isCurrent = ch.id === currentId;
      var btn = document.createElement('button');
      btn.className = 'ch-card' + (isCurrent ? ' is-current' : '') + (unlocked ? '' : ' is-locked');
      var colors = ONYU_SEASON_COLORS[ch.season];
      btn.style.setProperty('--season-accent', colors.accent);
      btn.style.setProperty('--season-soft', colors.soft);
      var numLabel = String(ch.order).padStart(2, '0');
      btn.innerHTML = '<span class="ch-no num">' + numLabel + '</span><span class="ch-name">' + ch.title + '</span>'
        + (unlocked ? '' : '<span class="ch-lock">🔒</span>');
      if (unlocked) {
        btn.addEventListener('click', function () { onyuJumpToChapter(ch.id); });
      } else {
        btn.disabled = true;
      }
      grid.appendChild(btn);
    });
    row.appendChild(grid);
    container.appendChild(row);
  });
}

function onyuJumpToChapter(chapterId) {
  // 타임머신 — 그 챕터 "시작 시점" 호감도로 되돌려서 실제로 다시 플레이한다.
  function startAfterAccess() {
    var checkpoint = window.ONYU_STATE.chapterCheckpoints[chapterId];
    window.ONYU_STATE.affection = (checkpoint !== undefined) ? checkpoint : 0;
    onyuRequestFullscreen();
    onyuStartChapter(chapterId);
  }
  if (window.onyuEnsureGameAccess) window.onyuEnsureGameAccess().then(function (allowed) { if (allowed) startAfterAccess(); });
  else startAfterAccess();
}

/* ---------------- 갤러리 ---------------- */

function onyuRenderGallery() {
  var record = onyuLoadGalleryRecord();

  var cgPanel = document.getElementById('gallery-panel-cg');
  cgPanel.innerHTML = '';
  window.ONYU_CHAPTERS.filter(function (c) { return c.id !== 'ch27'; }).forEach(function (ch) {
    var entries = typeof onyuGalleryCgEntriesForChapter === 'function'
      ? onyuGalleryCgEntriesForChapter(ch, record) : [];
    entries.forEach(function (entry) {
      var unlocked = entry.unlocked;
      var cgFile = entry.file;
      var div = document.createElement('div');
      div.className = 'cg-thumb' + (unlocked ? '' : ' is-locked');
      var labelText = 'CH' + String(ch.order).padStart(2, '0') + (entry.label ? ' · ' + entry.label : '');
      if (unlocked && cgFile) {
        // 풀린 것만 실제 이미지를 요청한다 — 잠긴 항목은 스포일러 방지 겸 불필요한
        // 네트워크 요청을 안 하려고 아예 <img>를 안 만든다.
        div.innerHTML = '<img src="assets/cg/' + cgFile + '" alt="" draggable="false">'
          + '<span class="cg-label num">' + labelText + '</span>';
        // 기록은 풀렸지만 파일이 아직 배포되지 않은 경우에도 브라우저 기본
        // 깨진 이미지 아이콘을 노출하지 않고 잠금 상태로 표시한다.
        var cgImg = div.querySelector('img');
        var openCg = function () {
          if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('gallery_item_opened', { kind: 'cg', itemId: ch.id + ':' + cgFile });
          onyuOpenCgBrowse(cgFile);
        };
        cgImg.addEventListener('error', function () {
          div.classList.add('is-locked');
          div.innerHTML = '<span class="cg-lock" aria-label="잠긴 CG">🔒</span>';
          div.removeEventListener('click', openCg);
        }, { once: true });
        div.addEventListener('click', openCg);
      } else {
        div.innerHTML = '<span class="cg-lock">🔒</span><span class="cg-label cg-label-locked">' + labelText + '</span>';
      }
      cgPanel.appendChild(div);
    });
  });

  var endingPanel = document.getElementById('gallery-panel-endings');
  endingPanel.innerHTML = '';
  ONYU_ENDING_DEFS.forEach(function (ed) {
    var unlocked = !!(record.endings && record.endings[ed.id]);
    var cgFile = window.ONYU_ENDING_CG && window.ONYU_ENDING_CG[ed.id];
    var div = document.createElement('div');
    div.className = 'ending-thumb' + (unlocked ? ' is-unlocked' : '');
    if (unlocked && cgFile) {
      div.innerHTML = '<img src="assets/cg/' + cgFile + '" alt="" draggable="false">'
        + '<span class="ending-name">' + ed.name + '</span>';
      var endingImg = div.querySelector('img');
      var openEndingCg = function () {
        if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('gallery_item_opened', { kind: 'ending', itemId: ed.id });
        onyuOpenCgBrowse(cgFile);
      };
      endingImg.addEventListener('error', function () {
        div.classList.remove('is-unlocked');
        div.innerHTML = '<span class="ending-lock" aria-label="잠긴 엔딩 CG">🔒</span><span class="ending-name">???</span>';
        div.removeEventListener('click', openEndingCg);
      }, { once: true });
      div.addEventListener('click', openEndingCg);
    } else {
      div.innerHTML = '<span class="ending-lock">🔒</span><span class="ending-name">???</span>';
    }
    endingPanel.appendChild(div);
  });

  var bgmPanel = document.getElementById('gallery-panel-bgm');
  bgmPanel.innerHTML = '';
  var activeBgmId = typeof window.onyuAudioGetActiveTrackId === 'function'
    ? window.onyuAudioGetActiveTrackId() : '';
  (window.ONYU_BGM_GALLERY_TRACKS || []).forEach(function (track) {
    var unlocked = !!(record.bgm && record.bgm[track.id]);
    var card = document.createElement('article');
    card.className = 'bgm-card' + (unlocked ? '' : ' is-locked') + (activeBgmId === track.id ? ' is-playing' : '');
    var title = document.createElement('h3');
    title.className = 'bgm-title';
    title.textContent = unlocked ? track.title : '잠긴 BGM';
    var subtitle = document.createElement('p');
    subtitle.className = 'bgm-subtitle';
    subtitle.textContent = unlocked ? track.subtitle : '게임에서 한 번 재생하면 해금됩니다.';
    var action = document.createElement('button');
    action.type = 'button';
    action.className = 'bgm-play-btn';
    action.disabled = !unlocked;
    action.textContent = unlocked ? (activeBgmId === track.id ? '재생 중' : '▶ 재생') : '🔒 잠김';
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(action);
    if (unlocked) {
      action.addEventListener('click', function () {
        if (typeof window.onyuAudioPlayGalleryTrack === 'function') {
          window.onyuAudioPlayGalleryTrack(track.id);
          onyuRenderGallery();
        }
      });
    }
    bgmPanel.appendChild(card);
  });

  var activeGalleryTab = document.querySelector('[data-gallery-tab].is-active');
  if (activeGalleryTab && activeGalleryTab.dataset.galleryTab === 'reviews') {
    if (!onyuPublicReviewsLoaded) onyuLoadPublicReviews(true);
    else onyuRenderPublicReviews();
  }
}

function onyuRenderPublicReviews() {
  var list = document.getElementById('gallery-review-list');
  var status = document.getElementById('gallery-review-status');
  var more = document.getElementById('gallery-review-more');
  if (!list || !status || !more) return;
  list.innerHTML = onyuPublicReviewsCache.map(function (item) {
    var card = document.createElement('article');
    card.className = 'review-gallery-card';
    var heading = document.createElement('h3');
    heading.textContent = '온 이유 · 플레이 후기';
    var body = document.createElement('p');
    body.textContent = item.review || '';
    var date = document.createElement('time');
    date.dateTime = new Date(item.updatedAt || item.createdAt || Date.now()).toISOString();
    date.textContent = onyuFormatDate(item.updatedAt || item.createdAt || Date.now());
    card.appendChild(heading);
    card.appendChild(body);
    card.appendChild(date);
    return card.outerHTML;
  }).join('');
  if (!onyuPublicReviewsCache.length) status.textContent = '아직 공개된 플레이 후기가 없습니다.';
  else status.textContent = '익명으로 등록된 플레이 후기입니다.';
  more.hidden = !onyuPublicReviewsHasMore;
}

async function onyuLoadPublicReviews(reset) {
  var status = document.getElementById('gallery-review-status');
  var more = document.getElementById('gallery-review-more');
  if (!status || !more) return;
  status.textContent = '후기를 불러오는 중...';
  more.disabled = true;
  try {
    var page = await window.onyuListPublicPlayerReviews({ cursor: reset ? null : onyuPublicReviewsCursor });
    var reviews = Array.isArray(page.reviews) ? page.reviews : [];
    onyuPublicReviewsCache = reset ? reviews : onyuPublicReviewsCache.concat(reviews);
    onyuPublicReviewsCursor = page.nextCursor || null;
    onyuPublicReviewsHasMore = !!page.hasMore;
    onyuPublicReviewsLoaded = true;
    onyuRenderPublicReviews();
  } catch (error) {
    console.warn('온 이유 공개 후기 조회 실패:', error);
    status.textContent = '후기를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.';
    more.hidden = false;
    more.textContent = '다시 불러오기';
  } finally {
    more.disabled = false;
  }
}

function onyuInitGallerySubtabs() {
  var buttons = document.querySelectorAll('[data-gallery-tab]');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      var tab = btn.dataset.galleryTab;
      document.getElementById('gallery-panel-cg').hidden = (tab !== 'cg');
      document.getElementById('gallery-panel-endings').hidden = (tab !== 'endings');
      document.getElementById('gallery-panel-bgm').hidden = (tab !== 'bgm');
      document.getElementById('gallery-panel-reviews').hidden = (tab !== 'reviews');
      if (tab === 'reviews' && !onyuPublicReviewsLoaded) onyuLoadPublicReviews(true);
    });
  });
  var more = document.getElementById('gallery-review-more');
  if (more) more.addEventListener('click', function () {
    if (onyuPublicReviewsLoaded && !onyuPublicReviewsHasMore && onyuPublicReviewsCache.length) return;
    if (more.textContent === '다시 불러오기') { more.textContent = '이전 후기 더 보기'; onyuLoadPublicReviews(true); return; }
    onyuLoadPublicReviews(false);
  });
}

/* ---------------- 저장 · 불러오기 ---------------- */

function onyuRenderSaveScreen() {
  var fromPlay = (onyuReturnScreen === 'play');

  // 화면 자체는 저장/불러오기 공용이라 진입 경로에 따라 하는 일이 정반대인데
  // ("저장 · 불러오기"라는 고정 문구만 보면 지금이 어느 모드인지 알 수 없다는
  // 피드백을 받고) 제목·설명·빈 슬롯 문구를 모드에 맞게 바꿔서 명확히 한다.
  document.getElementById('save-screen-topbar-title').textContent = fromPlay ? '저장하기' : '불러오기';
  document.getElementById('save-screen-title').textContent = fromPlay ? '저장하기' : '불러오기';
  document.getElementById('save-screen-sub').textContent = fromPlay
    ? '슬롯을 선택하면 지금 진행 상황이 그 자리에 저장됩니다(기존 내용은 덮어쓰기).'
    : '불러올 저장 파일을 선택하세요. 자동저장 또는 수동 슬롯 중 하나를 고르면 그 시점부터 다시 시작합니다.';
  document.getElementById('save-screen-slot-label').textContent = fromPlay ? '수동 저장 (5칸)' : '수동 저장 불러오기 (5칸)';

  var autosaveContainer = document.getElementById('autosave-slot');
  var snap = onyuLoadAutosave();
  if (typeof onyuIsValidSnapshot === 'function' && !onyuIsValidSnapshot(snap)) snap = null;
  if (snap) {
    var ch = window.ONYU_CHAPTERS[onyuChapterIndexById(snap.currentChapterId)];
    autosaveContainer.innerHTML =
      '<div class="autosave-card"><div class="autosave-thumb"' + onyuSaveThumbnailStyle(snap, ch) + '></div><div class="autosave-info">'
      + '<div class="autosave-name-row"><span class="autosave-badge">자동</span>'
      + '<p class="autosave-name">CH.' + String(ch.order).padStart(2, '0') + ' · ' + ch.title + '</p></div>'
      + '<p class="autosave-date num">' + onyuFormatDate(snap.savedAt) + '</p></div></div>';
    if (!fromPlay) {
      // 불러오기 모드에선 자동저장도 눌러서 바로 불러올 수 있어야 한다 — 지금까진
      // 이 카드가 정보 표시 전용이라 타이틀의 "이어하기" 버튼으로만 불러올 수
      // 있었는데, 이 화면 자체가 "불러오기" 화면인 이상 여기서도 가능해야 맞다.
      autosaveContainer.querySelector('.autosave-card').addEventListener('click', function () {
        if (typeof onyuIsValidSnapshot === 'function' && !onyuIsValidSnapshot(snap)) {
          if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'auto', reason: 'invalid' });
          return;
        }
        try { onyuApplySnapshot(snap); } catch (error) {
          if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'auto', reason: 'exception' });
          return;
        }
        onyuRequestFullscreen();
        if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_loaded', { kind: 'auto', chapterId: snap.currentChapterId || '' });
        onyuStartChapter(snap.currentChapterId);
      });
      autosaveContainer.querySelector('.autosave-card').classList.add('is-clickable');
    }
  } else {
    autosaveContainer.innerHTML = '<p class="autosave-empty">아직 자동저장 기록이 없습니다.</p>';
  }

  var grid = document.getElementById('manual-slot-grid');
  grid.innerHTML = '';

  for (var i = 1; i <= 5; i++) {
    (function (slotIndex) {
      var slotSnap = onyuLoadManualSlot(slotIndex);
      if (typeof onyuIsValidSnapshot === 'function' && !onyuIsValidSnapshot(slotSnap)) slotSnap = null;
      var btn = document.createElement('button');
      btn.className = 'save-slot' + (slotSnap ? '' : ' is-empty');
      if (slotSnap) {
        var sch = window.ONYU_CHAPTERS[onyuChapterIndexById(slotSnap.currentChapterId)];
        btn.innerHTML =
          '<div class="save-slot-thumb"' + onyuSaveThumbnailStyle(slotSnap, sch) + '><span class="save-slot-chapter num">CH.' + String(sch.order).padStart(2, '0') + '</span></div>'
          + '<div class="save-slot-meta"><p class="save-slot-name">' + sch.title + '</p>'
          + '<p class="save-slot-date num">' + onyuFormatDate(slotSnap.savedAt) + '</p></div>';
      } else {
        btn.innerHTML =
          '<div class="save-slot-thumb"><span class="save-slot-empty-label">빈 슬롯</span></div>'
          + '<div class="save-slot-meta"><p class="save-slot-name">—</p><p class="save-slot-date">사용 안 함</p></div>';
      }
      if (fromPlay) {
        // 플레이 중 진입 — 어느 슬롯이든 클릭하면 지금 진행 상황을 그 자리에 저장.
        btn.addEventListener('click', function () {
          onyuSaveManualSlot(slotIndex);
          onyuRenderSaveScreen();
        });
      } else if (slotSnap) {
        // 타이틀에서 진입 — 채워진 슬롯만 불러오기 가능.
        btn.addEventListener('click', function () {
          var loaded = onyuLoadManualSlot(slotIndex);
          if (typeof onyuIsValidSnapshot === 'function' && !onyuIsValidSnapshot(loaded)) {
            if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'manual', slot: slotIndex, reason: loaded ? 'invalid' : 'missing' });
            return;
          }
          try { onyuApplySnapshot(loaded); } catch (error) {
            if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_load_failed', { kind: 'manual', slot: slotIndex, reason: 'exception' });
            return;
          }
          onyuRequestFullscreen();
          if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('save_loaded', { kind: 'manual', slot: slotIndex, chapterId: loaded.currentChapterId || '' });
          onyuStartChapter(loaded.currentChapterId);
        });
      } else {
        btn.disabled = true;
      }
      grid.appendChild(btn);
    })(i);
  }
}

/* ---------------- 설정 ---------------- */

function onyuRenderSettingsScreen() {
  var s = window.ONYU_STATE.settings;
  var bgmPct = Math.round(s.bgmVolume * 100);
  var sfxPct = Math.round(s.sfxVolume * 100);
  document.getElementById('setting-bgm').value = bgmPct;
  document.getElementById('setting-bgm-pct').textContent = bgmPct + '%';
  document.getElementById('setting-sfx').value = sfxPct;
  document.getElementById('setting-sfx-pct').textContent = sfxPct + '%';

  document.querySelectorAll('#setting-autoplay button').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.value === (s.autoPlay ? 'auto' : 'manual'));
  });
  document.querySelectorAll('#setting-textspeed button').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.value === s.textSpeed);
  });
  document.getElementById('setting-skipread').classList.toggle('is-on', s.skipRead);
  document.getElementById('setting-reducemotion').classList.toggle('is-on', s.reduceMotion);
}

function onyuInitSettingsControls() {
  document.getElementById('setting-bgm').addEventListener('input', function (e) {
    window.ONYU_STATE.settings.bgmVolume = Number(e.target.value) / 100;
    document.getElementById('setting-bgm-pct').textContent = e.target.value + '%';
    if (typeof onyuAudioRefreshVolume === 'function') onyuAudioRefreshVolume();
    onyuSaveSettings();
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('settings_changed', { setting: 'bgmVolume', value: Number(e.target.value) });
  });
  document.getElementById('setting-sfx').addEventListener('input', function (e) {
    window.ONYU_STATE.settings.sfxVolume = Number(e.target.value) / 100;
    document.getElementById('setting-sfx-pct').textContent = e.target.value + '%';
    onyuSaveSettings();
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('settings_changed', { setting: 'sfxVolume', value: Number(e.target.value) });
  });
  document.querySelectorAll('#setting-autoplay button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('ui-toggle');
      window.ONYU_STATE.settings.autoPlay = (b.dataset.value === 'auto');
      onyuRenderSettingsScreen();
      onyuSaveSettings();
      if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('settings_changed', { setting: 'autoPlay', value: b.dataset.value });
    });
  });
  document.querySelectorAll('#setting-textspeed button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('ui-toggle');
      window.ONYU_STATE.settings.textSpeed = b.dataset.value;
      onyuRenderSettingsScreen();
      onyuSaveSettings();
      if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('settings_changed', { setting: 'textSpeed', value: b.dataset.value });
    });
  });
  document.getElementById('setting-skipread').addEventListener('click', function () {
    if (typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('ui-toggle');
    window.ONYU_STATE.settings.skipRead = !window.ONYU_STATE.settings.skipRead;
    onyuRenderSettingsScreen();
    onyuSaveSettings();
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('settings_changed', { setting: 'skipRead', value: window.ONYU_STATE.settings.skipRead });
  });
  document.getElementById('setting-reducemotion').addEventListener('click', function () {
    if (typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('ui-toggle');
    window.ONYU_STATE.settings.reduceMotion = !window.ONYU_STATE.settings.reduceMotion;
    onyuRenderSettingsScreen();
    onyuSaveSettings();
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('settings_changed', { setting: 'reduceMotion', value: window.ONYU_STATE.settings.reduceMotion });
  });
  var adminModeToggle = document.getElementById('onyu-admin-mode-toggle');
  if (adminModeToggle) adminModeToggle.addEventListener('click', function () {
    if (typeof onyuAudioPlaySfx === 'function') onyuAudioPlaySfx('ui-toggle');
    if (window.onyuToggleAdminMode) window.onyuToggleAdminMode();
  });
}
