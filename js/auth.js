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
import { getDatabase, ref, set, onValue, onDisconnect } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';
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
const startSessionFn = httpsCallable(functions, 'onyuStartSession');
const submitPlayerReviewFn = httpsCallable(functions, 'onyuSubmitReview');
const submitStreamerProductionInquiryFn = httpsCallable(functions, 'onyuSubmitStreamerProductionInquiry');
const listPublicPlayerReviewsFn = httpsCallable(functions, 'onyuVnListPublicReviews');
const trackEventsFn = httpsCallable(functions, 'onyuTrackEvents');
const logVerifiedOnyuStreamerVisitFn = httpsCallable(functions, 'onyuVnLogVerifiedStreamerVisit');
const getDonationIntegrationStatusFn = httpsCallable(functions, 'onyuGetDonationIntegrationStatus');
const setDonationIntegrationPreparationFn = httpsCallable(functions, 'onyuSetDonationIntegrationPreparation');
const registerOutfitDonationSessionFn = httpsCallable(functions, 'onyuRegisterOutfitDonationSession');
const closeOutfitDonationSessionFn = httpsCallable(functions, 'onyuCloseOutfitDonationSession');

window.onyuGetDonationIntegrationStatus = async function () {
  const data = (await getDonationIntegrationStatusFn()).data || {};
  window.onyuAuthState.donationSdkApproved = data.sdkApproved === true;
  return data;
};
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
window.onyuRegisterOutfitDonationSession = async function (payload) { return (await registerOutfitDonationSessionFn(payload || {})).data || {}; };
window.onyuCloseOutfitDonationSession = async function (sessionId) { return (await closeOutfitDonationSessionFn({ sessionId })).data || {}; };

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

const loginOverlay = document.getElementById('onyu-login-overlay');
const streamerOverlay = document.getElementById('onyu-streamer-overlay');
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
const streamerMessageEl = document.getElementById('onyu-streamer-message');
const streamerForm = document.getElementById('onyu-streamer-form');
const streamerNicknameInput = document.getElementById('onyu-streamer-nickname');
const streamerSoopIdInput = document.getElementById('onyu-streamer-soopid');
const streamerSubmitBtn = document.getElementById('onyu-streamer-submit');
const streamerNote = document.getElementById('onyu-streamer-note');
const streamerNoteCodeBtn = document.getElementById('onyu-streamer-note-code');
const streamerNoteStatus = document.getElementById('onyu-streamer-note-status');
let streamerRequestSubmitted = false;
let presenceTimer = null;
let presenceRef = null;
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
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('presence_heartbeat');
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

function showStreamerNote(data, previousCode) {
  const canSendNote = data.noteEligible === true || (!data.isSwitch && data.noteEligible !== false);
  streamerNote.hidden = !canSendNote;
  if (!canSendNote) return;
  const code = Number(data.verificationCodeExpiresAt) > Date.now()
    ? data.verificationCode || previousCode || '' : '';
  streamerNoteCodeBtn.textContent = code || '코드 없음';
  streamerNoteCodeBtn.disabled = !code;
  streamerNoteStatus.textContent = code ? '' : '코드가 없거나 만료됐어요. 새 코드를 발급해주세요.';
  streamerNoteCodeBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(code); streamerNoteStatus.textContent = '복사했어요. 쪽지 본문에 붙여넣어 보내주세요.'; }
    catch (_) { streamerNoteStatus.textContent = '코드를 선택해 직접 복사해주세요.'; }
  };
}

function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }
function closeAll() { hide(loginOverlay); hide(streamerOverlay); hide(confirmOverlay); }

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
  if (window.onyuAuthState.role !== 'streamer' || window.onyuAuthState.isAdmin) { window.onyuAuthState.donationSdkApproved = false; donationIntegrationRowEl.hidden = true; return; }
  donationIntegrationRowEl.hidden = false; donationIntegrationToggleEl.disabled = true;
  try {
    const data = await window.onyuGetDonationIntegrationStatus();
    const prepared = data.status === 'preparing';
    donationIntegrationStateEl.textContent = prepared ? '심사 준비 동의됨' : '준비 전';
    donationIntegrationDescriptionEl.textContent = prepared
      ? `준비 동의 만료: ${data.expiresAt ? new Date(data.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '24시간 이내'}. 만료 후 서버에서 삭제됩니다. 심사 전에는 후원 감지·토큰 저장·자동 선택을 실행하지 않습니다.`
      : '새 게임 시작 시 준비 동의를 안내합니다. 동의하지 않아도 게임을 이용할 수 있고, 심사 승인 뒤 실제 방송 연결 때 별도 동의를 받습니다.';
    donationIntegrationToggleEl.textContent = '준비 동의 철회'; donationIntegrationToggleEl.hidden = !prepared; donationIntegrationToggleEl.dataset.prepared = prepared ? 'true' : 'false'; donationIntegrationToggleEl.disabled = false;
  } catch (_) {
    window.onyuAuthState.donationSdkApproved = false;
    donationIntegrationDescriptionEl.textContent = '연동 준비 상태를 확인하지 못했습니다.';
    donationIntegrationToggleEl.hidden = true;
    donationIntegrationToggleEl.disabled = false;
  }
}

async function toggleDonationIntegrationPreparation() {
  const prepared = donationIntegrationToggleEl.dataset.prepared === 'true';
  if (!prepared || !window.confirm('방송 후원 자동 연동 준비 동의를 철회하고 저장된 준비 정보를 즉시 삭제할까요?')) return;
  donationIntegrationToggleEl.disabled = true;
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

function openLoginModal() { closeAll(); show(loginOverlay); }
function openStreamerModal() {
  closeAll();
  streamerForm.reset();
  setStreamerSubmitState(streamerRequestSubmitted);
  streamerNote.hidden = !streamerRequestSubmitted;
  streamerMessageEl.textContent = '방송 닉네임과 SOOP 아이디로 스트리머 인증을 신청할 수 있어요. 인증이 완료되면 별도의 이용권 없이 무료로 플레이할 수 있어요.';
  show(streamerOverlay);
}

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
    } else if (data.action === 'already-verified' || data.action === 'auto-approved') {
      closeAll();
      await refreshAccessState();
      alert('이미 스트리머 인증이 완료된 계정입니다.');
    } else {
      setStreamerSubmitState(true);
      showStreamerNote(data, '');
      streamerMessageEl.textContent = data.isSwitch
        ? (data.noteEligible
          ? '기존 인증 스트리머의 SOOP 아이디로 쪽지 코드를 보내면 확인 후 이 기기에서도 기존 계정으로 전환됩니다.'
          : '계정 전환 신청이 관리자에게 전달됐어요. 기존 인증 정보가 자동 쪽지 확인 조건을 충족하지 않아 수동 검수합니다.')
        : '인증 신청이 접수됐어요. SOOP 쪽지의 발신자 아이디와 코드를 대조해 자동 승인합니다.';
    }
  } catch (e) {
    setStreamerSubmitState(false);
    console.error('스트리머 인증 신청 실패:', e);
    alert('스트리머 인증 신청에 실패했습니다: ' + (e.message || e));
  }
}

async function checkStreamerVerification() {
  try {
    const previousText = streamerNoteCodeBtn.textContent.trim();
    const previousCode = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(previousText) ? previousText : '';
    const result = await requestStreamerVerificationFn({ source: 'onyu-vn', checkOnly: true });
    const data = result.data || {};
    if (data.action === 'already-verified' || data.action === 'auto-approved') {
      closeAll();
      await refreshAccessState();
      alert('스트리머 인증이 완료됐습니다.');
    } else if (data.action === 'switch') {
      closeAll();
      await signInWithCustomToken(auth, data.customToken);
      window.location.reload();
    } else {
      if (data.action === 'pending') { setStreamerSubmitState(true); showStreamerNote(data, previousCode); }
      streamerMessageEl.textContent = '아직 관리자 확인 전이에요. 잠시 후 다시 확인해 주세요.';
    }
  } catch (e) {
    if (!streamerRequestSubmitted) setStreamerSubmitState(false);
    alert('인증 상태 확인에 실패했습니다: ' + (e.message || e));
  }
}

async function renewStreamerVerificationCode() {
  try {
    const result = await requestStreamerVerificationFn({ source: 'onyu-vn' });
    const data = result.data || {};
    if (data.action !== 'pending') return checkStreamerVerification();
    showStreamerNote(data, '');
  } catch (e) { streamerNoteStatus.textContent = '새 코드 발급에 실패했습니다: ' + (e.message || e); }
}

async function ensureGameAccess() {
  await window.onyuAuthReady;
  await refreshAccessState();
  const s = window.onyuAuthState;
  if (!s.isAdmin && !s.authenticated) {
    pendingGameStartAuthorization = false;
    openLoginModal();
    return false;
  }
  if (!s.canStartGame) {
    pendingGameStartAuthorization = false;
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied');
    window.alert('무료 이용 권한을 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
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
  document.getElementById('onyu-google-login').addEventListener('click', loginWithGoogle);
  document.getElementById('onyu-kakao-login').addEventListener('click', loginWithKakao);
  document.getElementById('onyu-streamer-verify').addEventListener('click', openStreamerModal);
  document.getElementById('onyu-login-close').addEventListener('click', closeAll);
  document.getElementById('onyu-streamer-close').addEventListener('click', closeAll);
  document.getElementById('onyu-streamer-check').addEventListener('click', checkStreamerVerification);
  document.getElementById('onyu-streamer-renew').addEventListener('click', renewStreamerVerificationCode);
  if (donationIntegrationToggleEl) donationIntegrationToggleEl.addEventListener('click', toggleDonationIntegrationPreparation);
  streamerForm.addEventListener('submit', submitStreamerVerification);
  [loginOverlay, streamerOverlay].forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
});

onAuthStateChanged(auth, async (user) => {
  if (streamerVerifiedUnsubscribe) { streamerVerifiedUnsubscribe(); streamerVerifiedUnsubscribe = null; }
  if (switchApprovalUnsubscribe) { switchApprovalUnsubscribe(); switchApprovalUnsubscribe = null; }
  switchHandoffInProgress = false;
  window.onyuAuthState.user = user;
  if (typeof window.onyuTelemetrySetIdentity === 'function') {
    window.onyuTelemetrySetIdentity(user && user.uid ? user.uid : null);
  }
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
  const uid = user.uid;
  let hasInitialVerifiedValue = false;
  let previousVerifiedValue = false;
  streamerVerifiedUnsubscribe = onValue(ref(db, 'users/' + uid + '/streamerVerified'), async (snapshot) => {
    if (auth.currentUser?.uid !== uid) return;
    const verified = snapshot.val() === true;
    if (hasInitialVerifiedValue && previousVerifiedValue !== verified) {
      await refreshAccessState();
      if (auth.currentUser?.uid !== uid) return;
      if (verified) {
        streamerRequestSubmitted = true;
        setStreamerSubmitState(true);
        if (streamerSubmitBtn) streamerSubmitBtn.textContent = '인증 완료';
        streamerNote.hidden = true;
        streamerMessageEl.textContent = '✅ 관리자가 승인했어요. 스트리머 인증 권한이 새로고침 없이 적용됐습니다.';
      }
    }
    previousVerifiedValue = verified;
    hasInitialVerifiedValue = true;
  }, (error) => console.error('스트리머 인증 상태 구독 실패:', error));
  switchApprovalUnsubscribe = onValue(ref(db, 'users/' + uid + '/streamerVerificationSwitchApproval'), (snapshot) => {
    if (auth.currentUser?.uid !== uid) return;
    const requestId = snapshot.val() && snapshot.val().requestId;
    if (requestId) handleOnyuStreamerSwitchApproval(uid, String(requestId));
  }, (error) => console.error('계정 전환 승인 신호 구독 실패:', error));
  startPresence(user);
  if (!user.isAnonymous) {
    logVerifiedOnyuStreamerVisitFn().catch((error) => {
      console.warn('온이유 인증 스트리머 접속 알림 기록 실패:', error);
    });
  }
  await refreshAccessState();
  if (auth.currentUser?.uid !== uid) return;
  if (!readyResolved) { readyResolved = true; readyResolve(); }
});
