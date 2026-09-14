/*
 * Play 화면 런타임 — 대사 진행, 선택지 분기, 타자기 출력, 이름 입력.
 * 챕터의 script 배열은 choice 안에 다시 script 배열이 중첩된 구조라, 프레임 스택으로
 * "지금 어느 리스트의 몇 번째 줄을 보고 있는지"를 관리한다. 선택지를 고르면 그 옵션의
 * script를 새 프레임으로 push하고, 프레임이 끝나면 pop해서 바깥 리스트로 돌아온다.
 */

var onyuFrameStack = [];
var onyuTyping = { timer: null, fullText: '', shown: 0, active: false };
var onyuCurrentExpr = 'calm'; // 스탠딩 프롬프트 시트의 6종 표정과 1:1 대응
var onyuAutoAdvanceTimer = null; // 설정 "진행 방식: 자동"용 예약 타이머

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

function onyuSpriteFile(season, expr) {
  var prefix = (season === 'autumn' || season === 'winter') ? 'w' : 's';
  var n = ONYU_EXPR_INDEX[expr] || 1;
  return prefix + n;
}

function onyuApplySprite() {
  var idx = onyuChapterIndexById(window.ONYU_STATE.currentChapterId);
  var chapter = window.ONYU_CHAPTERS[idx];
  onyuEl.spriteImg.src = 'assets/standing/' + onyuSpriteFile(chapter.season, onyuCurrentExpr) + '.png';
}

function onyuTextSpeedMs() {
  var map = { slow: 60, normal: 35, fast: 18 };
  return map[window.ONYU_STATE.settings.textSpeed] || 35;
}

// CG(32장)는 스탠딩·배경과 달리 챕터당 한 장만 쓰이고 장당 용량도 더 클 가능성이
// 높아서, 32장을 전부 미리 받아두면 초기 로딩이 너무 무거워진다. 대신 지금 챕터를
// 읽는 동안 "다음 챕터"에 쓸 CG 한 장만 미리 fetch해둔다 — 플레이어가 실제로 그
// 챕터에 도달할 때쯤엔 이미 캐시에 있어 지연이 없다. chapter.cg 필드가 아직 없는
// 챕터(지금 CH01·CH02 포함, Phase 2에서 실제 CG 파일명이 정해지면 채워질 예정)는
// 조용히 아무것도 안 한다.
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
    window.ONYU_STATE.currentChapterId = chapterId;
    window.ONYU_STATE.chapterCheckpoints[chapterId] = window.ONYU_STATE.affection;
    onyuFrameStack = [{ list: chapter.script, i: 0 }];
    onyuCurrentExpr = 'calm'; // 챕터 시작은 항상 평온으로 리셋
    onyuPrefetchNextChapterCg(idx);

    onyuEl.chapterTag.textContent = 'CH.' + String(chapter.order).padStart(2, '0') + ' · ' + chapter.title;
    document.body.setAttribute('data-season', chapter.season);
    onyuApplySprite();
    // 계절 낙하 파티클(벚꽃/빗방울/낙엽/눈)은 사용자 요청으로 일단 비활성화(2026-09-14).
    // onyuSpawnParticles(onyuEl.particleLayer, chapter.season);

    onyuSwapScreen('play');
    onyuRenderCurrentNode();
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

function onyuStepToNextNode() {
  // 현재 프레임 포인터를 하나 전진시키고, 프레임이 끝났으면 스택을 정리한다.
  while (onyuFrameStack.length) {
    var frame = onyuCurrentFrame();
    frame.i++;
    if (frame.i < frame.list.length) return true;
    onyuFrameStack.pop(); // 이 프레임(선택지 분기 등) 종료 — 바깥으로 복귀
  }
  return false; // 챕터 전체 종료
}

function onyuRenderCurrentNode() {
  clearTimeout(onyuAutoAdvanceTimer); // 새 노드로 넘어갈 땐 이전 노드용 자동진행 예약을 항상 취소
  onyuEl.choiceList.innerHTML = '';
  onyuEl.situation.textContent = '';
  onyuEl.nameForm.hidden = true;
  onyuEl.nameError.textContent = ''; // 이전에 이름을 잘못 입력했을 때 뜬 안내문이 다음 노드까지 안 남게

  var node = onyuCurrentNode();
  if (node === undefined) { onyuFinishChapter(); return; }

  // 선택지가 떠 있는 동안은 대사창 자체를 접어서 없앤다 — 기획서 "선택지 리액션"이
  // 선택된 말풍선이 대사창 "자리로" 모핑해 들어가는 연출이라, 그 전까지 빈 대사창이
  // 따로 떠 있으면 안 맞는다(선택 전엔 대사창이 존재하지 않는 셈).
  onyuEl.dialogueBox.style.display = (node.type === 'choice') ? 'none' : '';

  // 나레이션에 sheAbsent:true가 달려 있으면(그녀가 물리적으로 그 장면에 없는 순간) 그
  // 동안만 스탠딩을 숨긴다 — line/choice 등 다른 노드에서는 항상 다시 보인다(그녀가
  // 등장/발화하는 순간이므로).
  var absent = node.type === 'narration' && node.sheAbsent === true;
  onyuEl.spriteWrap.classList.toggle('is-hidden', absent);

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
      onyuFrameStack.push({ list: branch.script, i: 0 });
      onyuRenderCurrentNode();
    } else if (onyuStepToNextNode()) {
      onyuRenderCurrentNode();
    } else {
      onyuFinishChapter();
    }
  }
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
  var node = onyuCurrentNode();
  if (!node || node.type === 'choice' || node.type === 'nameInput') return; // 선택/입력 중엔 클릭 무시
  if (onyuTyping.active) { onyuCompleteTypewriter(); return; }
  if (onyuStepToNextNode()) onyuRenderCurrentNode();
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
    // 대사창이 지금 display:none이라 그대로 재면 rect가 전부 0이 된다 — 순간적으로
    // 보이게 해서 실제 자리를 잰 뒤(동기 실행이라 화면엔 안 그려짐) 바로 다시 숨긴다.
    onyuEl.dialogueBox.style.display = '';
    var dialogueRect = onyuEl.dialogueBox.getBoundingClientRect();
    onyuEl.dialogueBox.style.display = 'none';
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
  if (onyuStepToNextNode()) onyuRenderCurrentNode();
  else onyuFinishChapter();
}

function onyuFinishChapter() {
  var finishedId = window.ONYU_STATE.currentChapterId;
  window.ONYU_STATE.completedChapters[finishedId] = true; // "이미 읽은 텍스트 스킵" 판단용
  if (finishedId !== 'ch27') onyuUnlockGalleryItem('cg', finishedId); // CH27은 CG가 아니라 엔딩으로 언락됨
  onyuSaveAutosave();
  var idx = onyuChapterIndexById(window.ONYU_STATE.currentChapterId);
  var next = window.ONYU_CHAPTERS[idx + 1];
  if (next) {
    // 챕터 사이엔 다음 챕터 제목 카드를 잠깐 보여주며 쉬어가는 전환을 넣는다 —
    // 이 전환이 화면을 덮는 동안 onyuStartChapter가 실제 초기화를 수행하므로,
    // 플레이어에게는 "제목 카드 → 다음 챕터 첫 줄"로 자연스럽게 이어져 보인다.
    var nextLabel = 'CH.' + String(next.order).padStart(2, '0') + ' · ' + next.title;
    onyuRunTransition({ holdMs: 1100, chapterLabel: nextLabel }, function () {
      onyuStartChapter(next.id);
    });
  } else {
    // CH27(마지막 챕터) 완주 — 엔딩→시그니처 오프닝→타이틀 복귀 연출은 Phase 4에서
    // 만들 예정이라 지금은 완주했다는 것만 알리는 임시 화면.
    onyuEl.speakerTag.hidden = true;
    onyuEl.situation.textContent = '';
    onyuEl.choiceList.innerHTML = '';
    onyuEl.dialogueLine.textContent = '— 끝 — (엔딩 연출은 준비 중입니다. 타이틀로 돌아가려면 새로고침하세요.)';
  }
}
