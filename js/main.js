/* 부트스트랩 — DOM 참조 연결 + 타이틀 화면 버튼 배선. */

// 스탠딩 12장(장당 1.5~2MB)을 표정이 바뀌는 그 순간 처음 요청하면 네트워크·디코딩
// 지연 때문에 "대사는 바로 나오는데 표정만 한 박자 늦게 바뀌는" 현상이 생긴다.
// 그래서 페이지 로드 즉시(타이틀 화면을 보는 동안) 미리 받아서 브라우저 캐시에
// 데워둔다 — onyuApplySprite()가 나중에 .src를 바꿀 때는 캐시 히트라 즉시 반영된다.
var onyuPreloadedSprites = [];
['s1', 's2', 's3', 's4', 's5', 's6', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'].forEach(function (name) {
  var img = new Image();
  img.src = 'assets/standing/' + name + '.png';
  onyuPreloadedSprites.push(img); // 참조를 들고 있어야 로드 도중 GC로 취소되지 않는다
});

// 재사용 배경 13종(B1~B13, 기획서 ARTWORK 기준)도 스탠딩과 같은 이유로 부팅 시 통째로
// 프리로드한다 — 개수가 적고(13장) 여러 챕터에서 계속 재사용되니 스탠딩과 성격이 같다.
// 아직 실제 파일이 없어서 지금은 전부 404로 끝나지만(콘솔에만 조용히 남고 화면엔
// 영향 없음), 나중에 assets/backgrounds/b1.png~b13.png를 채워 넣기만 하면 코드
// 수정 없이 바로 프리로드·사용된다.
var onyuPreloadedBackgrounds = [];
for (var onyuBgI = 1; onyuBgI <= 13; onyuBgI++) {
  var bgImg = new Image();
  bgImg.src = 'assets/backgrounds/b' + onyuBgI + '.png';
  onyuPreloadedBackgrounds.push(bgImg);
}

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
  onyuEl.dialogueBox = document.getElementById('dialogue-box');

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

  // 회전 안내 화면을 탭하면 그 탭 자체(유효한 사용자 제스처)로 전체화면 재시도 —
  // 일부 모바일 브라우저는 새 게임/이어하기 클릭 시점의 requestFullscreen이 조용히
  // 실패하는 경우가 있어(주소창이 그대로 남음), 세로 화면일 때 계속 떠 있는 이
  // 오버레이가 다시 시도할 자연스러운 탭 지점이 되어준다.
  document.getElementById('rotate-overlay').addEventListener('click', onyuRequestFullscreen);

  ['title-chapters', 'title-gallery', 'title-settings'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', function () { alert('이 화면은 아직 준비 중입니다.'); });
  });

  onyuShowScreen('title');
});
