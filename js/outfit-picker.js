/*
 * 사복 후보 2종 선택 UI. 일반 시청자는 게임 접근 승인을 이미 받은 상태이므로 두 의상을
 * 자유롭게 고르고, 스트리머 인증 유저는 방송 중 직접 후원을 확인한 뒤 꾸민 의상을 고른다.
 * 시청자가 실제로 별풍선을 쐈는지는 코드가 알 방법이 없다(자동 후원 감지 없음) —
 * 스트리머가 스스로 판단해서 고르고, 꾸민 의상은 실수 클릭 방지용 확인 모달을
 * 한 번 더 거친다. game-data.js의 chapter.spriteSet(체육복 등 고정 세트)이 있는
 * 챕터나 ONYU_SPRITE_CANDIDATES(단일 세트, 예: CH27 졸업 가운)에는 관여하지 않는다.
 */

// { [chapterId]: { free, paid, price } } — 두 접두사 이미지가 assets/standing/에 실제로
// 있어야 픽커가 뜬다. 하나라도 없으면 조용히 기존 season 폴백으로 진행 — 이미지
// 파일만 두 프리픽스 다 넣으면 코드 수정 없이 바로 픽커가 활성화된다.
var ONYU_OUTFIT_CHOICES = {
  ch12: { free: 'C1-', paid: 'P1-', price: 80 },
  ch13: { free: 'C13-', paid: 'P13-', price: 80 },
  ch16: { free: 'C16-', paid: 'P16-', price: 80 },
  ch24: { free: 'C24-', paid: 'P24-', price: 80 },
};

// 카드 DOM은 한 번만 배선하고, 현재 열린 픽커의 동작만 이 상태로 교체한다.
// 챕터마다 addEventListener를 반복하면 모바일의 pointerup/touchend/click 합성
// 이벤트가 이전 챕터 콜백까지 호출해 현재 선택을 덮어쓸 수 있다.
var onyuActiveOutfitPicker = null;

function onyuHandleOutfitCardActivation(cardId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  var active = onyuActiveOutfitPicker;
  if (!active) return;
  if (cardId === 'free') active.choose(event);
  else active.choosePaid(event);
}

document.addEventListener('DOMContentLoaded', function () {
  Object.keys(ONYU_OUTFIT_CHOICES).forEach(function (chapterId) {
    var c = ONYU_OUTFIT_CHOICES[chapterId];
    onyuProbeSpritePrefix(c.free);
    onyuProbeSpritePrefix(c.paid);
  });

  onyuEl.outfitPickerOverlay = document.getElementById('outfit-picker-overlay');
  onyuEl.outfitFreeCard = document.getElementById('outfit-free-card');
  onyuEl.outfitFreeImg = document.getElementById('outfit-free-img');
  onyuEl.outfitPaidCard = document.getElementById('outfit-paid-card');
  onyuEl.outfitPaidImg = document.getElementById('outfit-paid-img');
  onyuEl.outfitPaidBadge = document.getElementById('outfit-paid-badge');
  onyuEl.outfitConfirmModal = document.getElementById('outfit-confirm-modal');
  onyuEl.outfitConfirmPrice = document.getElementById('outfit-confirm-price');
  onyuEl.outfitConfirmYes = document.getElementById('outfit-confirm-yes');
  onyuEl.outfitConfirmNo = document.getElementById('outfit-confirm-no');

  // 이 오버레이는 #screen-play 안쪽에 있어서, 카드가 아닌 빈 공간을 클릭하면
  // 이벤트가 #screen-play까지 버블링돼 onyuHandleDialogueClick이 불릴 수 있다 —
  // 이 시점엔 아직 챕터의 첫 노드가 렌더되기 전이라 그 클릭이 "선택지 중 클릭
  // 무시" 가드에 안 걸리고 그대로 다음 노드로 넘어가버려 프레임 포인터가
  // 미리 하나 밀리는 실제 버그가 있었다 — 오버레이에서 나가는 클릭을 여기서 막는다.
  onyuEl.outfitPickerOverlay.addEventListener('click', function (e) { e.stopPropagation(); });
  onyuEl.outfitConfirmModal.addEventListener('click', function (e) { e.stopPropagation(); });

  // 버튼마다 한 번만 등록한다. 전체화면 모바일 브라우저는 손가락을 뗄 때
  // pointerup/touchend를 취소하는 경우가 있어 누르는 순간(pointerdown/touchstart)
  // 도 함께 받는다. active 상태의 selecting/promptOpen 가드가 중복 호출을 제거한다.
  ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'click'].forEach(function (eventName) {
    onyuEl.outfitFreeCard.addEventListener(eventName, function (event) {
      onyuHandleOutfitCardActivation('free', event);
    }, { capture: true, passive: false });
    onyuEl.outfitPaidCard.addEventListener(eventName, function (event) {
      onyuHandleOutfitCardActivation('paid', event);
    }, { capture: true, passive: false });
  });
});

// engine.js의 onyuStartChapter가 대사를 그리기 직전에 호출한다. 이미 이번
// 플레이스루에서 골라뒀거나 이 챕터에 후원 선택 자체가 없으면 onDone을 그 자리에서
// 바로 불러 픽커 없이 넘어간다. 두 이미지 중 하나만 준비됐으면(작업 중간 상태)
// 실제로 고를 게 없으므로 픽커 없이 그 하나를 바로 적용 — "파일만 넣으면 바로
// 적용" 원칙을 유지하다가, 나머지 한 장까지 마저 채워지면 그 다음 새 플레이스루부터
// 진짜 2지선다 픽커가 뜬다.
function onyuMaybeShowOutfitPicker(chapterId, onDone) {
  if (window.ONYU_STATE.chosenOutfits[chapterId]) { onDone(); return; }
  var choice = ONYU_OUTFIT_CHOICES[chapterId];
  if (!choice) { onDone(); return; }

  var freeReady = !!window.onyuSpriteVariantAvailable[choice.free];
  var paidReady = !!window.onyuSpriteVariantAvailable[choice.paid];
  if (!freeReady && !paidReady) { onDone(); return; }
  if (freeReady !== paidReady) {
    window.ONYU_STATE.chosenOutfits[chapterId] = freeReady ? choice.free : choice.paid;
    onDone();
    return;
  }
  onyuEl.outfitFreeImg.src = 'assets/standing/' + choice.free + '1.png';
  onyuEl.outfitPaidImg.src = 'assets/standing/' + choice.paid + '1.png';
  var priceLabel = '별풍선 ' + choice.price + '개';
  if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('outfit_picker_shown', { chapterId: chapterId });
  // 꾸민 의상은 시청자 후원 조건과 그 결과를 한눈에 이해할 수 있도록 안내한다.
  // 줄바꿈은 CSS의 white-space: pre-line으로
  // 카드 배지 안에서 그대로 표시되며, 이 공통 로직을 타는 모든 의상 이벤트에 적용된다.
  onyuEl.outfitPaidBadge.textContent = '시청자에게 ' + priceLabel + '를 선물받으면\n의상 선택 가능합니다.';
  onyuEl.outfitConfirmPrice.textContent = priceLabel;

  // 일반 시청자는 이미 게임 시작 전에 별풍선 후원 및 관리자 승인을 통과했다.
  // 따라서 이 단계에서는 후원 문구·확인 모달 없이 두 의상을 자유롭게 선택한다.
  // 스트리머 인증 유저는 기존 방송 후원 확인 UX를 그대로 유지한다.
  var isViewer = !!(window.onyuAuthState && window.onyuAuthState.role === 'viewer' && window.onyuAuthState.authenticated);
  onyuEl.outfitPaidCard.classList.toggle('is-paid', !isViewer);
  onyuEl.outfitPaidBadge.hidden = isViewer;
  onyuEl.outfitConfirmModal.hidden = isViewer;

  // 의상을 고르기 전까진 대사(이전 챕터의 마지막 줄이 아직 남아있는 상태)도,
  // 스탠딩 일러스트(고르기 전이라 아직 어떤 의상인지도 안 정해진 기본 스프라이트)도
  // 노출하지 않는다 — 선택 확정 후 onDone이 부르는 onyuRenderCurrentNode가 다시 채운다.
  onyuEl.dialogueLine.textContent = '';
  onyuEl.speakerTag.hidden = true;
  onyuEl.situation.textContent = '';
  onyuEl.spriteWrap.classList.add('is-hidden');

  // 설정의 "모션 줄이기"(engine.js onyuRunTransition·onyuSelectChoice와 동일 플래그)가
  // 켜져 있으면 이 픽커의 페이드도 전부 생략하고 즉시 반영한다 — 접근성 목적은 물론,
  // 자동 회귀 테스트에서 매 챕터마다 이 페이드를 기다릴 필요가 없어지는 부수 효과도 있다.
  var reduceMotion = window.ONYU_STATE.settings.reduceMotion;

  onyuEl.outfitPickerOverlay.hidden = false;
  if (reduceMotion) {
    onyuEl.outfitPickerOverlay.classList.add('is-active');
  } else {
    requestAnimationFrame(function () { onyuEl.outfitPickerOverlay.classList.add('is-active'); });
  }

  function finish(prefix) {
    onyuActiveOutfitPicker = null;
    window.ONYU_STATE.chosenOutfits[chapterId] = prefix;
    // 카드 선택이 확정되면 해당 의상의 6개 표정만 캐시에 데운다. 페이지
    // 진입 시에는 후보별 첫 이미지 존재 확인만 하므로 불필요한 사복 세트를
    // 전부 내려받지 않는다.
    if (typeof onyuPreloadSpriteSet === 'function') onyuPreloadSpriteSet(prefix);
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('outfit_selected', {
      chapterId: chapterId,
      outfitId: prefix === choice.paid ? 'paid' : 'free',
      accessMode: isViewer ? 'viewer' : 'streamer',
    });
    onyuEl.outfitPickerOverlay.classList.remove('is-active');
    if (reduceMotion) {
      onyuEl.outfitPickerOverlay.hidden = true;
      onDone();
    } else {
      setTimeout(function () {
        onyuEl.outfitPickerOverlay.hidden = true;
        onDone();
      }, 260);
    }
  }

  // 모바일 Safari/Chrome에서는 전환 오버레이가 막 사라지는 프레임에 발생한
  // touchend→click 합성 이벤트가 상위 #screen-play로 전달되거나 click 자체가
  // 지연될 수 있다. pointerup을 먼저 소비하고 한 번만 선택을 확정해 카드 터치를
  // 안정적으로 처리한다.
  var selecting = false;
  function choose(prefix, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (selecting) return;
    selecting = true;
    finish(prefix);
  }

  function closeConfirm() {
    onyuEl.outfitConfirmModal.classList.remove('is-active');
    if (reduceMotion) {
      onyuEl.outfitConfirmModal.hidden = true;
    } else {
      setTimeout(function () { onyuEl.outfitConfirmModal.hidden = true; }, 200);
    }
  }

  function handlePaidCard(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (selecting || promptOpen) return;
    if (isViewer) { selecting = true; finish(choice.paid); return; }
    promptOpen = true;
    onyuEl.outfitConfirmModal.hidden = false;
    if (reduceMotion) {
      onyuEl.outfitConfirmModal.classList.add('is-active');
    } else {
      requestAnimationFrame(function () { onyuEl.outfitConfirmModal.classList.add('is-active'); });
    }
  }
  var promptOpen = false;
  onyuActiveOutfitPicker = {
    choose: function (event) { choose(choice.free, event); },
    choosePaid: handlePaidCard,
  };
  onyuEl.outfitConfirmYes.onclick = function () { closeConfirm(); finish(choice.paid); };
  onyuEl.outfitConfirmNo.onclick = function () {
    if (typeof window.onyuTelemetryTrack === 'function') {
      window.onyuTelemetryTrack('outfit_selection_cancelled', { chapterId: chapterId, reason: 'payment_prompt' });
    }
    promptOpen = false;
    closeConfirm();
  };
}
