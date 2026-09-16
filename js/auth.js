/*
 * onyu-vn 인증·접근 권한.
 *
 * 익명 Firebase 세션은 공개 데이터 조회와 스트리머 인증 신청에 사용하고,
 * Google/Kakao 계정은 일반 시청자 계정으로 취급한다. 게임 시작 권한과 후원 승인
 * 상태는 admin-center의 onyu 전용 callable에서 최종 판정한다.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInAnonymously, signInWithPopup,
  signInWithCustomToken, signOut, linkWithPopup, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, set, onDisconnect } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js';

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
const googleProvider = new GoogleAuthProvider();
const linkGoogleAccountFn = httpsCallable(functions, 'linkGoogleAccount');
const linkKakaoAccountFn = httpsCallable(functions, 'linkKakaoAccount');
const requestStreamerVerificationFn = httpsCallable(functions, 'requestStreamerVerification');
const getViewerAccessFn = httpsCallable(functions, 'onyuGetViewerAccess');
const requestViewerAccessFn = httpsCallable(functions, 'onyuRequestViewerAccess');
const startSessionFn = httpsCallable(functions, 'onyuStartSession');
const trackEventsFn = httpsCallable(functions, 'onyuTrackEvents');

// 주식시장·배팅시장 자산 신청에서 사용하는 공용 SOOP 별풍선 후원창.
// 개발자 방송국 페이지가 아니라 실제 후원 UI를 바로 연다.
const DONATION_URL = 'https://st.sooplive.com/app/gift_starballoon.php?szBjId=skftodwocks2&szWork=BJ_STATION&sys_type=web&location=station';
const KAKAO_JS_KEY = 'ed4f01d6903ca41d5dc0ab32b6ae143c';
const ONYU_ADMIN_UID = '3Y2N5S5aCxT3bVDvcjx6GLyUaEs1';
const ADMIN_MODE_STORAGE_KEY = 'onyuVn.adminMode';
const ADMIN_ACCESS_MODES = ['viewer', 'streamer', 'admin'];
const ADMIN_ACCESS_MODE_LABELS = {
  admin: '관리자 모드',
  streamer: '스트리머 모드',
  viewer: '일반 로그인 유저',
};

window.onyuAuthState = {
  user: null,
  realUser: null,
  role: 'anonymous',
  accessStatus: 'none',
  authenticated: false,
  canStartGame: false,
  loginMethod: null,
  isAdmin: false,
  adminMode: false,
  accessMode: 'viewer',
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

const loginOverlay = document.getElementById('onyu-login-overlay');
const accessOverlay = document.getElementById('onyu-viewer-access-overlay');
const streamerOverlay = document.getElementById('onyu-streamer-overlay');
const confirmOverlay = document.getElementById('onyu-confirm-overlay');
const authStatusEl = document.getElementById('onyu-auth-status');
const authBtn = document.getElementById('onyu-auth-btn');
const accessMessageEl = document.getElementById('onyu-access-message');
const viewerNicknameInput = document.getElementById('onyu-viewer-nickname');
const adminModeSectionTitle = document.getElementById('onyu-admin-section-title');
const adminModeRow = document.getElementById('onyu-admin-mode-row');
const adminModeToggle = document.getElementById('onyu-admin-mode-toggle');
const adminModeStateEl = document.getElementById('onyu-admin-mode-state');
const streamerMessageEl = document.getElementById('onyu-streamer-message');
const streamerForm = document.getElementById('onyu-streamer-form');
const streamerNicknameInput = document.getElementById('onyu-streamer-nickname');
const streamerSoopIdInput = document.getElementById('onyu-streamer-soopid');
const streamerSubmitBtn = document.getElementById('onyu-streamer-submit');
let streamerRequestSubmitted = false;
let presenceTimer = null;
let presenceRef = null;

function stopPresence() {
  if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
  presenceRef = null;
}

function startPresence(user) {
  stopPresence();
  if (!user || !user.uid) return;
  presenceRef = ref(db, 'presence/onyuVn/' + user.uid);
  const heartbeat = function () {
    if (!presenceRef) return;
    set(presenceRef, { lastSeen: Date.now(), connectedAt: user.metadata && user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : Date.now() }).catch(function () {});
  };
  heartbeat();
  onDisconnect(presenceRef).remove().catch(function () {});
  presenceTimer = setInterval(heartbeat, 60000);
}

function setStreamerSubmitState(submitted, pending) {
  streamerRequestSubmitted = submitted;
  if (!streamerSubmitBtn) return;
  streamerSubmitBtn.disabled = submitted || !!pending;
  streamerSubmitBtn.textContent = pending ? '신청 중...' : submitted ? '신청 완료' : '인증 신청';
}

function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }
function closeAll() { hide(loginOverlay); hide(accessOverlay); hide(streamerOverlay); hide(confirmOverlay); }

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
      isAdmin: user.uid === ONYU_ADMIN_UID,
      adminMode: false,
      accessMode: 'viewer',
    });
    console.error('온 이유 접근 상태 조회 실패:', e);
  }
  updateAuthBar();
  updateAdminModeControl();
  dispatchAuthChanged();
}

async function toggleAdminMode() {
  const s = window.onyuAuthState;
  if (!s.isAdmin) return false;
  const currentIndex = ADMIN_ACCESS_MODES.indexOf(s.accessMode);
  const nextMode = ADMIN_ACCESS_MODES[(currentIndex + 1) % ADMIN_ACCESS_MODES.length];
  setStoredAdminAccessMode(nextMode);
  await refreshAccessState();
  return window.onyuAuthState.accessMode;
}

function openLoginModal() { closeAll(); show(loginOverlay); }
function openStreamerModal() {
  closeAll();
  streamerForm.reset();
  setStreamerSubmitState(streamerRequestSubmitted);
  streamerMessageEl.textContent = '방송 닉네임과 SOOP 아이디를 입력하면 관리자 확인 후 무료로 게임을 시작할 수 있어요.';
  show(streamerOverlay);
}

function updateAccessMessage() {
  const status = window.onyuAuthState.accessStatus;
  accessMessageEl.textContent = status === 'pending'
    ? '후원 승인 요청이 접수됐어요. 관리자 확인 후 승인 상태 확인 버튼을 눌러주세요.'
    : status === 'rejected'
      ? '이전 요청이 무시됐어요. 후원 내역을 확인한 뒤 다시 후원하고 요청할 수 있습니다.'
      : status === 'revoked'
        ? '접근 권한이 회수된 상태입니다. 후원 내역 확인 후 다시 승인을 요청해 주세요.'
        : '일반 유저는 별풍선 100개를 후원한 뒤 관리자의 확인·승인을 받아 게임을 시작할 수 있습니다.';
}
function openAccessModal() { closeAll(); updateAccessMessage(); show(accessOverlay); }

async function loginWithGoogle() {
  try {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      await linkWithPopup(auth.currentUser, googleProvider);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
    await linkGoogleAccountFn();
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('login_success', { provider: 'google' });
    closeAll();
    await refreshAccessState();
  } catch (e) {
    if (e && e.code === 'auth/credential-already-in-use') {
      closeAll();
      if (!(await confirmAuthSwitch('이미 보호된 Google 계정입니다. 이 기기에서도 그 계정으로 이어서 진행할까요?\n(현재 익명 세션의 기록은 옮겨지지 않습니다.)'))) return;
      try {
        await signInWithPopup(auth, googleProvider);
        await linkGoogleAccountFn();
        window.location.reload();
      } catch (e2) {
        console.error('Google 계정 전환 실패:', e2);
        alert('Google 계정 전환에 실패했습니다.');
      }
      return;
    }
    if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return;
    console.error('Google 로그인 실패:', e);
    alert('Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

async function loginWithKakao() {
  if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
    alert('카카오 로그인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  Kakao.Auth.login({
    success: async (authObj) => {
      try {
        const result = await linkKakaoAccountFn({ kakaoAccessToken: authObj.access_token });
        if (result.data.action === 'switch') {
        closeAll();
          if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('login_success', { provider: 'kakao' });
          if (!(await confirmAuthSwitch('이미 보호된 Kakao 계정입니다. 이 기기에서도 그 계정으로 이어서 진행할까요?\n(현재 익명 세션의 기록은 옮겨지지 않습니다.)'))) return;
          await signInWithCustomToken(auth, result.data.customToken);
          window.location.reload();
        } else {
          closeAll();
          if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('login_success', { provider: 'kakao' });
          await refreshAccessState();
          alert(result.data.action === 'already-linked' ? '이미 연동된 계정입니다.' : 'Kakao 계정 연동이 완료됐습니다.');
        }
      } catch (e) {
        console.error('Kakao 로그인 실패:', e);
        alert('Kakao 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    },
    fail: () => {},
  });
}

async function submitStreamerVerification(event) {
  event.preventDefault();
  if (streamerRequestSubmitted) return;
  const nickname = streamerNicknameInput.value.trim();
  const soopId = streamerSoopIdInput.value.trim();
  if (!nickname) { alert('방송 닉네임을 입력해 주세요.'); return; }
  if (!/^[a-z0-9]{2,20}$/.test(soopId)) { alert('SOOP 아이디는 영문 소문자/숫자 2~20자로 입력해 주세요.'); return; }
  setStreamerSubmitState(false, true);
  try {
    const result = await requestStreamerVerificationFn({ nickname, soopId, source: 'onyu-vn' });
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('streamer_verification_requested');
    const data = result.data || {};
    if (data.action === 'switch') {
      closeAll();
      await signInWithCustomToken(auth, data.customToken);
      window.location.reload();
    } else if (data.action === 'already-verified') {
      closeAll();
      await refreshAccessState();
      alert('이미 스트리머 인증이 완료된 계정입니다.');
    } else {
      setStreamerSubmitState(true);
      streamerMessageEl.textContent = data.isSwitch
        ? '계정 전환 신청이 관리자에게 전달됐어요. 확인 후 승인 상태를 다시 확인해 주세요.'
        : '스트리머 인증 신청이 관리자에게 전달됐어요. 관리자 확인 후 승인 상태를 다시 확인해 주세요.';
    }
  } catch (e) {
    setStreamerSubmitState(false);
    console.error('스트리머 인증 신청 실패:', e);
    alert('스트리머 인증 신청에 실패했습니다: ' + (e.message || e));
  }
}

async function checkStreamerVerification() {
  try {
    const result = await requestStreamerVerificationFn({});
    const data = result.data || {};
    if (data.action === 'already-verified') {
      closeAll();
      await refreshAccessState();
      alert('스트리머 인증이 완료됐습니다.');
    } else if (data.action === 'switch') {
      closeAll();
      await signInWithCustomToken(auth, data.customToken);
      window.location.reload();
    } else {
      if (data.action === 'pending') setStreamerSubmitState(true);
      streamerMessageEl.textContent = '아직 관리자 확인 전이에요. 잠시 후 다시 확인해 주세요.';
    }
  } catch (e) {
    if (!streamerRequestSubmitted) setStreamerSubmitState(false);
    alert('인증 상태 확인에 실패했습니다: ' + (e.message || e));
  }
}

async function openDonationAndRequestAccess() {
  const nickname = viewerNicknameInput.value.trim();
  if (!nickname) {
    alert('SOOP 후원자 닉네임을 입력해 주세요.');
    viewerNicknameInput.focus();
    return;
  }
  const popup = window.open(DONATION_URL, '_blank', 'noopener,noreferrer');
  try {
    await requestViewerAccessFn({ nickname });
    window.onyuAuthState.accessStatus = 'pending';
    updateAuthBar();
    dispatchAuthChanged();
    updateAccessMessage();
  } catch (e) {
    if (popup && !popup.closed) popup.close();
    console.error('온 이유 접근 승인 신청 실패:', e);
    alert('후원 승인 요청에 실패했습니다. 로그인 상태를 확인해 주세요.');
  }
}

async function checkViewerAccess() {
  await refreshAccessState();
  if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack(window.onyuAuthState.canStartGame ? 'access_check_success' : 'access_check_denied');
  if (window.onyuAuthState.canStartGame) {
    closeAll();
    return true;
  }
  updateAccessMessage();
  return false;
}

async function ensureGameAccess() {
  await window.onyuAuthReady;
  await refreshAccessState();
  const s = window.onyuAuthState;
  if (s.role === 'streamer' || s.canStartGame) {
    try {
      await startSessionFn({ accessMode: s.isAdmin ? s.accessMode : 'viewer' });
      return true;
    } catch (e) {
      console.error('온 이유 게임 시작 권한 확인 실패:', e);
      await refreshAccessState();
      if (window.onyuAuthState.role === 'streamer') return true;
      if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied');
      if (window.onyuAuthState.authenticated) openAccessModal();
      else openLoginModal();
      return false;
    }
  }
  if (!s.authenticated) { if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied'); openLoginModal(); return false; }
  if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied');
  openAccessModal();
  return false;
}

window.onyuOpenLoginModal = openLoginModal;
window.onyuOpenStreamerModal = openStreamerModal;
window.onyuEnsureGameAccess = ensureGameAccess;
window.onyuCheckViewerAccess = checkViewerAccess;
window.onyuToggleAdminMode = toggleAdminMode;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);
  authBtn.addEventListener('click', () => {
    if (window.onyuAuthState.authenticated || window.onyuAuthState.role === 'streamer') openLoginModal();
    else openLoginModal();
  });
  document.getElementById('onyu-google-login').addEventListener('click', loginWithGoogle);
  document.getElementById('onyu-kakao-login').addEventListener('click', loginWithKakao);
  document.getElementById('onyu-streamer-verify').addEventListener('click', openStreamerModal);
  document.getElementById('onyu-login-close').addEventListener('click', closeAll);
  document.getElementById('onyu-access-close').addEventListener('click', closeAll);
  document.getElementById('onyu-streamer-close').addEventListener('click', closeAll);
  document.getElementById('onyu-donation-open').addEventListener('click', openDonationAndRequestAccess);
  document.getElementById('onyu-access-check').addEventListener('click', checkViewerAccess);
  document.getElementById('onyu-streamer-check').addEventListener('click', checkStreamerVerification);
  streamerForm.addEventListener('submit', submitStreamerVerification);
  [loginOverlay, accessOverlay, streamerOverlay].forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
});

onAuthStateChanged(auth, async (user) => {
  window.onyuAuthState.user = user;
  window.onyuAuthState.realUser = user && !user.isAnonymous ? user : null;
  if (!user) {
    stopPresence();
    signInAnonymously(auth)
      .catch((e) => console.error('익명 로그인 실패:', e))
      .finally(() => {
        if (!readyResolved) { readyResolved = true; readyResolve(); }
      });
    return;
  }
  startPresence(user);
  await refreshAccessState();
  if (!readyResolved) { readyResolved = true; readyResolve(); }
});
