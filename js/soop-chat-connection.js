/*
 * SOOP Chat SDK 연결 어댑터.
 * 서버가 실제 연동(active)을 확인해 준 인증 스트리머의 게임 탭에서만 쓴다.
 * - Access Token은 이 탭 메모리에만 두고 저장하지 않는다.
 * - 후원 이벤트는 BALLOON_GIFTED의 count·fromVod·relaysBroad만 의상 판정 게이트로 넘긴다.
 *   후원자 아이디·닉네임·이미지 주소는 넘기지도 보관하지도 않는다.
 * SDK API(new SOOP.ChatSDK(clientId), init, setAuth, connect, disconnect,
 * handleMessageReceived, handleChatClosed, handleError)는 SOOP Developers 문서 기준이다.
 */
(function (global) {
  'use strict';

  var SDK_URL = 'https://static.sooplive.com/build/chat-sdk/sooplive-chat-sdk.js';
  var sdkLoading = null;

  function loadSdk(doc) {
    if (global.SOOP && typeof global.SOOP.ChatSDK === 'function') return Promise.resolve(global.SOOP.ChatSDK);
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise(function (resolve, reject) {
      var script = doc.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = function () {
        if (global.SOOP && typeof global.SOOP.ChatSDK === 'function') resolve(global.SOOP.ChatSDK);
        else reject(new Error('SOOP Chat SDK를 불러오지 못했습니다.'));
      };
      script.onerror = function () { sdkLoading = null; reject(new Error('SOOP Chat SDK를 불러오지 못했습니다.')); };
      doc.head.appendChild(script);
    });
    return sdkLoading;
  }

  // 이벤트 원문에서 판정에 필요한 값만 꺼낸다(후원자 정보는 복사하지 않음).
  function summarizeBalloonEvent(action, message) {
    if (action !== 'BALLOON_GIFTED' || !message || typeof message !== 'object') return null;
    return { count: Number(message.count), fromVod: message.fromVod, relaysBroad: message.relaysBroad === true };
  }

  function createOnyuSoopChatConnection(options) {
    options = options || {};
    var ChatSDK = options.ChatSDK;
    var clientId = String(options.clientId || '');
    var onDonation = typeof options.onDonation === 'function' ? options.onDonation : function () {};
    var onState = typeof options.onState === 'function' ? options.onState : function () {};
    var sdk = null;
    var closedByUs = false;

    function disconnect() {
      closedByUs = true;
      var current = sdk;
      sdk = null;
      try { if (current && typeof current.disconnect === 'function') current.disconnect(); } catch (_) {}
    }

    return Object.freeze({
      connect: async function (accessToken) {
        if (typeof ChatSDK !== 'function' || !clientId || !accessToken) throw new Error('SOOP 연결 정보가 없습니다.');
        closedByUs = false;
        // Client Secret은 브라우저에 두지 않는다(토큰 교환·갱신은 서버가 한다).
        sdk = new ChatSDK(clientId);
        if (typeof sdk.init === 'function') sdk.init();
        sdk.handleMessageReceived(function (action, message) {
          var summary = summarizeBalloonEvent(action, message);
          if (summary) onDonation(summary);
        });
        if (typeof sdk.handleChatClosed === 'function') {
          sdk.handleChatClosed(function () { if (!closedByUs) onState({ state: 'closed' }); });
        }
        if (typeof sdk.handleError === 'function') {
          // 오류 메시지 원문은 화면·로그에 남기지 않고 코드만 전달한다.
          sdk.handleError(function (code) { onState({ state: 'error', code: String(code || '') }); });
        }
        sdk.setAuth(accessToken);
        await sdk.connect();
        onState({ state: 'connected' });
        return true;
      },
      // 갱신된 Access Token 적용. 문서상 setAuth는 connect 전에 설정하는 값이므로
      // 기존 연결은 그대로 두고 다음 재연결부터 새 토큰을 쓰게 한다.
      applyAccessToken: function (accessToken) {
        if (sdk && accessToken) sdk.setAuth(accessToken);
      },
      disconnect: disconnect,
      sdkForRefresh: { disconnect: disconnect },
    });
  }

  global.loadOnyuSoopChatSdk = function () { return loadSdk(global.document); };
  global.summarizeOnyuSoopBalloonEvent = summarizeBalloonEvent;
  global.createOnyuSoopChatConnection = createOnyuSoopChatConnection;
})(typeof window !== 'undefined' ? window : globalThis);
