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
const listStreamerGiftTargetsFn = httpsCallable(functions, 'onyuListStreamerGiftTargets');
const submitStreamerGameGiftFn = httpsCallable(functions, 'onyuSubmitStreamerGameGift');
const startSessionFn = httpsCallable(functions, 'onyuStartSession');
const submitPlayerReviewFn = httpsCallable(functions, 'onyuSubmitReview');
const listPublicPlayerReviewsFn = httpsCallable(functions, 'onyuVnListPublicReviews');
const trackEventsFn = httpsCallable(functions, 'onyuTrackEvents');
const logVerifiedOnyuStreamerVisitFn = httpsCallable(functions, 'onyuVnLogVerifiedStreamerVisit');

window.onyuSubmitPlayerReview = async function (payload) {
  const result = await submitPlayerReviewFn(payload || {});
  return result.data || {};
};

window.onyuRequestStreamerVerification = async function (payload) {
  const result = await requestStreamerVerificationFn(Object.assign({}, payload || {}, { source: 'onyu-vn' }));
  return result.data || {};
};

window.onyuListPublicPlayerReviews = async function (payload) {
  const user = auth.currentUser;
  if (!user) throw new Error('익명 로그인을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.');
  const result = await listPublicPlayerReviewsFn(payload || {});
  return result.data || { reviews: [], hasMore: false, nextCursor: null };
};

// 주식시장·배팅시장 자산 신청에서 사용하는 공용 SOOP 별풍선 후원창.
// 개발자 방송국 페이지가 아니라 실제 후원 UI를 바로 연다.
const DONATION_URL = 'https://st.sooplive.com/app/gift_starballoon.php?szBjId=skftodwocks2&szWork=BJ_STATION&sys_type=web&location=station';
const KAKAO_JS_KEY = 'ed4f01d6903ca41d5dc0ab32b6ae143c';
const ADMIN_MODE_STORAGE_KEY = 'onyuVn.adminMode';
const ADMIN_ACCESS_MODES = ['viewer', 'streamer', 'admin'];
const ADMIN_ACCESS_MODE_LABELS = {
  admin: '관리자 모드',
  streamer: '스트리머 모드',
  viewer: '일반 로그인 유저',
};
const PRE_RELEASE_NOTICE = '온이유 게임은 아직 정식 출시 전입니다. 정식 출시 후 다시 이용해 주세요.';
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
const viewerNicknameInput = document.getElementById('onyu-viewer-nickname');
const giftStreamerSelect = document.getElementById('onyu-gift-streamer');
const giftRecipientFields = document.getElementById('onyu-gift-recipient-fields');
const giftTargetNicknameInput = document.getElementById('onyu-gift-target-nickname');
const giftTargetSoopIdInput = document.getElementById('onyu-gift-target-soopid');
const accessMessageEl = document.getElementById('onyu-access-message');
const giftStatusEl = document.getElementById('onyu-gift-status');
const giftSubmitBtn = document.getElementById('onyu-donation-open');
const adminModeSectionTitle = document.getElementById('onyu-admin-section-title');
const adminModeRow = document.getElementById('onyu-admin-mode-row');
const adminModeToggle = document.getElementById('onyu-admin-mode-toggle');
const adminModeStateEl = document.getElementById('onyu-admin-mode-state');
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
  streamerNote.hidden = !!data.isSwitch;
  if (data.isSwitch) return;
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
      // 관리자 여부는 관리자센터 서버 응답으로만 결정한다. 조회 실패 시 관리자 권한을 추측하지 않는다.
      isAdmin: false,
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
  streamerNote.hidden = !streamerRequestSubmitted;
  streamerMessageEl.textContent = '방송 닉네임과 SOOP 아이디를 입력하면 관리자 확인 후 무료로 게임을 시작할 수 있어요.';
  show(streamerOverlay);
}

async function refreshStreamerGiftTargets() {
  giftStreamerSelect.disabled = true;
  const previousValue = giftStreamerSelect.value || 'gift';
  giftStreamerSelect.innerHTML = '<option value="gift">스트리머에게 선물하기</option>';
  giftStatusEl.textContent = '';
  try {
    const result = await listStreamerGiftTargetsFn();
    const selfEligible = !!(result.data && result.data.selfEligible);
    const selfViewerEligible = !!(result.data && result.data.selfViewerEligible);
    const balloons = result.data && result.data.balloons || 50;
    const ownStreamer = result.data && result.data.selfStreamer || null;
    if (window.onyuAuthState.role === 'streamer' && ownStreamer && ownStreamer.soopId) {
      accessMessageEl.textContent = '스트리머 인증이 완료됐어요. 아직 이용권이 없다면 시청자에게 SOOP 아이디 @' + ownStreamer.soopId + '로 선물해 달라고 안내해 주세요. 후원 확인 후 이용할 수 있습니다.';
    }
    if (selfViewerEligible) {
      const ownOption = document.createElement('option');
      ownOption.value = '__self_viewer__';
      ownOption.textContent = '내 게임 이용권 구매';
      giftStreamerSelect.appendChild(ownOption);
    }
    if (selfEligible) {
      const ownOption = document.createElement('option');
      ownOption.value = '__self__';
      const own = result.data.selfStreamer || {};
      ownOption.textContent = '내 스트리머 이용권 구매' + (own.nickname ? ' (' + own.nickname + ')' : '');
      giftStreamerSelect.appendChild(ownOption);
    }
    giftStreamerSelect.value = Array.from(giftStreamerSelect.options).some((option) => option.value === previousValue) ? previousValue : 'gift';
    giftRecipientFields.hidden = giftStreamerSelect.value !== 'gift';
    giftStreamerSelect.disabled = false;
    giftSubmitBtn.textContent = '별풍선 ' + balloons + '개 후원하고 구매·선물 신청';
  } catch (error) {
    console.error('선물 받을 스트리머 목록 조회 실패:', error);
    giftStreamerSelect.disabled = false;
    giftRecipientFields.hidden = giftStreamerSelect.value !== 'gift';
  }
}
function openAccessModal() {
  closeAll();
  giftSubmitBtn.disabled = false;
  giftSubmitBtn.textContent = '별풍선 50개 후원하고 구매·선물 신청';
  giftStatusEl.textContent = '';
  accessMessageEl.textContent = window.onyuAuthState.role === 'streamer'
    ? '스트리머 인증이 완료됐어요. 아직 이용권이 없다면 시청자에게 이 화면의 SOOP 아이디로 선물해 달라고 안내해 주세요. 후원 확인 후 이용할 수 있습니다.'
    : '별풍선 50개를 관리자 방송국에 후원해 이용권을 구매하거나, 아직 인증하지 않은 스트리머에게도 선물할 수 있습니다. 후원 확인 후 이용권이 지급됩니다.';
  giftRecipientFields.hidden = giftStreamerSelect.value !== 'gift';
  show(accessOverlay);
  refreshStreamerGiftTargets();
}
window.onyuOpenStreamerGiftModal = async function () {
  await window.onyuAuthReady;
  await refreshAccessState();
  if (!window.onyuAuthState.authenticated) {
    openLoginModal();
    return false;
  }
  openAccessModal();
  return true;
};

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
        ? '계정 전환 신청이 관리자에게 전달됐어요. 확인 후 승인 상태를 다시 확인해 주세요.'
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

async function submitStreamerGameGift() {
  const donorNickname = viewerNicknameInput.value.trim();
  const selectedTarget = giftStreamerSelect.value;
  if (!donorNickname) {
    alert('SOOP 후원자 닉네임을 입력해 주세요.');
    viewerNicknameInput.focus();
    return;
  }
  const targetNickname = giftTargetNicknameInput.value.trim();
  const targetSoopId = giftTargetSoopIdInput.value.trim().toLowerCase();
  if (selectedTarget === 'gift' && !targetNickname) {
    alert('선물 받을 SOOP 닉네임을 입력해 주세요.');
    giftTargetNicknameInput.focus();
    return;
  }
  if (selectedTarget === 'gift' && !/^[a-z0-9]{2,20}$/.test(targetSoopId)) {
    alert('SOOP 아이디는 영문 소문자/숫자 2~20자로 입력해 주세요.');
    giftTargetSoopIdInput.focus();
    return;
  }
  // 클릭 이벤트 안에서 먼저 창을 열어 브라우저의 팝업 차단을 피한다. 실제 후원은
  // 관리자 방송국으로 진행하고, 이용권은 관리자가 후원 내역을 확인한 뒤 대상에게 준다.
  const purchaseType = selectedTarget === '__self__' ? 'self' : selectedTarget === '__self_viewer__' ? 'self-viewer' : 'gift';
  const popup = window.open(DONATION_URL, '_blank', 'noopener,noreferrer');
  giftSubmitBtn.disabled = true;
  giftSubmitBtn.textContent = '신청 접수 중...';
  try {
    const result = await submitStreamerGameGiftFn({ purchaseType, donorNickname, targetNickname, targetSoopId });
    const balloons = result.data && result.data.balloons || 50;
    giftStatusEl.textContent = purchaseType === 'self'
      ? '본인 이용권 구매 신청이 접수됐어요. 관리자 방송국에 별풍선 ' + balloons + '개를 후원해 주세요. 후원 확인 후 본인 계정에 이용권이 부여됩니다.'
      : purchaseType === 'self-viewer'
        ? '게임 이용권 구매 신청이 접수됐어요. 관리자 방송국에 별풍선 ' + balloons + '개를 후원해 주세요. 후원 확인 후 현재 로그인한 계정에 이용권이 부여됩니다.'
        : '선물 신청이 완료됐어요. 관리자 방송국에 별풍선 ' + balloons + '개를 후원해 주세요. 후원 확인 후 이용권이 지급됩니다. 대상이 아직 미인증이면 스트리머 인증 승인 즉시 자동으로 이용할 수 있어요.';
    giftSubmitBtn.textContent = '선물 신청 완료';
  } catch (e) {
    if (popup && !popup.closed) popup.close();
    giftSubmitBtn.disabled = false;
    giftSubmitBtn.textContent = '별풍선 50개 후원하고 구매·선물 신청';
    console.error('온 이유 스트리머 이용권 구매·선물 신청 실패:', e);
    alert('이용권 신청에 실패했습니다: ' + (e.message || '로그인 상태를 확인해 주세요.'));
  }
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
  if (!s.isAdmin && s.role !== 'streamer' && !s.canStartGame) {
    pendingGameStartAuthorization = false;
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied');
    openAccessModal();
    return false;
  }
  if (!s.isAdmin && s.role === 'streamer' && !s.canStartGame) {
    pendingGameStartAuthorization = false;
    openAccessModal();
    return false;
  }
  if (s.isAdmin && s.accessMode === 'streamer' && !s.canStartGame) {
    pendingGameStartAuthorization = false;
    window.alert('스트리머 모드에서는 인증 스트리머 이용권이 있어야 게임을 시작할 수 있습니다.');
    return false;
  }
  if (s.isAdmin && s.accessMode === 'viewer' && !s.canStartGame) {
    pendingGameStartAuthorization = false;
    if (typeof window.onyuTelemetryTrack === 'function') window.onyuTelemetryTrack('game_access_denied');
    openAccessModal();
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
    else window.alert(e && e.message ? e.message : '선물 이용권 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
}

window.onyuNotifyPreRelease = function () { window.alert(PRE_RELEASE_NOTICE); };
window.onyuConsumeGameStartAuthorization = function () {
  const authorized = pendingGameStartAuthorization;
  pendingGameStartAuthorization = false;
  return authorized;
};

window.onyuOpenLoginModal = openLoginModal;
window.onyuOpenStreamerModal = openStreamerModal;
window.onyuEnsureGameAccess = ensureGameAccess;
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
  giftSubmitBtn.addEventListener('click', submitStreamerGameGift);
  giftStreamerSelect.addEventListener('change', () => {
    giftRecipientFields.hidden = giftStreamerSelect.value !== 'gift';
    giftStatusEl.textContent = '';
  });
  document.getElementById('onyu-streamer-check').addEventListener('click', checkStreamerVerification);
  document.getElementById('onyu-streamer-renew').addEventListener('click', renewStreamerVerificationCode);
  streamerForm.addEventListener('submit', submitStreamerVerification);
  [loginOverlay, accessOverlay, streamerOverlay].forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  // RTDB는 클라이언트에서 직접 읽지 않고 callable을 통해서만 접근한다.
  // 인증된 스트리머가 선물 승인/인증 승인을 기다리는 동안 접근 상태를 갱신해,
  // 권한이 생기면 새로고침 없이 다음 플레이 시도부터 이용할 수 있게 한다.
  setInterval(() => {
    const state = window.onyuAuthState;
    const awaitingStreamerAccess = state.role === 'streamer' || streamerRequestSubmitted;
    if (document.visibilityState === 'visible' && !accessOverlay.hidden && auth.currentUser && awaitingStreamerAccess && !state.canStartGame) {
      refreshAccessState().then(() => {
        if (window.onyuAuthState.canStartGame && !accessOverlay.hidden) {
          accessMessageEl.textContent = '이용권이 지급되어 지금 게임을 이용할 수 있어요. 이 창을 닫고 게임을 시작해 주세요.';
          giftStatusEl.textContent = '이용권 지급이 확인됐습니다.';
        }
      });
    }
  }, 10000);
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
