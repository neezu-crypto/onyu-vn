/*
 * SOOP Refresh Token 만료 전에 서버 callable을 한 번 호출하는 브라우저 제어기.
 * 실제 OAuth/Chat SDK가 승인되어 활성화될 때만 만든다. Refresh Token은 브라우저에 전달하지 않는다.
 */
(function (global) {
  'use strict';

  var DEFAULT_REFRESH_LEAD_MS = 60 * 1000;
  var INITIAL_RETRY_MS = 15 * 1000;
  var MAX_RETRY_MS = 5 * 60 * 1000;

  function createOnyuSoopTokenRefreshController(options) {
    options = options || {};
    var refresh = options.refresh;
    var chatSdk = options.chatSdk;
    var applyAccessToken = options.applyAccessToken;
    var onState = typeof options.onState === 'function' ? options.onState : function () {};
    var setTimer = options.setTimeout || global.setTimeout.bind(global);
    var clearTimer = options.clearTimeout || global.clearTimeout.bind(global);
    var refreshLeadMs = Number.isFinite(options.refreshLeadMs) && options.refreshLeadMs >= 0
      ? options.refreshLeadMs : DEFAULT_REFRESH_LEAD_MS;
    var timer = null;
    var stopped = true;
    var refreshInFlight = false;
    var reconnectBlocked = false;
    var retryAttempt = 0;

    function clearScheduledRefresh() {
      if (timer !== null) clearTimer(timer);
      timer = null;
    }

    function schedule(delayMs) {
      clearScheduledRefresh();
      if (stopped || reconnectBlocked) return;
      timer = setTimer(function () {
        timer = null;
        return runRefresh();
      }, Math.max(0, Number(delayMs) || 0));
    }

    function scheduleForExpiry(expiresInSeconds) {
      var seconds = Number(expiresInSeconds);
      if (!Number.isSafeInteger(seconds) || seconds <= 0) {
        stopForAuthorizationError('invalid-expiry');
        return;
      }
      schedule(Math.max(0, seconds * 1000 - refreshLeadMs));
    }

    function disconnectChatSdk() {
      try {
        if (chatSdk && typeof chatSdk.disconnect === 'function') chatSdk.disconnect();
      } catch (_) { /* 재접속 차단 상태는 SDK 예외와 무관하게 유지한다. */ }
    }

    function stopForConfirmedRevocation() {
      stopped = true;
      reconnectBlocked = true;
      clearScheduledRefresh();
      disconnectChatSdk();
      onState({ state: 'revoked', reconnectAllowed: false });
    }

    function stopForAuthorizationError(reason) {
      stopped = true;
      reconnectBlocked = true;
      clearScheduledRefresh();
      disconnectChatSdk();
      onState({ state: 'authorization-error', reason: reason || 'unclassified', reconnectAllowed: false });
    }

    function retryLater() {
      retryAttempt += 1;
      var retryDelay = Math.min(INITIAL_RETRY_MS * Math.pow(2, retryAttempt - 1), MAX_RETRY_MS);
      onState({ state: 'retrying', retryAttempt: retryAttempt, retryInMs: retryDelay });
      schedule(retryDelay);
    }

    async function runRefresh() {
      if (stopped || reconnectBlocked || refreshInFlight) return;
      if (typeof refresh !== 'function') {
        stopForAuthorizationError('missing-refresh-handler');
        return;
      }
      refreshInFlight = true;
      onState({ state: 'refreshing' });
      try {
        var result = await refresh();
        if (stopped) return;
        if (result && result.revoked === true) {
          stopForConfirmedRevocation();
          return;
        }
        if (result && result.ok === false && result.retryable === true) {
          retryLater();
          return;
        }
        if (result && result.ok === true && result.refreshNeeded === false) {
          retryAttempt = 0;
          onState({ state: 'refresh-not-needed', expiresInSeconds: Number(result.expiresInSeconds) });
          scheduleForExpiry(Number(result.expiresInSeconds));
          return;
        }
        var expiresInSeconds = Number(result && result.expiresInSeconds);
        if (!result || result.ok !== true || !result.accessToken
            || !Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
          stopForAuthorizationError(result && result.reason || 'refresh-rejected');
          return;
        }
        if (typeof applyAccessToken !== 'function') {
          stopForAuthorizationError('missing-access-token-handler');
          return;
        }
        await applyAccessToken(result.accessToken);
        if (stopped) return;
        retryAttempt = 0;
        onState({ state: 'refreshed', expiresInSeconds: expiresInSeconds });
        scheduleForExpiry(expiresInSeconds);
      } catch (error) {
        if (stopped) return;
        if (error && error.revoked === true) {
          stopForConfirmedRevocation();
          return;
        }
        if (error && error.retryable === false) {
          stopForAuthorizationError(error.code || 'unclassified-auth-error');
          return;
        }
        retryLater();
      } finally {
        refreshInFlight = false;
      }
    }

    return Object.freeze({
      start: function (expiresInSeconds) {
        if (reconnectBlocked) return false;
        stopped = false;
        retryAttempt = 0;
        scheduleForExpiry(expiresInSeconds);
        return !stopped;
      },
      stop: function () {
        stopped = true;
        clearScheduledRefresh();
        disconnectChatSdk();
        onState({ state: 'stopped', reconnectAllowed: !reconnectBlocked });
      },
      isReconnectBlocked: function () { return reconnectBlocked; },
      isRunning: function () { return !stopped; },
    });
  }

  global.createOnyuSoopTokenRefreshController = createOnyuSoopTokenRefreshController;
})(window);
