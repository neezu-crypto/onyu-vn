/*
 * onyu-vn 인증·접근 권한.
 *
 * 익명 Firebase 세션은 공개 데이터 조회와 스트리머 인증 신청에 사용하고,
 * Google/Kakao 계정과 인증 스트리머는 무료로 플레이할 수 있다. 최종 접근 판정은
 * admin-center의 onyu 전용 callable에서 처리하고, 익명 미인증 게스트는 로그인 UI로 안내한다.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInAnonymously, signInWithPopup,
  signInWithCustomToken, signOut, linkWithPopup, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js';
import { createSeriesLogin } from './series-login.js?v=20261128-kit4';

const firebaseConfig = {
  apiKey: 'AIzaSyAZcjQPHphENs-Bb7IfdL2qTtOMhJrRP54',
  authDomain: 'soop-stock-market.firebaseapp.com',
  databaseURL: 'https://soop-stock-market-default-rtdb.firebaseio.com',
  projectId: 'soop-stock-market',
  storageBucket: 'soop-stock-market.firebasestorage.app',
  messagingSenderId: '997788925900',
  // Auth 세션 공유에는 apiKey/authDomain/projectId가 사용된다. appId는 이 페이지의
  // 별도 분석 식별자가 없으므로 자매 앱의 등록값을 재사용한다.
  appId: '1:997788925900:web:cb613d438efec019a3a769',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const functions = getFunctions(app, 'us-central1');
const requestStreamerVerificationFn = httpsCallable(functions, 'requestStreamerVerification');
// 게임별 서버 함수 이름은 js/game-config.js의 ONYU_SERVER_FUNCTIONS(엔진 분리 1단계).
const SERVER_FUNCTIONS = window.ONYU_SERVER_FUNCTIONS;
const getViewerAccessFn = httpsCallable(functions, SERVER_FUNCTIONS.getViewerAccess);
const startSessionFn = httpsCallable(functions, SERVER_FUNCTIONS.startSession);
const submitPlayerReviewFn = httpsCallable(functions, SERVER_FUNCTIONS.submitPlayerReview);
const submitStreamerProductionInquiryFn = httpsCallable(functions, SERVER_FUNCTIONS.submitStreamerProductionInquiry);
const listPublicPlayerReviewsFn = httpsCallable(functions, SERVER_FUNCTIONS.listPublicPlayerReviews);
const trackEventsFn = httpsCallable(functions, SERVER_FUNCTIONS.trackEvents);
const logVerifiedOnyuStreamerVisitFn = httpsCallable(functions, SERVER_FUNCTIONS.logVerifiedOnyuStreamerVisit);
const getDonationIntegrationStatusFn = httpsCallable(functions, SERVER_FUNCTIONS.getDonationIntegrationStatus);
const refreshSoopChatTokenFn = httpsCallable(functions, SERVER_FUNCTIONS.refreshSoopChatToken);
const setDonationIntegrationPreparationFn = httpsCallable(functions, SERVER_FUNCTIONS.setDonationIntegrationPreparation);
const registerOutfitDonationSessionFn = httpsCallable(functions, SERVER_FUNCTIONS.registerOutfitDonationSession);
const consumeOutfitDonationSessionFn = httpsCallable(functions, SERVER_FUNCTIONS.consumeOutfitDonationSession);
const closeOutfitDonationSessionFn = httpsCallable(functions, SERVER_FUNCTIONS.closeOutfitDonationSession);
const startSoopChatConsentFn = httpsCallable(functions, SERVER_FUNCTIONS.startSoopChatConsent);
const logDonationDiagnosticsFn = httpsCallable(functions, SERVER_FUNCTIONS.logDonationDiagnostics);

// 후원 연동 점검 로그(2026-11-26): 실제 후원 테스트 중 이 탭에서 일어난 연동 단계를 서버에 남겨
// 관리자센터에서 바로 볼 수 있게 한다. 인증 스트리머 탭에서만, 3초 모아 한 번에 보낸다.
// 시청자 아이디·닉네임·채팅 원문·토큰은 넣지 않는다(후원은 개수·LIVE 여부만).
// 2026-11-27 끔: 실제 후원 테스트가 끝나 서버 기록을 멈춘다. 다시 점검할 때만 true로 바꾼다(호출 코드는 그대로 둠).
const ONYU_DIAG_ENABLED = false;
const onyuDiagQueue = [];
let onyuDiagTimer = null;
function onyuDiag(event, detail) {
  if (!ONYU_DIAG_ENABLED) return;
  const s = window.onyuAuthState || {};
  if (s.role !== 'streamer') return;
  onyuDiagQueue.push({ event, at: Date.now(), detail: detail || {} });
  if (onyuDiagQueue.length > 40) onyuDiagQueue.splice(0, onyuDiagQueue.length - 40);
  if (!onyuDiagTimer) onyuDiagTimer = setTimeout(flushOnyuDiag, 3000);
}
function flushOnyuDiag() {
  onyuDiagTimer = null;
  if (!onyuDiagQueue.length) return;
  const entries = onyuDiagQueue.splice(0, 20);
  logDonationDiagnosticsFn({ entries }).catch(() => {});
  if (onyuDiagQueue.length) onyuDiagTimer = setTimeout(flushOnyuDiag, 3000);
}
function onyuDiagError(error) {
  return { errorCode: String(error && error.code || ''), error: String(error && error.message || error || '').slice(0, 150) };
}
window.onyuDonationDiag = onyuDiag;
const ONYU_SOOP_NONCE_KEY = 'onyuSoopOauthNonce';
let soopChatConnection = null;
let soopTokenRefreshController = null;

window.onyuGetDonationIntegrationStatus = async function () {
  const data = (await getDonationIntegrationStatusFn()).data || {};
  window.onyuAuthState.donationIntegrationStatus = String(data.status || 'not-prepared');
  window.onyuAuthState.donationSdkApproved = data.sdkApproved === true;
  window.onyuAuthState.donationSdkAvailable = data.sdkAvailable === true;
  window.onyuAuthState.donationClientId = data.clientId ? String(data.clientId) : '';
  return data;
};
window.startOnyuSoopTokenRefresh = function (chatSdk, expiresInSeconds, applyAccessToken, onState) {
  if (typeof window.createOnyuSoopTokenRefreshController !== 'function') {
    throw new Error('SOOP 토큰 갱신 제어기를 불러오지 못했습니다.');
  }
  if (window.onyuAuthState.donationIntegrationStatus !== 'active' || window.onyuAuthState.donationSdkApproved !== true) {
    throw new Error('SOOP 심사 승인과 활성 연동이 확인되지 않았습니다.');
  }
  if (soopTokenRefreshController) soopTokenRefreshController.stop();
  soopTokenRefreshController = window.createOnyuSoopTokenRefreshController({
    chatSdk,
    applyAccessToken,
    onState,
    refresh: async function () {
      try {
        return (await refreshSoopChatTokenFn({})).data || {};
      } catch (error) {
        const code = String(error && error.code || '');
        if (/functions\/(unavailable|deadline-exceeded|resource-exhausted)$/.test(code) || !code) throw error;
        return { ok: false, retryable: false, reason: code || 'unclassified-auth-error' };
      }
    },
  });
  if (!soopTokenRefreshController.start(expiresInSeconds)) {
    soopTokenRefreshController = null;
    throw new Error('SOOP 토큰 만료 시간이 올바르지 않습니다.');
  }
  return soopTokenRefreshController;
};
window.stopOnyuSoopTokenRefresh = function () {
  if (soopTokenRefreshController) soopTokenRefreshController.stop();
  soopTokenRefreshController = null;
};
// SOOP 동의 화면을 적당한 크기의 팝업으로 연다(팝업 차단 시 지금 탭에서 이동).
// 1회용 nonce는 동의를 진행하는 창의 sessionStorage에만 두고 콜백에서 지운다.
// 팝업은 클릭 직후 같은 출처의 빈 창으로 먼저 열어야 차단되지 않고, 그 창의 sessionStorage에 값을 넣을 수 있다.
const ONYU_SOOP_POPUP_KEY = 'onyuSoopOauthPopup';
const ONYU_SOOP_CHANNEL = 'onyu-soop-consent';
function openOnyuSoopConsentPopup() {
  const width = 520;
  const height = 760;
  const left = Math.max(0, Math.round((window.screenX || 0) + ((window.outerWidth || width) - width) / 2));
  const top = Math.max(0, Math.round((window.screenY || 0) + ((window.outerHeight || height) - height) / 2));
  try {
    return window.open('about:blank', 'onyuSoopConsent', `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
  } catch (_) {
    return null;
  }
}
window.onyuStartSoopChatConsent = async function () {
  const popup = openOnyuSoopConsentPopup();
  let data;
  try {
    data = (await startSoopChatConsentFn()).data || {};
    if (!data.authorizeUrl || !data.nonce) throw new Error('SOOP 연결을 시작하지 못했습니다.');
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
  if (popup && !popup.closed) {
    try {
      popup.sessionStorage.setItem(ONYU_SOOP_NONCE_KEY, String(data.nonce));
      popup.sessionStorage.setItem(ONYU_SOOP_POPUP_KEY, '1');
      popup.location.replace(String(data.authorizeUrl));
      onyuDiag('consent-open', { popup: true });
      return { popup: true };
    } catch (_) {
      popup.close();
    }
  }
  sessionStorage.setItem(ONYU_SOOP_NONCE_KEY, String(data.nonce));
  onyuDiag('consent-open', { popup: false });
  flushOnyuDiag();
  window.location.assign(String(data.authorizeUrl));
  return { popup: false };
};
// 팝업의 콜백 페이지가 연결을 마치면 알려 준다. 받으면 연동 상태를 다시 읽어 버튼·채팅 연결을 갱신한다.
if (typeof BroadcastChannel === 'function') {
  const soopConsentChannel = new BroadcastChannel(ONYU_SOOP_CHANNEL);
  soopConsentChannel.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'connected') return;
    onyuDiag('consent-connected');
    refreshDonationIntegrationControl();
  });
}

function disconnectOnyuSoopChat() {
  window.stopOnyuSoopTokenRefresh();
  if (soopChatConnection) soopChatConnection.disconnect();
  soopChatConnection = null;
}

// 실제 연동(active)인 인증 스트리머 탭에서만 Chat SDK에 붙는다. Access Token은 메모리에만 둔다.
async function connectOnyuSoopChat() {
  const s = window.onyuAuthState;
  if (soopChatConnection || s.role !== 'streamer' || s.donationIntegrationStatus !== 'active' || s.donationSdkApproved !== true || !s.donationClientId) return false;
  if (typeof window.createOnyuSoopChatConnection !== 'function') return false;
  onyuDiag('chat-connect-start');
  const tokens = (await refreshSoopChatTokenFn({ reconnect: true })).data || {};
  if (!tokens.ok || !tokens.accessToken) {
    onyuDiag('chat-token-missing', { reason: String(tokens.reason || tokens.status || '') });
    await refreshDonationIntegrationControl();
    return false;
  }
  const ChatSDK = await window.loadOnyuSoopChatSdk();
  const connection = window.createOnyuSoopChatConnection({
    ChatSDK,
    clientId: s.donationClientId,
    // 열린 의상 선택 화면이 있을 때만 outfit-picker가 이 처리기를 등록한다.
    onDonation: (summary) => {
      const pickerOpen = typeof window.onyuHandleSoopDonationEvent === 'function';
      onyuDiag('donation-received', { count: Number(summary.count) || 0, live: summary.fromVod === false, relay: summary.relaysBroad === true, pickerOpen });
      if (pickerOpen) window.onyuHandleSoopDonationEvent(summary);
    },
    onState: (state) => { s.donationChatState = state.state; onyuDiag('chat-state', { state: String(state.state || ''), errorCode: String(state.code || '') }); },
  });
  soopChatConnection = connection;
  try {
    await connection.connect(tokens.accessToken);
    onyuDiag('chat-connected');
    window.startOnyuSoopTokenRefresh(connection.sdkForRefresh, Number(tokens.expiresInSeconds), connection.applyAccessToken, (state) => {
      onyuDiag('token-refresh', { state: String(state.state || ''), reason: String(state.reason || '') });
      if (state.reconnectAllowed === false) { soopChatConnection = null; refreshDonationIntegrationControl(); }
    });
  } catch (error) {
    onyuDiag('chat-connect-failed', onyuDiagError(error));
    disconnectOnyuSoopChat();
    throw error;
  }
  return true;
}
window.onyuConnectSoopChat = connectOnyuSoopChat;
window.addEventListener('pagehide', disconnectOnyuSoopChat);

window.onyuSetDonationIntegrationPreparation = async function (enabled) {
  const data = (await setDonationIntegrationPreparationFn({ enabled: enabled === true })).data || {};
  return data;
};

window.onyuSubmitPlayerReview = async function (payload) {
  const result = await submitPlayerReviewFn(payload || {});
  return result.data || {};
};

window.onyuSubmitStreamerProductionInquiry = async function (payload) {
  const result = await submitStreamerProductionInquiryFn(payload || {});
  return result.data || {};
};

window.onyuRequestStreamerVerification = async function (payload) {
  const result = await requestStreamerVerificationFn(Object.assign({}, payload || {}, { source: 'onyu-vn' }));
  return result.data || {};
};
window.onyuRegisterOutfitDonationSession = async function (payload) {
  onyuDiag('picker-session-open', { chapter: String(payload && payload.chapterId || '') });
  try {
    const data = (await registerOutfitDonationSessionFn(payload || {})).data || {};
    onyuDiag('picker-session-ready', { ok: !!data.sessionId });
    return data;
  } catch (error) { onyuDiag('picker-session-failed', onyuDiagError(error)); throw error; }
};
window.onyuConsumeOutfitDonationSession = async function (payload) {
  try {
    const data = (await consumeOutfitDonationSessionFn(payload || {})).data || {};
    onyuDiag('outfit-donation-result', { count: Number(payload && payload.count) || 0, accepted: data.accepted === true, reason: String(data.reason || '') });
    return data;
  } catch (error) { onyuDiag('outfit-donation-failed', onyuDiagError(error)); throw error; }
};
window.onyuCloseOutfitDonationSession = async function (sessionId) {
  onyuDiag('picker-session-close');
  return (await closeOutfitDonationSessionFn({ sessionId })).data || {};
};

window.onyuListPublicPlayerReviews = async function (payload) {
  const user = auth.currentUser;
  if (!user) throw new Error('익명 로그인을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.');
  const result = await listPublicPlayerReviewsFn(payload || {});
  return result.data || { reviews: [], hasMore: false, nextCursor: null };
};

const KAKAO_JS_KEY = 'ed4f01d6903ca41d5dc0ab32b6ae143c';
const ADMIN_MODE_STORAGE_KEY = 'onyuVn.adminMode';
const ADMIN_ACCESS_MODES = ['viewer', 'streamer', 'admin'];
const ADMIN_ACCESS_MODE_LABELS = {
  admin: '관리자 모드',
  streamer: '스트리머 모드',
  viewer: '일반 로그인 유저',
};
const FREE_ACCESS_NOTICE = 'Google 또는 Kakao 로그인, 혹은 스트리머 인증을 완료하면 온이유 게임을 무료로 이용할 수 있습니다.';
let pendingGameStartAuthorization = false;

window.onyuAuthState = {
  user: null,
  realUser: null,
  role: 'anonymous',
  donationIntegrationStatus: 'not-prepared',
  donationSdkApproved: false,
  accessStatus: 'none',
  authenticated: false,
  canStartGame: false,
  loginMethod: null,
  isAdmin: false,
  adminMode: false,
  accessMode: 'viewer',
  donationSdkApproved: false,
};
window.onyuAuth = auth;
window.onyuDb = db;

// telemetry.js가 먼저 만든 큐를 인증된 callable에 연결한다. 전송 함수는
// 이벤트 원문을 그대로 신뢰하지 않고 admin-center 함수에서 허용 목록·uid·역할을
// 다시 검증한다.
if (typeof window.onyuTelemetrySetSender === 'function') {
  window.onyuTelemetrySetSender(function (events) {
    return trackEventsFn({ events: events }).then(function (result) {
      return result.data || {};
    });
  });
}

let readyResolve;
let readyResolved = false;
window.onyuAuthReady = new Promise((resolve) => { readyResolve = resolve; });

const confirmOverlay = document.getElementById('onyu-confirm-overlay');
const authStatusEl = document.getElementById('onyu-auth-status');
const authBtn = document.getElementById('onyu-auth-btn');
const adminModeSectionTitle = document.getElementById('onyu-admin-section-title');
const adminModeRow = document.getElementById('onyu-admin-mode-row');
const adminModeToggle = document.getElementById('onyu-admin-mode-toggle');
const adminModeStateEl = document.getElementById('onyu-admin-mode-state');
const donationIntegrationRowEl = document.getElementById('onyu-donation-integration-row');
const donationIntegrationStateEl = document.getElementById('onyu-donation-integration-state');
const donationIntegrationDescriptionEl = document.getElementById('onyu-donation-integration-description');
const donationIntegrationToggleEl = document.getElementById('onyu-donation-integration-toggle');
const donationIntegrationConnectEl = document.getElementById('onyu-donation-integration-connect');
let streamerVerifiedUnsubscribe = null;
let switchApprovalUnsubscribe = null;
let switchHandoffInProgress = false;

async function handleOnyuStreamerSwitchApproval(uid, requestId) {
  if (!requestId || switchHandoffInProgress || auth.currentUser?.uid !== uid) return;
  const lockKey = 'soop.streamerVerificationSwitch.' + requestId;
  try {
    const lastAttemptAt = Number(localStorage.getItem(lockKey) || 0);
    if (lastAttemptAt && Date.now() - lastAttemptAt < 20000) return;
    localStorage.setItem(lockKey, String(Date.now()));
  } catch (_) { /* Private browsing may disable localStorage. */ }
  switchHandoffInProgress = true;
  try {
    const result = await requestStreamerVerificationFn({ checkOnly: true, switchRequestId: requestId, source: 'onyu-vn' });
    if (result.data?.action !== 'switch' || auth.currentUser?.uid !== uid) {
      try { localStorage.removeItem(lockKey); } catch (_) {}
      switchHandoffInProgress = false;
      return;
    }
    await signInWithCustomToken(auth, result.data.customToken);
    window.location.reload();
  } catch (error) {
    try { localStorage.removeItem(lockKey); } catch (_) {}
    switchHandoffInProgress = false;
    console.error('승인된 스트리머 계정 자동 전환 실패:', error);
  }
}

function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }
function closeAll() { hide(confirmOverlay); seriesLogin.close(); }

function confirmAuthSwitch(message) {
  return new Promise((resolve) => {
    const messageEl = document.getElementById('onyu-confirm-message');
    const yesBtn = document.getElementById('onyu-confirm-yes');
    const noBtn = document.getElementById('onyu-confirm-no');
    if (!confirmOverlay || !messageEl || !yesBtn || !noBtn) { resolve(false); return; }
    messageEl.textContent = message;
    confirmOverlay.hidden = false;
    const cleanup = (result) => {
      confirmOverlay.hidden = true;
      yesBtn.onclick = null;
      noBtn.onclick = null;
      resolve(result);
    };
    yesBtn.onclick = () => cleanup(true);
    noBtn.onclick = () => cleanup(false);
  });
}

function dispatchAuthChanged() {
  document.dispatchEvent(new CustomEvent('onyu-auth-changed', { detail: Object.assign({}, window.onyuAuthState) }));
}

function getStoredAdminAccessMode() {
  try {
    const stored = localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
    if (stored === '1') return 'admin'; // 이전 boolean 저장값 호환
    return ADMIN_ACCESS_MODES.includes(stored) ? stored : 'viewer';
  } catch (e) { return 'viewer'; }
}

function setStoredAdminAccessMode(mode) {
  try {
    if (ADMIN_ACCESS_MODES.includes(mode)) localStorage.setItem(ADMIN_MODE_STORAGE_KEY, mode);
    else localStorage.removeItem(ADMIN_MODE_STORAGE_KEY);
  } catch (e) { console.warn('관리자 모드 설정 저장 실패:', e); }
}

function updateAdminModeControl() {
  const s = window.onyuAuthState;
  const visible = !!s.isAdmin;
  const mode = visible && ADMIN_ACCESS_MODES.includes(s.accessMode) ? s.accessMode : 'viewer';
  if (adminModeSectionTitle) adminModeSectionTitle.hidden = !visible;
  if (adminModeRow) adminModeRow.hidden = !visible;
  if (adminModeToggle) {
    adminModeToggle.classList.toggle('is-on', visible && mode === 'admin');
    adminModeToggle.classList.toggle('is-streamer', visible && mode === 'streamer');
    adminModeToggle.setAttribute('aria-pressed', String(visible && mode !== 'viewer'));
    adminModeToggle.setAttribute('aria-label', '현재 ' + ADMIN_ACCESS_MODE_LABELS[mode] + ' · 클릭하여 권한 전환');
  }
  if (adminModeStateEl) adminModeStateEl.textContent = ADMIN_ACCESS_MODE_LABELS[mode];
}

function updateAuthBar() {
  const s = window.onyuAuthState;
  if (!s.user) {
    authStatusEl.textContent = '로그인 준비 중...';
    authBtn.textContent = '로그인';
  } else if (s.isAdmin && s.accessMode === 'admin') {
    authStatusEl.textContent = '관리자 모드';
    authBtn.textContent = '계정';
  } else if (s.role === 'streamer') {
    authStatusEl.textContent = '스트리머 인증 완료';
    authBtn.textContent = '계정';
  } else if (s.authenticated) {
    const method = s.loginMethod === 'kakao' ? 'Kakao' : 'Google';
    authStatusEl.textContent = method + ' 로그인';
    authBtn.textContent = '계정';
  } else {
    authStatusEl.textContent = '게스트';
    authBtn.textContent = '로그인';
  }
}

async function refreshAccessState() {
  const user = auth.currentUser;
  if (!user) {
    window.onyuAuthState.role = 'anonymous';
    window.onyuAuthState.authenticated = false;
    window.onyuAuthState.accessStatus = 'none';
    window.onyuAuthState.canStartGame = false;
    window.onyuAuthState.loginMethod = null;
    window.onyuAuthState.isAdmin = false;
    window.onyuAuthState.adminMode = false;
    window.onyuAuthState.accessMode = 'viewer';
    window.onyuAuthState.donationSdkApproved = false;
    updateAuthBar();
    updateAdminModeControl();
    dispatchAuthChanged();
    return;
  }
  try {
    const requestedMode = getStoredAdminAccessMode();
    const result = await getViewerAccessFn({ accessMode: requestedMode });
    const data = result.data || {};
    const accessMode = ADMIN_ACCESS_MODES.includes(data.accessMode)
      ? data.accessMode
      : data.adminMode ? 'admin' : data.role === 'streamer' ? 'streamer' : 'viewer';
    Object.assign(window.onyuAuthState, {
      role: data.role || (user.isAnonymous ? 'anonymous' : 'viewer'),
      accessStatus: data.accessStatus || 'none',
      authenticated: !!data.authenticated,
      canStartGame: !!data.canStartGame,
      loginMethod: data.loginMethod || null,
      isAdmin: !!data.isAdmin,
      adminMode: accessMode === 'admin',
      accessMode,
    });
  } catch (e) {
    // 함수가 일시적으로 지연돼도 인증 UI와 게임 자체가 죽지 않도록 보수적인 기본값을 쓴다.
    Object.assign(window.onyuAuthState, {
      role: user.isAnonymous ? 'anonymous' : 'viewer',
      accessStatus: 'none',
      authenticated: !user.isAnonymous,
      canStartGame: false,
      loginMethod: user.isAnonymous ? null : 'google',
      // 관리자 여부는 관리자센터 서버 응답으로만 결정한다. 조회 실패 시 관리자 권한을 추측하지 않는다.
      isAdmin: false,
      adminMode: false,
      accessMode: 'viewer',
      donationSdkApproved: false,
    });
    console.error('온 이유 접근 상태 조회 실패:', e);
  }
  updateAuthBar();
  updateAdminModeControl();
  await refreshDonationIntegrationControl();
  dispatchAuthChanged();
}

async function refreshDonationIntegrationControl() {
  if (!donationIntegrationRowEl) return;
  if (window.onyuAuthState.role !== 'streamer') { window.onyuAuthState.donationSdkApproved = false; donationIntegrationRowEl.hidden = true; return; }
  donationIntegrationRowEl.hidden = false; donationIntegrationToggleEl.disabled = true;
  try {
    const data = await window.onyuGetDonationIntegrationStatus();
    onyuDiag('integration-status', { status: String(data.status || ''), sdkAvailable: data.sdkAvailable === true, sdkApproved: data.sdkApproved === true });
    const prepared = data.status === 'preparing';
    const active = data.status === 'active' && window.onyuAuthState.donationSdkApproved === true;
    const expiryText = data.expiresAt ? new Date(data.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '24시간 이내';
    if (active) {
      donationIntegrationStateEl.textContent = 'SOOP 방송 연결됨';
      donationIntegrationDescriptionEl.textContent = `연동 만료: ${expiryText}. 만료·해제 때 서버의 SOOP 토큰을 삭제합니다. 의상 선택 화면이 열려 있을 때 한 번에 별풍선 50개 이상(LIVE)이 오면 꾸민 의상을 확정합니다.`;
    } else if (prepared) {
      donationIntegrationStateEl.textContent = window.onyuAuthState.donationSdkAvailable ? 'SOOP 연결 전' : '준비 동의됨';
      donationIntegrationDescriptionEl.textContent = window.onyuAuthState.donationSdkAvailable
        ? `준비 동의 만료: ${expiryText}. 'SOOP 방송 연결'을 누르면 SOOP 동의 화면으로 이동합니다. 연결해야 후원 감지가 시작됩니다.`
        : `준비 동의 만료: ${expiryText}. 만료 후 서버에서 삭제됩니다. SOOP 방송 연결이 열리기 전에는 후원 감지·토큰 저장·자동 선택을 실행하지 않습니다.`;
    } else {
      donationIntegrationStateEl.textContent = data.status === 'reauthorization-required' ? '다시 연결 필요' : '준비 전';
      donationIntegrationDescriptionEl.textContent = '새 게임·이어하기·챕터 불러오기 전에 필수 준비 동의를 받습니다. 동의하지 않거나 기록 저장에 실패하면 게임에 진입할 수 없습니다. 실제 방송 연결은 SOOP 동의 화면에서 별도로 동의합니다.';
    }
    if (donationIntegrationConnectEl) {
      donationIntegrationConnectEl.hidden = !(prepared && window.onyuAuthState.donationSdkAvailable);
      donationIntegrationConnectEl.disabled = false;
    }
    const revocable = prepared || active || data.status === 'reauthorization-required';
    donationIntegrationToggleEl.textContent = active ? '방송 연결 해제' : '준비 동의 철회'; donationIntegrationToggleEl.hidden = !revocable; donationIntegrationToggleEl.dataset.prepared = revocable ? 'true' : 'false'; donationIntegrationToggleEl.disabled = false;
    if (active) connectOnyuSoopChat().catch((error) => {
      // SOOP Chat SDK는 방송 중에만 접속된다(꺼져 있으면 invalid-chat-info / 104 "진행중인 방송이 없습니다").
      const offline = error && (error.code === 'invalid-chat-info' || /\(104\)|진행중인 방송이 없/.test(String(error.message || '')));
      onyuDiag(offline ? 'chat-offline' : 'chat-error', onyuDiagError(error));
      donationIntegrationStateEl.textContent = offline ? '방송 대기 중' : 'SOOP 연결 실패(다시 열면 재시도)';
      if (offline) donationIntegrationDescriptionEl.textContent = `${expiryText ? `연동 만료: ${expiryText}. ` : ''}지금은 방송 중이 아니에요. 방송을 켠 뒤 게임을 다시 열면 채팅에 연결되고 후원 감지가 시작돼요.`;
    });
    else disconnectOnyuSoopChat();
  } catch (_) {
    window.onyuAuthState.donationSdkApproved = false;
    donationIntegrationDescriptionEl.textContent = '연동 준비 상태를 확인하지 못했습니다.';
    donationIntegrationToggleEl.hidden = true;
    donationIntegrationToggleEl.disabled = false;
  }
}

async function toggleDonationIntegrationPreparation() {
  const prepared = donationIntegrationToggleEl.dataset.prepared === 'true';
  if (!prepared || !window.confirm('방송 후원 연동을 해제하고 저장된 연동 정보와 SOOP 토큰을 즉시 삭제할까요?')) return;
  donationIntegrationToggleEl.disabled = true;
  disconnectOnyuSoopChat();
  try { await window.onyuSetDonationIntegrationPreparation(false); await refreshDonationIntegrationControl(); }
  catch (error) { window.alert(error && error.message ? error.message : '연동 준비 상태를 변경하지 못했습니다.'); await refreshDonationIntegrationControl(); }
}

window.onyuRefreshDonationIntegrationControl = refreshDonationIntegrationControl;

async function toggleAdminMode() {
  const s = window.onyuAuthState;
  if (!s.isAdmin) return false;
  const currentIndex = ADMIN_ACCESS_MODES.indexOf(s.accessMode);
  const nextMode = ADMIN_ACCESS_MODES[(currentIndex + 1) % ADMIN_ACCESS_MODES.length];
  setStoredAdminAccessMode(nextMode);
  await refreshAccessState();
  return window.onyuAuthState.accessMode;
}

// 로그인 창은 시리즈 공통 부품(series-kit login-modal, 2026-11-28): Google·카카오·스트리머 인증(신청/확인).
// 이미 보호된 다른 계정이면 창 안에서 확인 후 전환·새로고침, 같은 계정 연결·인증은 접근 권한만 다시 확인한다.
const seriesLogin = createSeriesLogin({
  auth, functions, source: 'onyu-vn',
  soopSearchScript: './js/soop-verify-search.js?v=20261118-svs1',
  title: '계정을 보호해 주세요',
  intro: 'Google·카카오 계정이나 스트리머 인증으로 로그인하면 무료로 플레이할 수 있어요.',
  reloadAfterSwitch: true,
  onChange: async () => {
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('login_success', { provider: 'series' });
    await refreshAccessState();
  },
});
function openLoginModal(options) { hide(confirmOverlay); seriesLogin.open(options || {}); }
function openStreamerModal() { openLoginModal({ streamer: true }); }

const STREAMER_DONATION_PENDING_NOTICE = 'SOOP 후원 연동을 준비 중입니다.\n스트리머 계정 플레이는 후원 연동이 열린 뒤 이용할 수 있어요. 조금만 기다려 주세요.';

// 로그인 후 하던 동작 이어가기(2026-11-24, 공통 지침 §1.2.5): 로그인이 필요해 막힌 버튼(새 게임·이어하기·챕터 불러오기)을
// 기억했다가, 로그인·스트리머 인증으로 권한이 생기면 같은 버튼을 다시 눌러 준다. 로그인 창을 그냥 닫으면 잊는다(공통 창의 then).
let lastGameActionButton = null;
document.addEventListener('click', (event) => {
  const button = event.target && event.target.closest ? event.target.closest('button') : null;
  if (button && !button.closest('.onyu-auth-overlay') && !button.closest('dialog.sk-login')) lastGameActionButton = button;
}, true);

async function ensureGameAccess() {
  await window.onyuAuthReady;
  await refreshAccessState();
  const s = window.onyuAuthState;
  if (!s.isAdmin && !s.authenticated) {
    pendingGameStartAuthorization = false;
    const button = lastGameActionButton;
    hide(confirmOverlay);
    seriesLogin.open({ then: () => {
      const now = window.onyuAuthState;
      if (!(now.isAdmin || now.authenticated) || !button || !document.body.contains(button) || button.disabled) return;
      setTimeout(() => button.click(), 0);
    } });
    return false;
  }
  if (!s.canStartGame) {
    pendingGameStartAuthorization = false;
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied');
    window.alert('무료 이용 권한을 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    return false;
  }
  // 스트리머 플레이는 꾸민 의상을 별풍선 후원으로만 해금하므로, SOOP 후원 연동이
  // 승인되기 전에는 새 게임·이어하기·챕터 불러오기 모두 진입을 막고 안내한다.
  // 2026-11-24: 막는 기준은 서버 스위치(sdkAvailable)다. 스트리머별 SOOP 연결(sdkApproved)은
  // 게임 진입 때 받는 준비 동의 뒤 설정에서 하므로, 그것을 기준으로 막으면 누구도 들어갈 수 없다.
  if (s.role === 'streamer' && s.donationSdkAvailable !== true) {
    pendingGameStartAuthorization = false;
    window.alert(STREAMER_DONATION_PENDING_NOTICE);
    return false;
  }
  try {
    // 선택한 모드를 전달하되, 실제 접근 권한은 서버가 다시 판정한다.
    await startSessionFn({ accessMode: s.accessMode });
    pendingGameStartAuthorization = true;
    closeAll();
    return true;
  } catch (e) {
    pendingGameStartAuthorization = false;
    console.error('온 이유 관리자 게임 시작 권한 확인 실패:', e);
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied');
    if (s.isAdmin) window.alert('관리자 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    else window.alert(e && e.message ? e.message : '무료 게임 이용 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
}

window.onyuNotifyFreeAccess = function () { window.alert(FREE_ACCESS_NOTICE); };
window.onyuConsumeGameStartAuthorization = function () {
  const authorized = pendingGameStartAuthorization;
  pendingGameStartAuthorization = false;
  return authorized;
};

window.onyuOpenLoginModal = openLoginModal;
window.onyuOpenStreamerModal = openStreamerModal;
window.onyuEnsureGameAccess = ensureGameAccess;
window.onyuToggleAdminMode = toggleAdminMode;
window.onyuOpenStreamerGiftModal = function () {
  window.alert('온이유 게임은 로그인 또는 인증된 스트리머 계정으로 무료 이용할 수 있습니다. 새로운 이용권 구매·선물 신청은 종료되었습니다.');
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);
  authBtn.addEventListener('click', () => {
    if (window.onyuAuthState.authenticated || window.onyuAuthState.role === 'streamer') openLoginModal();
    else openLoginModal();
  });
  if (donationIntegrationToggleEl) donationIntegrationToggleEl.addEventListener('click', toggleDonationIntegrationPreparation);
  if (donationIntegrationConnectEl) donationIntegrationConnectEl.addEventListener('click', async () => {
    donationIntegrationConnectEl.disabled = true;
    try {
      const started = await window.onyuStartSoopChatConsent();
      // 팝업으로 열렸으면 이 화면은 그대로 두고 버튼만 다시 누를 수 있게 한다(팝업을 닫고 다시 시도하는 경우).
      if (started && started.popup) donationIntegrationConnectEl.disabled = false;
    }
    catch (error) { window.alert(error && error.message ? error.message : 'SOOP 연결을 시작하지 못했습니다.'); donationIntegrationConnectEl.disabled = false; }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
});

onAuthStateChanged(auth, async (user) => {
  window.stopOnyuSoopTokenRefresh();
  window.onyuAuthState.donationIntegrationStatus = 'not-prepared';
  window.onyuAuthState.donationSdkApproved = false;
  if (streamerVerifiedUnsubscribe) { streamerVerifiedUnsubscribe(); streamerVerifiedUnsubscribe = null; }
  if (switchApprovalUnsubscribe) { switchApprovalUnsubscribe(); switchApprovalUnsubscribe = null; }
  switchHandoffInProgress = false;
  window.onyuAuthState.user = user;
  if (typeof window.onyuTelemetrySetIdentity === 'function') {
    window.onyuTelemetrySetIdentity(user && user.uid ? user.uid : null);
  }
  window.onyuAuthState.realUser = user && !user.isAnonymous ? user : null;
  if (!user) {
    signInAnonymously(auth)
      .catch((e) => console.error('익명 로그인 실패:', e))
      .finally(() => {
        if (!readyResolved) { readyResolved = true; readyResolve(); }
      });
    return;
  }
  const uid = user.uid;
  let hasInitialVerifiedValue = false;
  let previousVerifiedValue = false;
  let visitLogged = false;
  streamerVerifiedUnsubscribe = onValue(ref(db, 'users/' + uid + '/streamerVerified'), async (snapshot) => {
    if (auth.currentUser?.uid !== uid) return;
    const verified = snapshot.val() === true;
    // 인증 스트리머 접속 Discord 알림(서버가 인증 확인·하루 1번 중복 제거). 익명 기반 스트리머 계정도 포함(2026-11-26).
    if (verified && !visitLogged) {
      visitLogged = true;
      logVerifiedOnyuStreamerVisitFn().catch((error) => {
        console.warn('온이유 인증 스트리머 접속 알림 기록 실패:', error);
      });
    }
    if (hasInitialVerifiedValue && previousVerifiedValue !== verified) {
      await refreshAccessState();
      if (auth.currentUser?.uid !== uid) return;

    }
    previousVerifiedValue = verified;
    hasInitialVerifiedValue = true;
  }, (error) => console.error('스트리머 인증 상태 구독 실패:', error));
  switchApprovalUnsubscribe = onValue(ref(db, 'users/' + uid + '/streamerVerificationSwitchApproval'), (snapshot) => {
    if (auth.currentUser?.uid !== uid) return;
    const requestId = snapshot.val() && snapshot.val().requestId;
    if (requestId) handleOnyuStreamerSwitchApproval(uid, String(requestId));
  }, (error) => console.error('계정 전환 승인 신호 구독 실패:', error));
  await refreshAccessState();
  if (auth.currentUser?.uid !== uid) return;
  if (!readyResolved) { readyResolved = true; readyResolve(); }
});

// 스트리머 인증 신청: SOOP 검색을 기본 방식으로(2026-11-18). 기존 입력칸은 "직접 입력하기"로 남긴다.
// 검색은 팬페이지 서버의 streamerFanPageVerifySearch(로그인 필요, 사용자별 횟수 제한)를 함께 쓴다.
{
  const soopVerifySearchFn = httpsCallable(functions, 'streamerFanPageVerifySearch');
  const attachSoopVerifySearchTo = (nicknameId, soopIdId, steps) => {
    if (!document.getElementById(nicknameId) || !document.getElementById(soopIdId)) return;
    window.attachSoopVerifySearch({
      nicknameInput: nicknameId,
      soopIdInput: soopIdId,
      steps,
      search: async (query) => {
        await auth.authStateReady();
        if (!auth.currentUser) await signInAnonymously(auth);
        // 검색하는 동안 인증 서버를 미리 깨운다(확인 전용 호출: 신청·코드를 만들지 않음, 5분에 한 번).
        if (Date.now() - (window.__verifyWarmAt || 0) > 300000) {
          window.__verifyWarmAt = Date.now();
          httpsCallable(functions, 'requestStreamerVerification')({ checkOnly: true }).catch(() => {});
        }
        const result = await soopVerifySearchFn({ query });
        return (result.data && result.data.streamers) || [];
      },
    });
  };
  const attachAll = () => {
    // 미연시 제작 신청: 일반 유저가 제작 대상 스트리머를 고른다(서버가 SOOP에서 다시 확인).
    attachSoopVerifySearchTo('production-target-nickname', 'production-target-soopid');
  };
  if (window.attachSoopVerifySearch) attachAll();
  else {
    const script = document.createElement('script');
    script.src = new URL('./soop-verify-search.js?v=20261118-svs1', import.meta.url).href;
    script.onload = attachAll;
    document.head.appendChild(script);
  }
}
