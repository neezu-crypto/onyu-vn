/*
 * 온이유 게임 분석 이벤트 수집 클라이언트.
 *
 * 이 파일은 Firebase SDK를 직접 초기화하지 않는다. auth.js가 인증된
 * callable sender를 연결하기 전까지 이벤트를 짧게 메모리에 큐잉하고,
 * 연결 후 5초 단위로 묶어 전송한다. 이벤트 원문은 서버에서 허용 목록과
 * 크기를 다시 검증하므로 클라이언트 값은 통계 표시나 권한 판정에 사용하지 않는다.
 */
(function () {
  var SESSION_KEY = 'onyu_telemetry_session_v1';
  var MAX_QUEUE = 100;
  var BATCH_SIZE = 25;
  var queue = [];
  var sender = null;
  var flushTimer = null;
  var flushing = false;
  var sessionId = null;

  function randomId(prefix) {
    var random = (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    return prefix + '-' + random;
  }

  try {
    sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = randomId('s');
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
  } catch (e) {
    sessionId = randomId('s');
  }

  function cleanData(data) {
    var out = {};
    if (!data || typeof data !== 'object') return out;
    Object.keys(data).slice(0, 20).forEach(function (key) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) return;
      var value = data[key];
      if (typeof value === 'string') out[key] = value.slice(0, 120);
      else if (typeof value === 'number' && isFinite(value)) out[key] = value;
      else if (typeof value === 'boolean') out[key] = value;
    });
    return out;
  }

  function scheduleFlush() {
    if (flushTimer || !sender) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flush();
    }, 5000);
  }

  function flush() {
    if (flushing || !sender || !queue.length) return;
    flushing = true;
    var batch = queue.slice(0, BATCH_SIZE);
    Promise.resolve(sender(batch)).then(function () {
      queue.splice(0, batch.length);
    }).catch(function () {
      // 다음 이벤트나 pagehide 때 재시도한다. 실패 이벤트 자체는 저장하지 않는다.
    }).finally(function () {
      flushing = false;
      if (queue.length) scheduleFlush();
    });
  }

  window.onyuTelemetryTrack = function (eventName, data) {
    if (typeof eventName !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(eventName)) return;
    var event = cleanData(data);
    event.event = eventName;
    event.eventId = randomId('e');
    event.sessionId = sessionId;
    event.clientAt = Date.now();
    queue.push(event);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (queue.length >= BATCH_SIZE) flush();
    else scheduleFlush();
  };

  window.onyuTelemetrySetSender = function (nextSender) {
    sender = typeof nextSender === 'function' ? nextSender : null;
    if (sender && queue.length) flush();
  };

  window.onyuTelemetryFlush = flush;
  // 타이틀 진입은 인증 모듈보다 먼저 발생하므로 여기서 한 번만 기록한다.
  window.onyuTelemetryTrack('visit');
  document.addEventListener('DOMContentLoaded', function () { window.onyuTelemetryTrack('session_start'); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', function () {
    window.onyuTelemetryTrack('session_end');
    flush();
  });
})();
