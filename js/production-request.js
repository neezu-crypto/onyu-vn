/* 게임 제작 의뢰 안내 화면(2026-11-26 통합상점 이전).
 * 미연시 제작 신청은 통합상점 [게임 제작 의뢰](모금형)로 옮겼다. 이 화면은 안내와 이동 버튼만 둔다.
 * 진입: 연인 엔딩 버튼 · 설정 "게임 제작 의뢰". 이전 캐시 결제 신청(onyuVn/productionInquiries)은 관리센터에서 계속 처리한다. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { entry: 'title' };

  function open(entry) {
    state.entry = entry;
    if (entry === 'ending') {
      onyuEl.endingOverlay.classList.remove('is-active');
      onyuEl.endingOverlay.hidden = true;
    }
    $('production-inquiry-back-btn').textContent = entry === 'ending' ? '← 엔딩으로' : entry === 'settings' ? '← 설정으로' : '← 타이틀로';
    onyuShowScreen('production-inquiry');
    $('screen-production-inquiry').scrollTop = 0;
  }

  function goBack() {
    if (state.entry === 'ending') {
      onyuRunTransition({}, function () {
        onyuSwapScreen('play');
        onyuEl.endingOverlay.hidden = false;
        requestAnimationFrame(function () { onyuEl.endingOverlay.classList.add('is-active'); });
      });
    } else if (state.entry === 'settings') {
      onyuSwapScreen('settings');
    } else {
      goTitle();
    }
  }
  function goTitle() {
    if (state.entry === 'ending') { document.getElementById('ending-title-btn').click(); return; }
    onyuSwapScreen('title');
  }

  function init() {
    if (!$('screen-production-inquiry')) return;
    $('ending-production-inquiry-btn').addEventListener('click', function () {
      if (!window.ONYU_STATE || window.ONYU_STATE.lastEndingId !== 'lover') return;
      open('ending');
    });
    $('settings-production-request-btn').addEventListener('click', function () { open('settings'); });
    $('production-inquiry-back-btn').addEventListener('click', goBack);
    $('production-inquiry-title-btn').addEventListener('click', goTitle);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.onyuOpenProductionRequest = open;
})();
