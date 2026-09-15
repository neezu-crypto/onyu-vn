/*
 * Play 화면 런타임 — 대사 진행, 선택지 분기, 타자기 출력, 이름 입력.
 * 챕터의 script 배열은 choice 안에 다시 script 배열이 중첩된 구조라, 프레임 스택으로
 * "지금 어느 리스트의 몇 번째 줄을 보고 있는지"를 관리한다. 선택지를 고르면 그 옵션의
 * script를 새 프레임으로 push하고, 프레임이 끝나면 pop해서 바깥 리스트로 돌아온다.
 */

var onyuFrameStack = [];
var onyuTyping = { timer: null, fullText: '', shown: 0, active: false };
var onyuCurrentExpr = 'calm'; // 스탠딩 프롬프트 시트의 6종 표정과 1:1 대응
var onyuCurrentBg = null; // 재사용 배경 13종(b1~b13) 중 현재 표시할 키 — expr과 동일하게 "다음 지정 전까지 유지"
var onyuAutoAdvanceTimer = null; // 설정 "진행 방식: 자동"용 예약 타이머

// CG/화면 전환 연출 중에는 #screen-play의 전체 화면 클릭 리스너가 대사를
// 진행시키지 않도록 입력을 잠근다. 오버레이가 페이드아웃을 시작하는 순간
// pointer-events가 다시 풀리는 CSS 구조라, DOM 오버레이만으로는 그 마지막
// 1초 동안 탭이 아래 화면에 도달할 수 있다.
var onyuInputLockDepth = 0;
function onyuLockInput() { onyuInputLockDepth++; }
function onyuUnlockInput() { onyuInputLockDepth = Math.max(0, onyuInputLockDepth - 1); }

// 대사를 빠르게 연타해서 넘기다가 그 타이밍에 마침 선택지가 뜨면, 미처 보기도
// 전에 그 연타가 그대로 선택지를 눌러버릴 위험이 있다(실사용 피드백) — 선택지가
// 뜨고 나서 이 시간(ms) 동안은 클릭을 무시해 안전 여유를 둔다.
var ONYU_CHOICE_INPUT_LOCK_MS = 450;
var onyuChoiceInputLocked = false;

var onyuEl = {}; // DOM 참조는 main.js가 부팅 시 채운다

// onyu-vn-standing-prompts.html 기준 S1~S6 / W1~W6 표정 순서
var ONYU_EXPR_INDEX = { calm: 1, smile: 2, surprised: 3, shy: 4, worried: 5, pouty: 6 };

function onyuSpeakerLabel(key) {
  if (key === 'player') return window.ONYU_STATE.playerName || '플레이어';
  return window.SPEAKER_LABELS[key] || key;
}

function onyuSpriteFile(season, expr, spriteSet) {
  var prefix = spriteSet || ((season === 'autumn' || season === 'winter') ? 'w' : 's');
  var n = ONYU_EXPR_INDEX[expr] || 1;
  return prefix + n;
}

function onyuApplySprite() {
  var idx = onyuChapterIndexById(window.ONYU_STATE.currentChapterId);
  var chapter = window.ONYU_CHAPTERS[idx];
  var spriteSet = chapter.spriteSet
    || window.ONYU_STATE.chosenOutfits[chapter.id] // 사복 후원 픽커(outfit-picker.js)에서 고른 결과
    || (window.onyuResolveSpriteCandidate && window.onyuResolveSpriteCandidate(chapter.id));
  onyuEl.spriteImg.src = 'assets/standing/' + onyuSpriteFile(chapter.season, onyuCurrentExpr, spriteSet) + '.png';
}

// 재사용 배경 13종 중 하나가 지정된 챕터(chapter.bg)만 사진을 깔고, 지정이 없는
// 챕터(재사용 로케이션 13곳에 안 맞는 장소, 예: 교외로 나가는 소풍)는 기존
// 계절 그라데이션 워시만 그대로 쓴다 — 없는 배경을 억지로 아무거나 보여주지 않음.
function onyuApplyBackground() {
  if (onyuCurrentBg) {
    // url()을 CSS 커스텀 프로퍼티에 넣어 var()로 참조하면, 그 상대경로가
    // "값을 설정한 곳"이 아니라 "var()가 실제로 쓰인 스타일시트(css/style.css)"
    // 기준으로 풀려서 엉뚱한 경로(예: css/assets/...)가 되는 CSS 스펙상의
    // 함정이 있다 — 그래서 background-image 전체를 인라인 스타일로 직접
    // 설정한다(인라인 스타일의 상대경로는 문서 기준으로 풀려 정상 동작).
    var seasonSoft = getComputedStyle(document.body).getPropertyValue('--season-soft').trim();
    var paper = getComputedStyle(document.body).getPropertyValue('--paper').trim();

    // 챕터 계절 전용 변형(예: b2-winter.png)이 실제로 존재하면(main.js가 부팅 시
    // probe해서 onyuBgVariantAvailable에 캐시해둠) 그쪽을 쓰고, 없으면 조용히
    // 기본 배경으로 폴백한다 — 일부 원화에 계절 요소(벚꽃 등)가 그려져 있어
    // 다른 계절 챕터에 그대로 쓰면 텍스트와 안 맞는 문제를 보완하기 위함.
    var chapterIdx = onyuChapterIndexById(window.ONYU_STATE.currentChapterId);
    var season = window.ONYU_CHAPTERS[chapterIdx].season;
    var variantKey = onyuCurrentBg + '-' + season;
    var fileKey = (window.onyuBgVariantAvailable && window.onyuBgVariantAvailable[variantKey]) ? variantKey : onyuCurrentBg;

    onyuEl.bg.style.backgroundImage =
      'linear-gradient(165deg, color-mix(in srgb, ' + seasonSoft + ' 45%, transparent), color-mix(in srgb, ' + paper + ' 20%, transparent) 68%), ' +
      "url('assets/backgrounds/" + fileKey + ".png')";
    onyuEl.bg.classList.add('has-photo');
  } else {
    onyuEl.bg.classList.remove('has-photo');
    onyuEl.bg.style.backgroundImage = ''; // 인라인 스타일 제거 → CSS 기본 그라데이션으로 복귀
  }
}

function onyuTextSpeedMs() {
  var map = { slow: 60, normal: 35, fast: 18 };
  return map[window.ONYU_STATE.settings.textSpeed] || 35;
}

// CG(32장)는 스탠딩·배경과 달리 챕터당 한 장만 쓰이고 장당 용량도 더 클 가능성이
// 높아서, 32장을 전부 미리 받아두면 초기 로딩이 너무 무거워진다. 대신 지금 챕터를
// 읽는 동안 "다음 챕터"에 쓸 CG 한 장만 미리 fetch해둔다 — 플레이어가 실제로 그
// 챕터에 도달할 때쯤엔 이미 캐시에 있어 지연이 없다. CH01~26은 chapter.cg 파일명이
// 이미 확정돼 있지만(2026-09-15), 실제 이미지 파일은 아직 생성 전이라 지금은 전부
// 조용한 404로 끝난다(에러 없음, 프리페치 실패는 그냥 캐시 워밍 실패일 뿐이라
// 무시해도 안전) — 파일이 생기는 대로 자동으로 정상 동작한다.
var onyuPrefetchedCg = [];
function onyuPrefetchNextChapterCg(currentIdx) {
  var next = window.ONYU_CHAPTERS[currentIdx + 1];
  if (!next || !next.cg) return;
  var img = new Image();
  img.src = 'assets/cg/' + next.cg;
  onyuPrefetchedCg.push(img);
}

function onyuStartChapter(chapterId) {
  // 새 게임/이어하기/타임머신 점프/불러오기 등 이 함수로 들어오는 모든 경로가
  // 전환 오버레이로 덮인 채 초기화되게 감싼다 — onyuFinishChapter가 이미 자기
  // 전환(챕터 타이틀 카드+대기)을 걸어둔 채로 이 함수를 부르는 경우엔
  // onyuTransitionDepth가 이미 1 이상이라 onyuRunTransition이 추가 페이드 없이
  // callback을 바로 실행한다(그래서 이중 페이드가 겹치지 않는다).
  onyuRunTransition({}, function () {
    var idx = onyuChapterIndexById(chapterId);
    if (idx === -1) { console.error('알 수 없는 챕터', chapterId); return; }
    var chapter = window.ONYU_CHAPTERS[idx];
    // 이전 챕터의 타자기·자동진행 타이머가 아직 살아있으면(사복 픽커처럼 이
    // 챕터의 첫 노드 렌더가 뒤로 미뤄지는 경로가 생기면서 발견된 문제) 그 사이에도
    // 계속 틱이 돌면서 방금 비워둔 대사창을 이전 챕터 텍스트로 도로 채우거나,
    // 자동진행 설정이 켜져 있으면 아직 아무것도 확정 안 된 상태에서 다음 노드로
    // 넘어가버릴 수 있다 — 새 챕터 진입 시점에 확실히 멈춰둔다.
    clearTimeout(onyuTyping.timer);
    onyuTyping.active = false;
    clearTimeout(onyuAutoAdvanceTimer);
    window.ONYU_STATE.currentChapterId = chapterId;
    window.ONYU_STATE.chapterCheckpoints[chapterId] = window.ONYU_STATE.affection;
    onyuFrameStack = [{ list: chapter.script, i: 0 }];
    onyuCurrentExpr = 'calm'; // 챕터 시작은 항상 평온으로 리셋
    onyuCurrentBg = chapter.bg || null; // 챕터 기본 배경(없으면 계절 워시만)
    onyuPrefetchNextChapterCg(idx);

    onyuEl.chapterTag.textContent = 'CH.' + String(chapter.order).padStart(2, '0') + ' · ' + chapter.title;
    document.body.setAttribute('data-season', chapter.season);
    onyuApplySprite();
    onyuApplyBackground();
    // 계절 낙하 파티클(벚꽃/빗방울/낙엽/눈)은 사용자 요청으로 일단 비활성화(2026-09-14).
    // onyuSpawnParticles(onyuEl.particleLayer, chapter.season);

    onyuSwapScreen('play');
    // 사복 후원 픽커(outfit-picker.js) — 이 챕터에 무료/후원 2종 후보가 다 준비돼
    // 있고 아직 이번 플레이스루에서 고르지 않았으면, 대사 시작 전에 먼저 골라야
    // 한다. 해당 없는 챕터는 onDone이 그 자리에서 바로 불려 체감상 아무 변화 없음.
    onyuMaybeShowOutfitPicker(chapterId, function () {
      onyuApplySprite(); // 의상을 골랐다면 반영해서 다시 적용
      onyuRenderCurrentNode();
    });
  });
}

function onyuCurrentFrame() {
  return onyuFrameStack[onyuFrameStack.length - 1];
}

function onyuCurrentNode() {
  var frame = onyuCurrentFrame();
  if (!frame) return null;
  if (frame.i >= frame.list.length) return undefined; // 이 프레임 끝
  return frame.list[frame.i];
}

var onyuLastAdvancePoppedFrame = false; // onyuStepToNextNode가 프레임을 하나 이상 pop했는지(선택지 분기 등 하나의 "이야기"가 끝나고 바깥 이야기로 복귀하는 지점인지)

function onyuStepToNextNode() {
  // 현재 프레임 포인터를 하나 전진시키고, 프레임이 끝났으면 스택을 정리한다.
  onyuLastAdvancePoppedFrame = false;
  while (onyuFrameStack.length) {
    var frame = onyuCurrentFrame();
    frame.i++;
    if (frame.i < frame.list.length) return true;
    onyuFrameStack.pop(); // 이 프레임(선택지 분기 등) 종료 — 바깥으로 복귀
    onyuLastAdvancePoppedFrame = true;
  }
  return false; // 챕터 전체 종료
}

// onyuStepToNextNode() 뒤에 실제로 다음 노드를 그릴 때 항상 이걸로 부른다. 방금
// 선택지 분기(또는 CH27 scoreGate 분기) 하나가 끝나서 바깥 이야기로 돌아온
// 참이면(onyuLastAdvancePoppedFrame) 짧은 암전 트랜지션을 한 번 걸어 "이야기와
// 이야기 사이"에 숨 고르는 틈을 준다 — 그냥 같은 흐름 안에서 다음 줄로 넘어가는
// 보통의 클릭 진행에는 트랜지션을 넣지 않는다(매 줄마다 걸면 진행이 답답해짐).
// 챕터↔챕터 전환(onyuStartChapter)과 같은 오버레이를 재사용하되 chapterLabel 없이
// 짧게(holdMs 400) 써서 타이틀 카드 없는 순수 암전 컷으로 보인다.
function onyuRenderNextNode() {
  if (onyuLastAdvancePoppedFrame) {
    onyuRunTransition({ holdMs: 400 }, onyuRenderCurrentNode);
  } else {
    onyuRenderCurrentNode();
  }
}

function onyuRenderCurrentNode() {
  clearTimeout(onyuAutoAdvanceTimer); // 새 노드로 넘어갈 땐 이전 노드용 자동진행 예약을 항상 취소
  onyuEl.choiceList.innerHTML = '';
  onyuEl.situation.textContent = '';
  onyuEl.nameForm.hidden = true;
  onyuEl.nameError.textContent = ''; // 이전에 이름을 잘못 입력했을 때 뜬 안내문이 다음 노드까지 안 남게

  var node = onyuCurrentNode();
  if (node === undefined) { onyuFinishChapter(); return; }

  // 한 챕터 안에서 장소가 바뀌는 경우(예: CH27 강당→교문)만 노드에 bg 필드를
  // 달아 배경을 바꾼다 — expr과 동일하게 "다음 지정 전까지 유지"되는 방식.
  if (node.bg) {
    onyuCurrentBg = node.bg;
    onyuApplyBackground();
  }

  // 선택지가 떠 있는 동안은 대사창 내용을 비우고 안 보이게 한다 — 기획서 "선택지
  // 리액션"이 선택된 말풍선이 대사창 "자리로" 모핑해 들어가는 연출이라, 그 전까지
  // 빈 대사창이 그대로 보이면 안 맞는다. display:none이 아니라 visibility:hidden을
  // 쓰는 이유는 레이아웃 공간(min-height 160px)은 그대로 유지해야 하기 때문 —
  // 그래야 설명 캡션+선택지 묶음이 대사창 자리를 밀고 내려오지 않고 그 위쪽에
  // 뜬다(대사창이 사라진 자리를 대신 채우지 않음). display:none이었다면 대사창이
  // 레이아웃에서 완전히 빠져 선택지 묶음이 화면 맨 아래까지 내려왔을 것이다.
  onyuEl.dialogueBox.style.visibility = (node.type === 'choice') ? 'hidden' : '';

  // 나레이션에 sheAbsent:true가 달려 있으면(그녀가 물리적으로 그 장면에 없는 순간) 그
  // 동안만 스탠딩을 숨긴다 — line/choice 등 다른 노드에서는 항상 다시 보인다(그녀가
  // 등장/발화하는 순간이므로).
  var absent = node.type === 'narration' && node.sheAbsent === true;
  if (onyuTransitionDepth > 0) {
    // 화면 전환 오버레이가 아직 화면을 덮고 있는 도중(챕터 시작 직후 첫 노드
    // 렌더 등)이라면 트랜지션 없이 즉시 반영한다 — 그대로 두면 스탠딩의 자체
    // opacity 트랜지션(.35s)이 오버레이가 걷히는 페이드아웃과 동시에 진행돼,
    // 오버레이가 열리는 순간 "막 바뀐 의상의 스탠딩이 잠깐 보였다 사라지는"
    // 깜빡임으로 드러난다(실사용 스크린 녹화로 확인된 버그). 화면 전환 도중이
    // 아닌 평범한 mid-chapter sheAbsent 전환(그녀가 눈앞에서 자리를 뜨는 등)은
    // 이 분기를 안 타므로 기존의 부드러운 페이드가 그대로 유지된다.
    onyuEl.spriteWrap.style.transition = 'none';
    onyuEl.spriteWrap.classList.toggle('is-hidden', absent);
    void onyuEl.spriteWrap.offsetHeight; // 강제 리플로우로 트랜지션 없이 즉시 적용
    onyuEl.spriteWrap.style.transition = '';
  } else {
    onyuEl.spriteWrap.classList.toggle('is-hidden', absent);
  }

  if (node.type === 'narration') {
    onyuEl.speakerTag.hidden = true;
    onyuStartTypewriter(node.text, node.slow);
  } else if (node.type === 'line') {
    onyuEl.speakerTag.hidden = false;
    onyuEl.speakerTag.textContent = node.speakerLabel || onyuSpeakerLabel(node.speaker);
    if (node.speaker === 'onyu' && node.expr) {
      onyuCurrentExpr = node.expr;
      onyuApplySprite();
    }
    onyuStartTypewriter(node.text, node.slow);
  } else if (node.type === 'choice') {
    onyuEl.speakerTag.hidden = true;
    onyuEl.dialogueLine.textContent = '';
    onyuEl.situation.textContent = node.situation;

    var reduceMotionForChoice = window.ONYU_STATE.settings.reduceMotion;
    onyuChoiceInputLocked = true;
    setTimeout(function () { onyuChoiceInputLocked = false; }, ONYU_CHOICE_INPUT_LOCK_MS);

    node.options.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-bubble' + (reduceMotionForChoice ? '' : ' is-entering');
      if (!reduceMotionForChoice) btn.style.transitionDelay = (i * 70) + 'ms';
      var fill = document.createElement('span');
      fill.className = 'choice-fill';
      var label = document.createElement('span');
      label.className = 'choice-label';
      label.textContent = opt.text;
      btn.appendChild(fill);
      btn.appendChild(label);
      btn.addEventListener('click', function (evt) { onyuSelectChoice(node, opt, evt, btn, fill); });
      onyuEl.choiceList.appendChild(btn);
    });
    if (!reduceMotionForChoice) {
      // 같은 프레임에서 바로 클래스를 빼면 브라우저가 시작 상태(opacity:0)를
      // 못 그려 트랜지션이 생략된다 — 다음 프레임에서 벗겨야 실제로 재생된다.
      requestAnimationFrame(function () {
        onyuEl.choiceList.querySelectorAll('.choice-bubble.is-entering').forEach(function (b) {
          b.classList.remove('is-entering');
        });
      });
    }
  } else if (node.type === 'nameInput') {
    onyuEl.speakerTag.hidden = true;
    onyuEl.dialogueLine.textContent = '';
    onyuEl.nameForm.hidden = false;
    onyuEl.nameInput.value = '';
    onyuEl.nameError.textContent = '';
    onyuEl.nameInput.focus();
  } else if (node.type === 'setAddressStage') {
    // 화면에 아무것도 안 띄우는 순수 상태 변경 노드(호칭 단계 전환 등) — 값을
    // 반영하고 그 자리에서 곧장 다음 노드로 넘어간다. 재귀 호출이지만 화면
    // 갱신 없이 동기적으로 끝나서 브라우저가 이 중간 상태를 그릴 일이 없다.
    window.ONYU_STATE.addressStage = node.value;
    if (onyuStepToNextNode()) onyuRenderCurrentNode();
    else onyuFinishChapter();
  } else if (node.type === 'scoreGate') {
    // CH27 전용 — 선택지 없이 최종 누적 호감도로만 우정/썸/연인 3갈래 중 하나를
    // 고른다. choice와 달리 플레이어 입력을 기다리지 않고, 해당 구간의 script를
    // 프레임으로 push한 뒤 곧장 그 첫 노드를 렌더한다(onyuSelectChoice와 동일 패턴).
    var score = window.ONYU_STATE.affection;
    var branch = node.branches.filter(function (b) {
      var min = (b.min === undefined) ? -Infinity : b.min;
      var max = (b.max === undefined) ? Infinity : b.max;
      return score >= min && score <= max;
    })[0];
    if (branch) {
      if (branch.id) onyuUnlockGalleryItem('endings', branch.id);
      window.ONYU_STATE.lastEndingId = branch.id; // 엔딩 화면 타이틀 조회용(onyuFinishChapter)
      onyuFrameStack.push({ list: branch.script, i: 0 });
      // 우정/썸/연인 갈림길 — 여러 갈래 중 하나가 갈리는 순간이라 일반 선택지
      // 분기 종료(onyuRenderNextNode)보다도 더 뚜렷한 "이야기 사이" 지점인데,
      // scoreGate는 최상위 프레임에 있어 pop이 없어서 그 경로를 안 탄다 — 여기서
      // 직접 같은 암전 트랜지션을 걸어준다.
      onyuRunTransition({ holdMs: 400 }, onyuRenderCurrentNode);
    } else if (onyuStepToNextNode()) {
      onyuRenderNextNode();
    } else {
      onyuFinishChapter();
    }
  } else if (node.type === 'cgReveal') {
    // 본편 CG 팝업(CG 노출 시스템 설계 v1.0, Mechanism 1) — 대본 어디에나 넣을 수
    // 있는 트리거 노드. 필드가 없어 현재 챕터의 chapter.cg를 그대로 쓰되, CH27
    // 엔딩 분기(chapter.cg 없음)에서는 lastEndingId로 ONYU_ENDING_CG를 조회한다.
    // 사복 픽커 적용 챕터(ONYU_OUTFIT_CG_VARIANTS)는 chapter.cg보다 우선해서 그
    // 회차에 고른 사복(chosenOutfits)에 맞는 CG를 고른다 - paid 접두사와 정확히
    // 일치할 때만 유료판, 그 외(무료를 골랐거나 아직 안 골랐거나)는 전부 무료판.
    var revealIdx = onyuChapterIndexById(window.ONYU_STATE.currentChapterId);
    var revealChapter = window.ONYU_CHAPTERS[revealIdx];
    var revealOutfitVariant = window.ONYU_OUTFIT_CG_VARIANTS && window.ONYU_OUTFIT_CG_VARIANTS[revealChapter.id];
    var revealOutfitChoice = window.ONYU_OUTFIT_CHOICES && window.ONYU_OUTFIT_CHOICES[revealChapter.id];
    var revealCgFile = revealOutfitVariant
      ? ((revealOutfitChoice && window.ONYU_STATE.chosenOutfits[revealChapter.id] === revealOutfitChoice.paid)
        ? revealOutfitVariant.paid
        : revealOutfitVariant.free)
      : (revealChapter.cg || (window.ONYU_ENDING_CG && window.ONYU_ENDING_CG[window.ONYU_STATE.lastEndingId]));
    if (!revealCgFile) {
      if (onyuStepToNextNode()) onyuRenderNextNode();
      else onyuFinishChapter();
      return;
    }
    onyuShowCgReveal(revealCgFile, revealChapter.id, function () {
      if (onyuStepToNextNode()) onyuRenderNextNode();
      else onyuFinishChapter();
    });
  }
}

// CG 노출 시스템 설계 v1.0, Mechanism 1 — 풀스크린 CG 팝업. 이미지가 없으면(404)
// 조용히 onDone만 불러 다음 노드로 넘어간다(팝업 자체가 생략된 것처럼). 실제로
// 뜬 시점에 갤러리 언락도 같이 기록한다("봤다 = 갤러리에 남는다").
function onyuShowCgReveal(cgFile, chapterId, onDone) {
  var overlay = onyuEl.cgViewerOverlay;
  var img = onyuEl.cgViewerImg;
  var hint = onyuEl.cgViewerHint;
  var reduceMotion = window.ONYU_STATE.settings.reduceMotion;
  var settled = false;
  var hintTimer = null;
  var inputReady = false;
  onyuLockInput();

  function finish() {
    // 페이드인/안내 문구가 끝나기 전의 연타는 CG를 닫지 못하게 한다.
    if (settled || !inputReady) return;
    settled = true;
    clearTimeout(hintTimer);
    overlay.removeEventListener('click', finish);
    overlay.classList.remove('is-active');
    hint.classList.remove('is-visible');
    if (reduceMotion) {
      overlay.hidden = true;
      onyuUnlockInput();
      onDone();
    } else {
      setTimeout(function () {
        overlay.hidden = true;
        onyuUnlockInput();
        onDone();
      }, 1000);
    }
  }

  img.onerror = function () {
    img.onerror = null; img.onload = null;
    onyuUnlockInput();
    onDone();
  };
  img.onload = function () {
    img.onerror = null;
    onyuUnlockGalleryItem('cg', chapterId);
    overlay.hidden = false;
    img.classList.remove('is-visible'); // 이전 노출분의 상태가 남아있지 않게 초기화
    if (reduceMotion) {
      overlay.classList.add('is-active');
      img.classList.add('is-visible');
      hint.classList.add('is-visible');
      inputReady = true;
    } else {
      // 암전(오버레이가 화면 전체를 검게 덮음, 1s) -> 그 위에서 CG 노출 -> 페이드인
      // (img 자체의 별도 1s 트랜지션) 3단계로 분리 - "띡" 하고 바로 뜨지 않게
      // 오버레이가 완전히 덮인 뒤에야 이미지 페이드인을 시작한다(2026-09-15, 사용자
      // 지시). 힐링 장르 톤에 맞춰 배경·CG 페이드를 전부 1s로 통일(2026-09-16,
      // 사용자 지시) - 아래 지연 값들도 CSS 트랜지션 시간과 맞춰 같이 조정.
      //
      // void overlay.offsetHeight로 강제 리플로우(2026-09-16 추가) - hidden=false로
      // display:none에서 벗어난 바로 그 틱에 requestAnimationFrame으로 opacity
      // 트랜지션을 걸면, 브라우저가 "opacity:0으로 실제 렌더된 이전 프레임"을 갖지
      // 못해 트랜지션을 건너뛰고 곧장 최종값(opacity:1)으로 스냅해버리는 문제가
      // 실측(실제 클릭 흐름을 15ms 간격으로 정밀 샘플링)으로 확인됐다. 리플로우를
      // 강제해 "opacity:0" 상태를 먼저 실제로 커밋시킨 뒤에야 is-active를 붙여야
      // 트랜지션이 정상 재생된다.
      void overlay.offsetHeight;
      requestAnimationFrame(function () { overlay.classList.add('is-active'); });
      setTimeout(function () { img.classList.add('is-visible'); }, 1020);
      hintTimer = setTimeout(function () {
        hint.classList.add('is-visible');
        inputReady = true;
      }, 2020);
    }
    overlay.addEventListener('click', finish);
  };
  img.src = 'assets/cg/' + cgFile;
}

// 갤러리에서 이미 풀린 CG를 다시 감상할 때(브라우징 모드) — 같은 오버레이를
// onDone 콜백 없이 재사용, 클릭하면 그냥 닫히기만 한다. 본편 팝업과 달리 암전
// 홀드 없이 즉시 페이드인(가볍게 훑어보는 용도라 연출을 무겁게 가져갈 이유가 없음).
function onyuOpenCgBrowse(cgFile) {
  var overlay = onyuEl.cgViewerOverlay;
  var img = onyuEl.cgViewerImg;
  var inputReady = false;
  onyuLockInput();
  img.onload = null;
  img.onerror = null;
  img.classList.remove('is-visible');
  img.src = 'assets/cg/' + cgFile;
  overlay.hidden = false;
  void overlay.offsetHeight; // 강제 리플로우 - onyuShowCgReveal과 동일한 이유
  requestAnimationFrame(function () {
    overlay.classList.add('is-active');
    img.classList.add('is-visible');
    setTimeout(function () { inputReady = true; }, 1000);
  });
  function close() {
    if (!inputReady) return;
    overlay.removeEventListener('click', close);
    overlay.classList.remove('is-active');
    setTimeout(function () {
      overlay.hidden = true;
      onyuUnlockInput();
    }, 1000);
  }
  overlay.addEventListener('click', close);
}

function onyuScheduleAutoAdvance(text) {
  // 설정 "진행 방식: 자동"일 때만 예약 — 글자 수에 비례해 대기(대략 읽는 시간)한 뒤
  // 다음 노드로 스스로 넘어간다. 새 노드가 렌더될 때마다 onyuRenderCurrentNode
  // 맨 앞에서 항상 취소되므로, 클릭으로 먼저 넘어가도 중복 실행되지 않는다.
  if (!window.ONYU_STATE.settings.autoPlay) return;
  var delay = 500 + text.length * 40;
  onyuAutoAdvanceTimer = setTimeout(onyuHandleDialogueClick, delay);
}

function onyuStartTypewriter(text, slowMultiplier) {
  onyuTyping.fullText = text;
  onyuTyping.shown = 0;
  onyuEl.dialogueLine.textContent = '';

  // "이미 읽은 텍스트 스킵" — 타임머신으로 이미 완주한 챕터를 다시 훑을 때 타자기
  // 애니메이션 자체를 생략(줄 단위가 아니라 챕터 단위 판단, 아래 스키마 주석 참고).
  var skipThisChapter = window.ONYU_STATE.settings.skipRead
    && !!window.ONYU_STATE.completedChapters[window.ONYU_STATE.currentChapterId];
  if (skipThisChapter) {
    onyuTyping.active = false;
    onyuEl.dialogueLine.textContent = text;
    onyuScheduleAutoAdvance(text);
    return;
  }

  onyuTyping.active = true;
  var baseMs = onyuTextSpeedMs() * (slowMultiplier || 1);

  function tick() {
    if (!onyuTyping.active) return;
    onyuTyping.shown++;
    onyuEl.dialogueLine.textContent = onyuTyping.fullText.slice(0, onyuTyping.shown);
    if (onyuTyping.shown >= onyuTyping.fullText.length) {
      onyuTyping.active = false;
      onyuScheduleAutoAdvance(text);
      return;
    }
    var ch = onyuTyping.fullText[onyuTyping.shown - 1];
    var delay = baseMs;
    if (ch === '.' || ch === '!' || ch === '?') delay = baseMs * 6;
    onyuTyping.timer = setTimeout(tick, delay);
  }
  clearTimeout(onyuTyping.timer);
  tick();
}

function onyuCompleteTypewriter() {
  clearTimeout(onyuTyping.timer);
  onyuTyping.active = false;
  onyuEl.dialogueLine.textContent = onyuTyping.fullText;
}

function onyuHandleDialogueClick() {
  onyuMaybeRecoverFullscreen();
  if (onyuInputLockDepth > 0) return;
  var node = onyuCurrentNode();
  if (!node || node.type === 'choice' || node.type === 'nameInput' || node.type === 'cgReveal') return; // 선택/입력/CG 팝업 중엔 클릭 무시(각자 자기 오버레이 클릭으로만 해제)
  if (onyuTyping.active) { onyuCompleteTypewriter(); return; }
  if (onyuStepToNextNode()) onyuRenderNextNode();
  else onyuFinishChapter();
}

// 기획서 "선택지 리액션": 클릭 즉시 클릭한 말풍선이 그 지점부터 season-accent 색으로
// 차오르고(물감 번짐) 텍스트가 흰색으로 반전, 나머지 말풍선은 동시에 페이드아웃 →
// ~400ms 홀드 후 선택된 말풍선이 대사창 자리로 모핑하듯 사라지고 → 같은 텍스트가
// 대사창의 플레이어 대사로 이어진다. 호감도가 오르는지 내리는지는 색·이펙트로
// 절대 힌트를 주지 않는다(모든 선택이 시각적으로 동일하게 처리됨).
function onyuSelectChoice(choiceNode, option, evt, clickedBtn, fillEl) {
  // 이 클릭이 #screen-play의 "빈 곳 클릭하면 진행" 리스너로 버블링되면 안 된다 —
  // 버블링되는 시점엔 이미 아래에서 프레임을 push해 다음 노드로 넘어간 상태라
  // onyuHandleDialogueClick의 "선택지 중엔 무시" 가드가 안 먹혀서 애니메이션이
  // 뜨기도 전에 즉시 다음 줄로 넘어가버리는 버그가 있었다.
  evt.stopPropagation();
  if (onyuChoiceInputLocked) return; // 선택지가 막 뜬 직후의 연타성 오클릭 무시
  onyuMaybeRecoverFullscreen();
  window.ONYU_STATE.affection += option.affection;
  onyuFrameStack.push({ list: option.script, i: 0 });

  var buttons = Array.prototype.slice.call(onyuEl.choiceList.querySelectorAll('.choice-bubble'));
  buttons.forEach(function (btn) {
    btn.disabled = true;
    if (btn !== clickedBtn) btn.classList.add('is-fading');
  });

  var reduceMotion = window.ONYU_STATE.settings.reduceMotion
    || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduceMotion) { onyuRenderCurrentNode(); return; }

  var rect = clickedBtn.getBoundingClientRect();
  var x = evt.clientX - rect.left;
  var y = evt.clientY - rect.top;
  fillEl.style.left = x + 'px';
  fillEl.style.top = y + 'px';
  void fillEl.offsetHeight; // 강제 리플로우 — 위치 지정 후에 확장 트랜지션이 걸리게
  clickedBtn.classList.add('is-selected');

  setTimeout(function () {
    // 대사창은 visibility:hidden이라(레이아웃 공간은 유지, 화면엔 안 그려짐)
    // display:none일 때와 달리 곧바로 실제 자리를 잴 수 있다.
    var dialogueRect = onyuEl.dialogueBox.getBoundingClientRect();
    var clickedRect = clickedBtn.getBoundingClientRect();
    var dx = (dialogueRect.left + dialogueRect.width / 2) - (clickedRect.left + clickedRect.width / 2);
    var dy = (dialogueRect.top + dialogueRect.height / 2) - (clickedRect.top + clickedRect.height / 2);
    clickedBtn.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.9)';
    clickedBtn.classList.add('is-morphing');
  }, 400);

  setTimeout(onyuRenderCurrentNode, 400 + 350);
}

function onyuSubmitName() {
  var raw = onyuEl.nameInput.value.trim();
  var korean = /^[가-힣]{2,8}$/;
  var english = /^[A-Za-z]{2,16}$/;
  if (!korean.test(raw) && !english.test(raw)) {
    onyuEl.nameError.textContent = '음... 다시 말해줄래?';
    return;
  }
  window.ONYU_STATE.playerName = raw;
  onyuEl.nameForm.hidden = true;
  if (onyuStepToNextNode()) onyuRenderNextNode();
  else onyuFinishChapter();
}

function onyuFinishChapter() {
  var finishedId = window.ONYU_STATE.currentChapterId;
  window.ONYU_STATE.completedChapters[finishedId] = true; // "이미 읽은 텍스트 스킵" 판단용
  // CG 갤러리 언락은 챕터 완주 시점이 아니라 cgReveal 노드가 실제로 뜬 순간으로
  // 옮겼다(onyuShowCgReveal) — "봤다 = 갤러리에 남는다"가 더 자연스럽고, 이미지
  // 파일이 아직 없어 팝업이 조용히 스킵된 경우 불필요하게 언락되지 않는다.
  onyuSaveAutosave();
  var idx = onyuChapterIndexById(window.ONYU_STATE.currentChapterId);
  var next = window.ONYU_CHAPTERS[idx + 1];
  if (next) {
    // 챕터 사이엔 다음 챕터 제목 카드를 잠깐 보여주며 쉬어가는 전환을 넣는다 —
    // 이 전환이 화면을 덮는 동안 onyuStartChapter가 실제 초기화를 수행하므로,
    // 플레이어에게는 "제목 카드 → 다음 챕터 첫 줄"로 자연스럽게 이어져 보인다.
    // 학년 전환(CH09·CH18 진입)엔 전용 CG를 얹고 홀드를 늘린다(CG 노출 시스템 Mechanism 3).
    var nextLabel = 'CH.' + String(next.order).padStart(2, '0') + ' · ' + next.title;
    var transitionCg = window.ONYU_GRADE_TRANSITION_CG && window.ONYU_GRADE_TRANSITION_CG[next.id];
    onyuRunTransition({ holdMs: transitionCg ? 2400 : 1100, chapterLabel: nextLabel, cg: transitionCg }, function () {
      onyuStartChapter(next.id);
    });
  } else {
    // CH27(마지막 챕터) 완주 — 연인 엔딩이면 갤러리 CG 크레딧 몽타주(CG 노출 시스템
    // Mechanism 4)를 먼저 보여준 뒤 엔딩 타이틀 화면으로. 우정/썸은 몽타주 없이 바로.
    onyuMaybePlayEndingCredits(function () {
      onyuRunTransition({ holdMs: 600 }, function () {
        onyuShowEndingScreen(window.ONYU_STATE.lastEndingId);
      });
    });
  }
}

// CG 노출 시스템 설계 v1.0, Mechanism 4 — 연인 엔딩 전용, 갤러리에 실제로 풀린
// CG를 챕터 순서대로 크로스페이드 재생. 클릭해도 넘어가지 않는 스킵 불가 연출로
// 확정(2026-09-15) — 모션 줄이기 설정만 접근성 예외로 몽타주 자체를 생략한다.
function onyuMaybePlayEndingCredits(onDone) {
  if (window.ONYU_STATE.lastEndingId !== 'lover' || window.ONYU_STATE.settings.reduceMotion) {
    onDone();
    return;
  }
  var record = onyuLoadGalleryRecord();
  var files = window.ONYU_CHAPTERS
    .filter(function (c) { return c.cg && record.cg && record.cg[c.id]; })
    .map(function (c) { return c.cg; });
  if (!files.length) { onDone(); return; }

  var overlay = onyuEl.endingCreditsOverlay;
  var img = onyuEl.endingCreditsImg;
  onyuLockInput();
  overlay.hidden = false;
  void overlay.offsetHeight; // 강제 리플로우 - onyuShowCgReveal과 동일한 이유(display:none 직후
                              // 곧바로 opacity 트랜지션을 걸면 스냅되는 문제 방지)
  requestAnimationFrame(function () { overlay.classList.add('is-active'); });

  // 이미지 1장당 갭(60ms)+페이드인(1s, CSS #ending-credits-img)이 끝난 뒤에도
  // 잠깐 더 머물다 다음 장으로 넘어가게 hold를 페이드 시간의 2배로 잡는다(기존
  // 300ms 페이드일 때 600ms hold와 같은 비율 - 2026-09-16, 배경·CG 페이드 전부
  // 1s로 통일하면서 같이 조정).
  var i = 0;
  function showNext() {
    if (i >= files.length) {
      overlay.classList.remove('is-active');
      setTimeout(function () {
        overlay.hidden = true;
        onyuUnlockInput();
        onDone();
      }, 1000);
      return;
    }
    img.classList.remove('is-visible');
    setTimeout(function () {
      img.src = 'assets/cg/' + files[i];
      img.classList.add('is-visible');
      i++;
      setTimeout(showNext, 2000);
    }, 60); // 크로스페이드가 실제로 재생될 최소한의 갭
  }
  showNext();
}

function onyuShowEndingScreen(endingId) {
  var title = (window.ONYU_ENDING_TITLES && window.ONYU_ENDING_TITLES[endingId]) || '';
  onyuEl.endingTitle.textContent = title;
  onyuEl.endingOverlay.hidden = false;
  requestAnimationFrame(function () { onyuEl.endingOverlay.classList.add('is-active'); });
}
