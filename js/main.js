/* 부트스트랩 — DOM 참조 연결 + 타이틀 화면 버튼 배선. */

document.addEventListener('DOMContentLoaded', function () {
  onyuBootLoadGallery();

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

  // 대사창뿐 아니라 플레이 화면 빈 곳 아무 데나 클릭해도 진행되게(모바일 시청 편의).
  // 선택지·이름입력 중에는 onyuHandleDialogueClick 자체가 no-op이라 별도 예외 처리가 필요 없다.
  document.getElementById('screen-play').addEventListener('click', onyuHandleDialogueClick);
  onyuEl.nameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    onyuSubmitName();
  });

  // 표지 CG(기획서 CG #1)가 준비되면 자동으로 타이틀 일러스트를 그쪽으로 교체.
  // 아직 없으면(404) 지금처럼 스탠딩 일러스트를 그대로 쓴다.
  (function tryTitleCoverCg() {
    var titleImg = document.querySelector('.title-figure img');
    var probe = new Image();
    probe.onload = function () { titleImg.src = 'assets/cg/cover.png'; };
    probe.src = 'assets/cg/cover.png';
  })();

  var continueBtn = document.getElementById('title-continue');
  var autosave = onyuLoadAutosave();
  if (!autosave) {
    continueBtn.disabled = true;
    continueBtn.classList.add('is-disabled');
  }

  document.getElementById('title-new-game').addEventListener('click', function () {
    onyuResetNewGame();
    onyuRequestFullscreen();
    onyuStartChapter(window.ONYU_STATE.currentChapterId);
  });

  continueBtn.addEventListener('click', function () {
    var snap = onyuLoadAutosave();
    if (!snap) return;
    onyuApplySnapshot(snap);
    onyuRequestFullscreen();
    onyuStartChapter(snap.currentChapterId);
  });

  ['title-chapters', 'title-gallery', 'title-settings'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', function () { alert('이 화면은 아직 준비 중입니다.'); });
  });

  onyuShowScreen('title');
});
