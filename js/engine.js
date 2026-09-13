/*
 * Play 화면 런타임 — 대사 진행, 선택지 분기, 타자기 출력, 이름 입력.
 * 챕터의 script 배열은 choice 안에 다시 script 배열이 중첩된 구조라, 프레임 스택으로
 * "지금 어느 리스트의 몇 번째 줄을 보고 있는지"를 관리한다. 선택지를 고르면 그 옵션의
 * script를 새 프레임으로 push하고, 프레임이 끝나면 pop해서 바깥 리스트로 돌아온다.
 */

var onyuFrameStack = [];
var onyuTyping = { timer: null, fullText: '', shown: 0, active: false };
var onyuCurrentExpr = 'calm'; // 스탠딩 프롬프트 시트의 6종 표정과 1:1 대응

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

function onyuStartChapter(chapterId) {
  var idx = onyuChapterIndexById(chapterId);
  if (idx === -1) { console.error('알 수 없는 챕터', chapterId); return; }
  var chapter = window.ONYU_CHAPTERS[idx];
  window.ONYU_STATE.currentChapterId = chapterId;
  window.ONYU_STATE.chapterCheckpoints[chapterId] = window.ONYU_STATE.affection;
  onyuFrameStack = [{ list: chapter.script, i: 0 }];
  onyuCurrentExpr = 'calm'; // 챕터 시작은 항상 평온으로 리셋

  onyuEl.chapterTag.textContent = 'CH.' + String(chapter.order).padStart(2, '0') + ' · ' + chapter.title;
  document.body.setAttribute('data-season', chapter.season);
  onyuApplySprite();
  onyuSpawnParticles(onyuEl.particleLayer, chapter.season);

  onyuShowScreen('play');
  onyuRenderCurrentNode();
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
  onyuEl.choiceList.innerHTML = '';
  onyuEl.situation.textContent = '';
  onyuEl.nameForm.hidden = true;

  var node = onyuCurrentNode();
  if (node === undefined) { onyuFinishChapter(); return; }

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
    node.options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.className = 'choice-bubble';
      btn.textContent = opt.text;
      btn.addEventListener('click', function () { onyuSelectChoice(node, opt); });
      onyuEl.choiceList.appendChild(btn);
    });
  } else if (node.type === 'nameInput') {
    onyuEl.speakerTag.hidden = true;
    onyuEl.dialogueLine.textContent = '';
    onyuEl.nameForm.hidden = false;
    onyuEl.nameInput.value = '';
    onyuEl.nameError.textContent = '';
    onyuEl.nameInput.focus();
  }
}

function onyuStartTypewriter(text, slowMultiplier) {
  onyuTyping.fullText = text;
  onyuTyping.shown = 0;
  onyuTyping.active = true;
  onyuEl.dialogueLine.textContent = '';
  var baseMs = onyuTextSpeedMs() * (slowMultiplier || 1);

  function tick() {
    if (!onyuTyping.active) return;
    onyuTyping.shown++;
    onyuEl.dialogueLine.textContent = onyuTyping.fullText.slice(0, onyuTyping.shown);
    if (onyuTyping.shown >= onyuTyping.fullText.length) {
      onyuTyping.active = false;
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
  var node = onyuCurrentNode();
  if (!node || node.type === 'choice' || node.type === 'nameInput') return; // 선택/입력 중엔 클릭 무시
  if (onyuTyping.active) { onyuCompleteTypewriter(); return; }
  if (onyuStepToNextNode()) onyuRenderCurrentNode();
  else onyuFinishChapter();
}

function onyuSelectChoice(choiceNode, option) {
  window.ONYU_STATE.affection += option.affection;
  onyuFrameStack.push({ list: option.script, i: 0 });
  onyuRenderCurrentNode();
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
  onyuSaveAutosave();
  var idx = onyuChapterIndexById(window.ONYU_STATE.currentChapterId);
  var next = window.ONYU_CHAPTERS[idx + 1];
  if (next) {
    onyuStartChapter(next.id);
  } else {
    onyuEl.speakerTag.hidden = true;
    onyuEl.situation.textContent = '';
    onyuEl.choiceList.innerHTML = '';
    onyuEl.dialogueLine.textContent = '여기까지가 지금 이식된 분량이에요 — 다음 챕터는 준비 중입니다.';
  }
}
