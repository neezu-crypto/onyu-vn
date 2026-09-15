/*
 * 사복 후보 2종(편한=무료 / 꾸민=후원) 중 스트리머가 방송 중 직접 고르는 선택 UI.
 * 시청자가 실제로 별풍선을 쐈는지는 코드가 알 방법이 없다(자동 후원 감지 없음) —
 * 스트리머가 스스로 판단해서 고르고, 꾸민 의상은 실수 클릭 방지용 확인 모달을
 * 한 번 더 거친다. game-data.js의 chapter.spriteSet(체육복 등 고정 세트)이 있는
 * 챕터나 ONYU_SPRITE_CANDIDATES(단일 세트, 예: CH27 졸업 가운)에는 관여하지 않는다.
 */

// { [chapterId]: { free, paid, price } } — 두 접두사 이미지가 assets/standing/에 실제로
// 있어야 픽커가 뜬다. 하나라도 없으면 조용히 기존 season 폴백으로 진행 — 이미지
// 파일만 두 프리픽스 다 넣으면 코드 수정 없이 바로 픽커가 활성화된다.
var ONYU_OUTFIT_CHOICES = {
  ch12: { free: 'C1-', paid: 'P1-', price: 50 },
  ch13: { free: 'C13-', paid: 'P13-', price: 50 },
  ch16: { free: 'C16-', paid: 'P16-', price: 50 },
  ch24: { free: 'C24-', paid: 'P24-', price: 50 },
};

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
  onyuEl.outfitPaidBadge.textContent = '⭐ ' + priceLabel;
  onyuEl.outfitConfirmPrice.textContent = priceLabel;

  // 의상을 고르기 전까진 대사(이전 챕터의 마지막 줄이 아직 남아있는 상태)도,
  // 스탠딩 일러스트(고르기 전이라 아직 어떤 의상인지도 안 정해진 기본 스프라이트)도
  // 노출하지 않는다 — 선택 확정 후 onDone이 부르는 onyuRenderCurrentNode가 다시 채운다.
  onyuEl.dialogueLine.textContent = '';
  onyuEl.speakerTag.hidden = true;
  onyuEl.situation.textContent = '';
  onyuEl.spriteWrap.classList.add('is-hidden');

  onyuEl.outfitPickerOverlay.hidden = false;
  requestAnimationFrame(function () { onyuEl.outfitPickerOverlay.classList.add('is-active'); });

  function finish(prefix) {
    window.ONYU_STATE.chosenOutfits[chapterId] = prefix;
    onyuEl.outfitPickerOverlay.classList.remove('is-active');
    setTimeout(function () {
      onyuEl.outfitPickerOverlay.hidden = true;
      onDone();
    }, 260);
  }

  function closeConfirm() {
    onyuEl.outfitConfirmModal.classList.remove('is-active');
    setTimeout(function () { onyuEl.outfitConfirmModal.hidden = true; }, 200);
  }

  onyuEl.outfitFreeCard.onclick = function () { finish(choice.free); };
  onyuEl.outfitPaidCard.onclick = function () {
    onyuEl.outfitConfirmModal.hidden = false;
    requestAnimationFrame(function () { onyuEl.outfitConfirmModal.classList.add('is-active'); });
  };
  onyuEl.outfitConfirmYes.onclick = function () { closeConfirm(); finish(choice.paid); };
  onyuEl.outfitConfirmNo.onclick = closeConfirm;
}
