# `onyu-vn` 로그인·무료 이용 설계

시행일: 2026-10-18

## 1. 이용 조건

Google 또는 Kakao로 로그인한 사용자는 이용권이나 후원 여부와 관계없이 무료로 플레이할 수 있다. 스트리머 인증을 완료한 계정도 무료로 플레이할 수 있으며, 인증 계정은 Google/Kakao를 연결하지 않은 익명 Firebase UID일 수 있다. 로그인하지 않은 미인증 게스트는 게임을 시작할 수 없다.

| 역할 | 판정 | 게임 시작 | 의상 선택 |
|---|---|---|---|
| 미인증 게스트 | Firebase 익명 사용자, 스트리머 인증 없음 | 불가. 로그인 또는 스트리머 인증 안내 | 게임 진입 불가 |
| 일반 로그인 유저 | 익명이 아닌 로그인 제공자 또는 Google/Kakao 연결 계정 | 무료 | 편한 의상·꾸민 의상 모두 무료 |
| 인증 스트리머 | `users/{uid}/streamerVerified` 또는 서버의 인증 원장으로 확인 | 무료 | 편한 의상·꾸민 의상 모두 무료 |

과거 구매·선물로 생성된 이용권과 신청 기록은 관리·이력 용도로 보존되며 게임 접근 권한을 결정하지 않는다. 2026-10-18부터 새 이용권 구매·선물 신청은 받지 않는다. 이미 접수된 요청은 관리자 검토 및 기록 정리를 위해 기존 처리 경로로 마무리할 수 있다.

## 2. 인증 상태와 역할 계산

Firebase 프로젝트는 자매 프로젝트와 같은 `soop-stock-market`이다. 페이지 로드 때 Auth 사용자가 없으면 익명 세션을 시작한다. Google/Kakao 로그인은 익명 UID를 계정에 연결하고, 스트리머 인증은 공유 `users/{uid}/streamerVerified` 상태 또는 서버 인증 원장으로 판정한다.

클라이언트는 `onyuGetViewerAccess`에서 서버가 계산한 역할·접근 상태를 받는다.

```js
window.onyuAuthState = {
  user: null,                 // Firebase User (익명 포함)
  realUser: null,             // Google/Kakao 로그인 계정
  role: 'anonymous',          // anonymous | viewer | streamer | admin
  accessStatus: 'login-required', // login-required | free
  authenticated: false,
  canStartGame: false,
};
```

`canStartGame`은 화면 표시용 상태다. 실제 플레이 시작 직전에 `onyuStartSession`이 인증 컨텍스트의 UID, 로그인 여부, 서버의 스트리머 인증 상태를 다시 판정한다. 이용권 노드는 이 판정에 사용하지 않는다. 관리자 테스트 모드의 viewer·streamer·admin도 모두 무료 접근을 사용한다.

서버 조회에 실패하면 클라이언트는 접근을 허용하지 않고 연결 확인·재시도를 안내한다. 로그인한 사용자를 구매 화면으로 보내지 않는다.

## 3. 로그인 및 스트리머 인증 흐름

1. `새 게임` 또는 게임을 이어 시작할 때 무료 이용 권한을 조회한다.
2. Google/Kakao 계정이면 서버가 무료 접근을 허용한다.
3. 익명 UID가 인증 스트리머이면 Google/Kakao 연결 없이도 서버가 무료 접근을 허용한다.
4. 익명 미인증 UID이면 Google/Kakao 로그인 또는 스트리머 인증 신청을 안내한다.
5. 인증 신청은 공유 `requestStreamerVerification` callable을 사용하며 승인 결과는 사용자의 열린 페이지에서 실시간 반영된다.

## 4. 의상 선택

[`js/outfit-picker.js`](js/outfit-picker.js)의 편한 의상과 꾸민 의상은 접근 허가를 받은 모든 사용자에게 무료로 제공한다. 후원 확인 모달은 게임 이용 또는 의상 선택을 막지 않는다.

## 5. 서버 callable과 레거시 신청

- `onyuGetViewerAccess`: 로그인·스트리머 인증을 기준으로 무료 이용 여부를 반환한다.
- `onyuStartSession`: 게임 시작 전 같은 조건을 서버에서 최종 확인하고 이용 이벤트를 기록한다.
- `onyuListStreamerGiftTargets`: 이전 클라이언트 호환용 callable이며 새 신청 목록을 제공하지 않고 종료 안내를 반환한다.
- `onyuSubmitStreamerGameGift`: 새 구매·선물 신청을 만들지 않고 무료 이용 및 신청 종료 안내를 반환한다.
- 기존 신청 조회·후원 확인·관리자 검수·승인·계정 인증 후 선물 연결 callable은 이미 접수된 요청을 마무리할 수 있도록 유지한다.
- `onyuRequestViewerAccess`와 이전 접근 승인 흐름은 종료됐다. 과거 `viewerAccessRequests`와 이용권 데이터는 이력으로 보존하고 무료 접근 판정에는 사용하지 않는다.
- 후기와 분석 데이터는 기존 서버 callable 및 UID 검증 경로를 유지한다.

관리자 승인 함수는 클라이언트에 노출하지 않고 관리자 UID를 서버에서 확인한다. 신규 함수가 필요하면 전역 함수명 충돌을 확인한 뒤 `admincenter` codebase에서 변경한 함수만 배포한다.

## 6. 저장 데이터와 보안

게임 세이브·갤러리 기록은 [`js/save.js`](js/save.js)의 `localStorage`에 저장하며 서버 UID와 브라우저 간 자동 동기화하지 않는다. 온이유 전용 서버 데이터는 RTDB `onyuVn/` 아래에 저장하고 클라이언트에서 직접 읽거나 쓰지 않는다.

- 인증된 플레이 시작도 서버 callable에서 재검증한다.
- 공유 스트리머 인증 상태는 `users/{uid}/streamerVerified`와 서버 인증 원장을 확인한다.
- RTDB 규칙을 바꿀 때는 공유 규칙 6개 사본 동기화 규칙을 따른다. 이 저장소에는 규칙 사본을 만들지 않는다.
- 과거 이용권/후원 신청 기록은 관리와 기존 요청 마무리에만 사용한다. 무료 접근 여부를 좌우하지 않는다.
