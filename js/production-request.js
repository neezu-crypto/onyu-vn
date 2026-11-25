/* 미연시 제작 신청 화면(2026-11-26 캐시 결제 방식).
 * 진입: 연인 엔딩 버튼 · 설정 "미연시 제작 신청". 로그인 안 됐으면 공용 로그인 모달을 띄우고 로그인 후 이어서 연다.
 * 서버: onyuSubmitStreamerProductionInquiry 하나(checkOnly로 잔액 확인 → 신청 시 견적 캐시 차감).
 * 견적 계산은 서버(onyuProductionRequest.js estimateFor)와 같아야 한다. */
(function () {
  'use strict';
  var STEP = 50000, MIN = 50000, MAX = 300000, KRW_PER_CASH = 100;
  var CONSENT_VERSION = 'v2-cash';
  var OPERATOR_SOOP_ID = 'skftodwocks2';
  var $ = function (id) { return document.getElementById(id); };
  var state = { entry: 'title', applicantType: '', balance: null, requestId: '', submitting: false, pendingAfterLogin: false, lastResult: null };

  function estimate(krw) {
    var steps = krw / STEP;
    return { krw: krw, cash: krw / KRW_PER_CASH, minutes: steps * 45, promo: krw >= 100000 ? steps * 100 - 100 : 0 };
  }
  function formatMinutes(m) {
    var h = Math.floor(m / 60), r = m % 60;
    return '약 ' + (h ? h + '시간' + (r ? ' ' + r + '분' : '') : r + '분');
  }
  function won(krw) { return (krw / 10000).toLocaleString('ko-KR') + '만 원'; }
  function cashText(n) { return Number(n || 0).toLocaleString('ko-KR') + '캐시'; }
  function newRequestId() {
    var bytes = new Uint8Array(15);
    crypto.getRandomValues(bytes);
    return 'pr_' + Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function funding() { return Number($('production-funding').value) || 100000; }

  function renderEstimate() {
    var e = estimate(funding());
    $('production-est-krw').textContent = won(e.krw);
    $('production-est-cash').textContent = cashText(e.cash);
    $('production-est-time').textContent = formatMinutes(e.minutes);
    $('production-est-promo').textContent = e.promo ? e.promo + '곳' : '없음';
    $('production-need').textContent = cashText(e.cash);
    $('production-est-next').textContent = e.krw >= MAX ? '최대 규모예요.'
      : e.krw < 100000 ? '5만 원 더하면 약 45분 길어지고 방송국 홍보 100곳이 생겨요.'
        : '5만 원 더하면 약 45분 길어지고 방송국 홍보 100곳이 늘어요.';
    $('production-funding-minus').disabled = e.krw <= MIN;
    $('production-funding-plus').disabled = e.krw >= MAX;
    renderBalance();
  }
  function renderBalance() {
    var need = estimate(funding()).cash;
    var el = $('production-balance');
    if (state.balance === null) { el.textContent = '확인 중…'; el.classList.remove('is-short'); return; }
    el.textContent = cashText(state.balance);
    el.classList.toggle('is-short', state.balance < need);
    $('production-charge-link').classList.toggle('is-strong', state.balance < need);
  }

  async function refreshEligibility() {
    state.balance = null;
    renderBalance();
    try {
      var data = await window.onyuSubmitStreamerProductionInquiry({ checkOnly: true });
      state.balance = Number(data.balanceCash) || 0;
      state.applicantType = data.applicantType;
      var isStreamer = data.applicantType === 'streamer';
      $('production-target-self').hidden = !isStreamer;
      $('production-target-search').hidden = isStreamer;
      if (isStreamer) {
        $('production-target-self').textContent = '본인 · ' + (data.self && data.self.nickname || '인증 스트리머') + (data.self && data.self.soopId ? ' (' + data.self.soopId + ')' : '');
      }
      renderBalance();
    } catch (error) {
      $('production-balance').textContent = '확인 실패';
      setStatus('캐시 잔액을 불러오지 못했어요: ' + (error && error.message || '잠시 후 다시 시도해 주세요.'));
    }
  }

  function setStatus(text) { $('streamer-production-inquiry-status').textContent = text || ''; }

  function resetForm() {
    state.requestId = newRequestId();
    state.submitting = false;
    $('production-form').hidden = false;
    $('production-done').hidden = true;
    $('production-funding').value = '100000';
    $('streamer-production-inquiry-details').value = '';
    ['production-consent-ai', 'production-consent-copyright', 'production-consent-cash'].forEach(function (id) { $(id).checked = false; });
    $('production-target-nickname').value = '';
    $('production-target-soopid').value = '';
    $('streamer-production-inquiry-submit').disabled = false;
    $('streamer-production-inquiry-submit').textContent = '캐시 결제하고 신청하기';
    $('production-target-self').hidden = true;
    $('production-target-search').hidden = true;
    setStatus('');
    renderEstimate();
  }

  function isLoggedIn() {
    var auth = window.onyuAuthState;
    return !!(auth && auth.role && auth.role !== 'anonymous');
  }

  function open(entry) {
    state.entry = entry;
    if (!isLoggedIn()) {
      state.pendingAfterLogin = true;
      if (typeof window.onyuOpenLoginModal === 'function') window.onyuOpenLoginModal();
      return;
    }
    resetForm();
    if (entry === 'ending') {
      onyuEl.endingOverlay.classList.remove('is-active');
      onyuEl.endingOverlay.hidden = true;
    }
    $('production-inquiry-back-btn').textContent = entry === 'ending' ? '← 엔딩으로' : entry === 'settings' ? '← 설정으로' : '← 타이틀로';
    onyuShowScreen('production-inquiry');
    refreshEligibility();
  }

  function goBack() {
    if (state.entry === 'ending' && $('production-done').hidden) {
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

  async function submit() {
    if (state.submitting) return;
    var description = $('streamer-production-inquiry-details').value.trim();
    var targetSoopId = $('production-target-soopid').value.trim().toLowerCase();
    var e = estimate(funding());
    if (state.applicantType !== 'streamer' && !/^[a-z0-9]{2,20}$/.test(targetSoopId)) {
      setStatus('제작 대상 스트리머를 검색해서 골라 주세요.');
      $('production-target-search').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!description) { setStatus('원하는 이야기와 제작 방향을 적어 주세요.'); $('streamer-production-inquiry-details').focus(); return; }
    if (!$('production-consent-ai').checked || !$('production-consent-copyright').checked || !$('production-consent-cash').checked) {
      setStatus('필수 동의 3개를 모두 체크해 주세요.');
      return;
    }
    if (state.balance !== null && state.balance < e.cash) {
      setStatus('캐시가 ' + cashText(e.cash - state.balance) + ' 부족해요. 통합상점에서 충전한 뒤 [잔액 새로고침]을 눌러 주세요.');
      return;
    }
    state.submitting = true;
    var button = $('streamer-production-inquiry-submit');
    button.disabled = true;
    button.textContent = '결제·접수 중…';
    setStatus('');
    try {
      var result = await window.onyuSubmitStreamerProductionInquiry({
        requestId: state.requestId,
        description: description,
        fundingKrw: e.krw,
        targetSoopId: targetSoopId,
        consentVersion: CONSENT_VERSION,
        consents: { avatarAi: true, copyright: true, cashPayment: true },
      });
      showDone(result);
    } catch (error) {
      state.submitting = false;
      button.disabled = false;
      button.textContent = '캐시 결제하고 신청하기';
      setStatus('신청하지 못했어요: ' + (error && error.message || '잠시 후 다시 시도해 주세요.'));
      if (error && /이미|겹쳤|환불/.test(error.message || '')) state.requestId = newRequestId();
      refreshEligibility();
    }
  }

  function showDone(result) {
    state.lastResult = result;
    $('production-form').hidden = true;
    $('production-done').hidden = false;
    var target = result.target || {};
    $('production-done-summary').textContent = (target.nickname || '') + ' · ' + won(result.fundingKrw) + ' · ' + formatMinutes(result.minutes) + ' · 방송국 홍보 ' + (result.promoSpots ? result.promoSpots + '곳' : '없음');
    $('production-done-code').textContent = result.shortCode;
    $('production-done-cash').textContent = cashText(result.paidCash) + ' 결제 · 남은 캐시 ' + cashText(result.remainingCash);
    var viewer = result.applicantType === 'viewer';
    $('production-done-viewer').hidden = !viewer;
    if (viewer) {
      $('production-done-target').textContent = target.nickname + '(' + target.soopId + ')';
      $('production-done-deadline').textContent = new Date(result.consentDeadlineAt).toLocaleDateString('ko-KR');
      $('production-done-message').textContent = '미연시 제작 신청 동의합니다. 신청 번호: ' + result.shortCode
        + ' (게임 캐릭터 제작 시 버추얼 아바타를 AI로 활용하는 것과, 아바타 저작권이 제 본인에게 있음을 확인합니다.)';
    }
    $('production-inquiry-back-btn').textContent = '← 타이틀로';
    state.entry = state.entry === 'settings' ? 'settings' : 'done';
    var inner = document.querySelector('.production-inner');
    if (inner) inner.scrollTop = 0;
  }

  function step(delta) {
    var next = Math.min(MAX, Math.max(MIN, funding() + delta));
    $('production-funding').value = String(next);
    renderEstimate();
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
    $('production-done-title-btn').addEventListener('click', goTitle);
    $('production-funding').addEventListener('input', renderEstimate);
    $('production-funding-minus').addEventListener('click', function () { step(-STEP); });
    $('production-funding-plus').addEventListener('click', function () { step(STEP); });
    $('production-balance-refresh').addEventListener('click', refreshEligibility);
    $('streamer-production-inquiry-submit').addEventListener('click', submit);
    $('production-copy-message').addEventListener('click', function () {
      var text = $('production-done-message').textContent;
      var button = this;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(function () { button.textContent = '복사했어요'; })
        .catch(function () { button.textContent = '문구를 길게 눌러 복사해 주세요'; });
    });
    // 로그인 모달에서 로그인을 마치면 하던 신청을 이어서 연다.
    document.addEventListener('onyu-auth-changed', function () {
      if (!state.pendingAfterLogin || !isLoggedIn()) return;
      state.pendingAfterLogin = false;
      open(state.entry);
    });
    // 충전하고 돌아오면 잔액을 다시 확인한다.
    document.addEventListener('visibilitychange', function () {
      var screen = document.querySelector('.screen.is-active');
      if (!document.hidden && screen && screen.id === 'screen-production-inquiry' && !$('production-form').hidden) refreshEligibility();
    });
    renderEstimate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.onyuOpenProductionRequest = open;
  window.ONYU_PRODUCTION_OPERATOR = OPERATOR_SOOP_ID;
})();
