# `onyu-vn` 로그인·접근 권한 설계

작성일: 2026-09-16

## 1. 목표

`onyu-vn`은 로그인 방식과 스트리머 인증 여부에 따라 게임 시작 권한과 의상 선택 규칙을 나눈다.

| 역할 | 판정 | 게임 시작 | 의상 선택 |
|---|---|---|---|
| 미로그인/익명 | Firebase Auth 사용자 없음 또는 `isAnonymous` | 불가. 로그인 안내 | 불가 |
| 일반 시청자 | Google/Kakao 실계정, 스트리머 인증 아님 | 별풍선 100개 후원 및 관리자 승인 후 가능 | 편한 의상·꾸민 의상 모두 자유 선택 |
| 스트리머 | `streamerVerified === true` | 무료 가능 | 편한 의상은 즉시, 꾸민 의상은 기존 후원 확인 절차 유지 |

스트리머 인증은 Firebase Auth 제공자가 아니라 익명 UID에 서버가 부여하는 신뢰 권한이다. 따라서 Google/Kakao를 연결하지 않은 익명 UID도 승인 후 스트리머 역할이 될 수 있다.

## 2. 인증 상태와 역할 계산

Firebase는 자매 프로젝트와 같은 `soop-stock-market` 프로젝트를 사용한다.

1. 페이지 로드 시 Firebase Auth를 초기화한다.
2. Auth 사용자가 없으면 `signInAnonymously()`를 호출한다.
3. 실제 로그인 계정은 Google 또는 Kakao로 익명 UID를 보호한다.
4. `streamerVerified`를 우선 확인해 스트리머 역할을 계산한다.
5. 스트리머가 아니고 Google/Kakao 실계정이면 일반 시청자로 계산한다.
6. 일반 시청자의 경우 `onyuVn/viewerAccess/{uid}` 승인 상태를 확인한다.

클라이언트에는 다음과 같은 단일 상태를 노출한다.

```js
window.onyuAuthState = {
  user: null,                 // Firebase User (익명 포함)
  realUser: null,             // Google/Kakao 실계정
  role: 'anonymous',          // anonymous | viewer | streamer
  accessStatus: 'none',       // none | pending | approved | rejected
  canStartGame: false,
};
```

`canStartGame`은 화면 표시용 캐시일 뿐이며, 게임 시작 callable에서도 같은 조건을 서버가 다시 검사한다.

## 3. 일반 시청자 후원·승인 흐름

### 최초 접근

1. 사용자가 `새 게임`을 클릭한다.
2. Google/Kakao 로그인 전이면 로그인 UI를 먼저 보여준다.
3. 로그인 후 승인 상태가 없으면 안내 모달을 연다.
4. 모달에 SOOP 후원자 닉네임을 입력한다.
5. 확인 버튼을 누르면 SOOP 후원창을 새 탭으로 연다.
6. 동시에 `onyuRequestViewerAccess` callable로 닉네임이 포함된 승인 요청을 생성하거나 기존 대기 요청을 조회한다.
7. 사용자가 후원을 완료하면 통합 관리 센터와 디스코드 알림에서 닉네임을 확인한다.
8. 관리자가 승인하면 서버가 `onyuVn/viewerAccess/{uid}`를 `approved`로 기록한다.
9. 클라이언트는 해당 UID의 상태를 갱신하고 `새 게임`을 다시 활성화한다.

### 승인 데이터

```json
{
  "onyuVn": {
    "viewerAccess": {
      "<uid>": {
        "status": "approved",
        "approvedAt": 0,
        "reviewedAt": 0,
        "reviewedBy": "<adminUid>"
      }
    },
    "viewerAccessRequests": {
      "<uid>": {
        "uid": "<uid>",
        "nickname": "<SOOP 후원자 닉네임>",
        "provider": "google|kakao",
        "status": "pending|approved|rejected",
        "requestedAt": 0,
        "reviewedAt": 0,
        "reviewedBy": "<adminUid>"
      }
    },
    "viewerAccessAlerts": {
      "<alertId>": {
        "uid": "<uid>",
        "nickname": "<SOOP 후원자 닉네임>",
        "provider": "google|kakao",
        "status": "pending",
        "requestedAt": 0
      }
    }
  }
}
```

승인 기준은 브라우저나 기기가 아니라 Firebase UID다. 따라서 같은 Google/Kakao 계정으로 로그인하면 다른 브라우저에서도 동일한 승인 상태를 사용한다.

## 4. 스트리머 인증 흐름

기존 자매 프로젝트의 `requestStreamerVerification` callable을 재사용한다.

1. 익명 또는 로그인 사용자가 스트리머 인증 신청을 연다.
2. 방송 닉네임과 SOOP 아이디를 제출한다.
3. 관리자가 방송 신원을 확인한다.
4. 승인 시 공유 `streamerVerifications`와 `users/{uid}/streamerVerified`가 갱신된다.
5. `onyu-vn`은 `role = 'streamer'`, `canStartGame = true`로 갱신한다.

이미 다른 UID에 인증된 스트리머의 계정 전환은 기존과 동일하게 관리자 재승인 후 custom token으로 처리한다. 클라이언트가 입력한 `streamerVerified` 값은 신뢰하지 않고 서버 조회 결과만 사용한다.

## 5. 의상 선택 분기

현재 [`js/outfit-picker.js`](js/outfit-picker.js)는 꾸민 의상을 후원 확인 대상으로 취급한다.

- `role === 'viewer'`: 꾸민 의상의 후원 배지와 확인 모달을 숨기고 두 카드 모두 즉시 선택 가능
- `role === 'streamer'`: 현재 동작 유지
  - 편한 의상: 즉시 선택
  - 꾸민 의상: “실제로 후원을 받으셨나요?” 확인 모달 후 선택
- 미인증 익명 사용자: 의상 선택 화면에 도달하지 않도록 게임 시작 단계에서 차단

이 분기는 모든 챕터의 공용 outfit picker에 적용해 챕터별 예외가 생기지 않게 한다.

## 6. 서버 함수와 관리자센터 연동

`onyu-vn` 전용 함수명은 다른 자매 프로젝트와 충돌하지 않도록 접두사를 붙인다.

- `onyuRequestViewerAccess`: 실계정의 후원 승인 신청 생성/대기 상태 조회
- `onyuGetViewerAccess`: 현재 UID의 승인 상태 조회
- `onyuStartSession`: 스트리머 인증 또는 viewer 승인 여부를 서버에서 최종 검사
- `onyuApproveViewerAccess`: 관리자센터에서 승인
- `onyuRejectViewerAccess`: 관리자센터에서 반려

관리자 승인 함수는 클라이언트에 노출하지 않고 관리자 UID 검증을 서버에서 수행한다. 승인·반려 기록은 통합 감사 로그에도 남긴다.

`requestStreamerVerification`은 기존 공용 함수를 호출하되 `source: 'onyu-vn'`을 전달한다. 신규 함수 배포 전에는 Firebase 프로젝트 전체 함수 목록을 확인해 이름 충돌을 방지한다.

## 7. 저장 데이터와 브라우저 범위

현재 게임 세이브·갤러리 기록은 [`js/save.js`](js/save.js)의 `localStorage` 기반이다. 이번 로그인 설계에서 서버 UID로 공유되는 것은 접근 승인 상태이며, 게임 진행도까지 자동으로 브라우저 간 동기화하지 않는다.

진행도 동기화가 필요해질 경우 별도 `onyuVn/playthroughs/{uid}` 노드를 추가하고, 기존 localStorage 세이브와 병합 정책을 먼저 정한다.

## 8. 보안·운영상 주의

- 화면에서 버튼을 숨기는 것만으로는 승인 우회가 되므로, `onyuStartSession`에서 서버 검사를 수행한다.
- GitHub Pages의 정적 게임 특성상 `game-data.js` 파일 자체를 완전히 숨길 수는 없다. 이번 권한은 정상적인 게임 진입·후원 승인 통제 목적이며, 콘텐츠 파일 비공개가 필요하면 별도 인증 서버가 필요하다.
- RTDB 규칙에 `onyuVn` 경로를 추가할 때는 공유 RTDB를 사용하는 6개 자매 프로젝트의 `database.rules.json`을 모두 동기화하고 dry-run 검증한다.
- 후원 승인 상태는 `localStorage`에 저장하지 않는다. 로컬 값은 로딩 최적화용으로만 사용하고 서버 상태를 항상 우선한다.

## 9. 구현 순서

1. Firebase/Auth 초기화 모듈 추가
2. 익명·Google·Kakao·스트리머 인증 상태를 `onyuAuthState`로 통합
3. 로그인/스트리머 인증 UI 추가
4. 일반 시청자 후원 안내 모달과 SOOP 후원창 연결
5. `onyuVn` 승인 요청·상태 조회·게임 시작 함수 구현
6. 의상 picker 역할 분기 적용
7. 관리자센터 승인 UI 및 감사 로그 연결
8. 익명·일반 시청자·승인 시청자·스트리머·다른 브라우저 시나리오 검증
