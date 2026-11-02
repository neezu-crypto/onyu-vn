/*
 * SOOP 후원 이벤트 판정 게이트.
 * Chat SDK가 실제 연결된 뒤 이벤트 리스너는 이 게이트로만 이벤트를 전달한다.
 * 방송 연결과 토큰 발급은 SOOP Consent 승인 전까지 비활성 상태다.
 */
(function (global) {
  'use strict';

  function checkEvent(event) {
    if (!event || typeof event !== 'object') {
      return { accepted: false, reason: 'invalid-event' };
    }

    // LIVE 방송만 처리한다. 필드가 없거나 true인 이벤트는 안전하게 제외한다.
    if (event.fromVod !== false) {
      return { accepted: false, reason: 'not-live' };
    }

    var count = Number(event.count);
    if (!Number.isSafeInteger(count) || count < 1) {
      return { accepted: false, reason: 'invalid-count' };
    }
    if (count < 50) {
      return { accepted: false, reason: 'below-threshold', count: count };
    }

    // 후원자 ID·닉네임·프로필 등 원본 이벤트의 다른 필드는 반환하지 않는다.
    return { accepted: true, count: count };
  }

  function createOnyuDonationEventGate(onAccepted) {
    var closed = false;
    var consumed = false;
    var pending = false;

    return Object.freeze({
      handle: function (event) {
        if (closed) return { accepted: false, reason: 'session-closed' };
        if (consumed) return { accepted: false, reason: 'session-consumed' };
        if (pending) return { accepted: false, reason: 'event-pending' };

        var result = checkEvent(event);
        if (!result.accepted) return result;

        // 서버 처리가 끝날 때까지 후속 이벤트를 막고, 성공한 경우에만 세션을 소비한다.
        // 서버 응답이 실패하면 열린 세션에서 새 이벤트로 다시 시도할 수 있다.
        pending = true;
        var operation;
        try {
          operation = typeof onAccepted === 'function' ? onAccepted({ count: result.count }) : true;
        } catch (error) {
          pending = false;
          return { accepted: false, reason: 'processing-failed' };
        }

        if (operation && typeof operation.then === 'function') {
          return Promise.resolve(operation).then(function (accepted) {
            pending = false;
            if (accepted === false) return { accepted: false, reason: 'server-rejected' };
            consumed = true;
            return { accepted: true, count: result.count };
          }, function () {
            pending = false;
            return { accepted: false, reason: 'processing-failed' };
          });
        }

        pending = false;
        if (operation === false) return { accepted: false, reason: 'server-rejected' };
        consumed = true;
        return { accepted: true, count: result.count };
      },
      close: function () {
        closed = true;
      },
    });
  }

  global.createOnyuDonationEventGate = createOnyuDonationEventGate;
})(window);
