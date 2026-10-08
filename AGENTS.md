# onyu-vn 작업 지침

이 프로젝트는 번들러 없는 정적 비주얼 노벨이며, 게임 페이지는 GitHub Pages로 배포한다.
로그인은 Firebase Authentication을 사용한다.

## Firebase 연동

- Firebase 프로젝트는 `soop-stock-market`이며, 전용 데이터는 RTDB의 `onyuVn/` 아래에 둔다.
- 현재 공유 `database.rules.json`은 `onyuVn/` 경로의 클라이언트 읽기·쓰기를 차단한다. 이
  경로의 게임 권한·후기·분석 등은 클라이언트에서 직접 읽거나 쓰지 말고
  `admin-center/functions/`의 callable을 통해 처리한다. 예외로 접속 상태는 별도 경로인
  `presence/onyuVn/{uid}`에 클라이언트가 heartbeat를 기록하며, 공유 규칙은 로그인 UID와
  경로 UID 일치 및 필드 검증을 강제한다. presence에는 공개 읽기 권한이 없다.
- 온이유 callable은 현재 `admin-center` 저장소의 `admincenter` codebase가 소유한다.
  새 함수를 만들거나 배포할 때는 함수명 전역 충돌을 확인하고, 함수 이름을 명시해 배포한다.
- 후기·접근 권한처럼 UID와 결부되는 작업은 클라이언트 입력의 UID를 신뢰하지 않고,
  callable의 인증 컨텍스트에서 UID를 가져와 서버에서 권한과 입력을 검증한다.
- 스트리머 인증 상태는 온이유 전용 `onyuVn/` 노드가 아니라 공유 `users/{uid}/streamerVerified`에서 본인 UID만 `onValue`로 구독한다. 승인 결과와 `users/{uid}/streamerVerificationSwitchApproval` 계정 전환 신호는 로그인한 페이지가 연결된 동안 반영되며, 닫힌 페이지용 푸시는 없다.
- 전환 신호 `{ requestId, approvedAt }`를 받으면 공유 `requestStreamerVerification` callable이 신청·승인 상태를 서버에서 재검증한 뒤 custom token을 반환한다. 토큰은 데이터베이스에 저장하지 않고, 전환 처리 후 신호를 삭제한다. 온이유 규칙이나 공유 규칙을 수정할 때는 해당 경로의 소유자 전용 읽기 권한을 대조하고 공유 6개 규칙 사본 동기화 절차를 지킨다.

## 이용권 후원 자동 확인

- 신청·후원 완료·승인 상태는 `onyuVn/streamerGameGiftRequests` 아래 서버 callable이 관리한다. 신청자가 후원 완료 버튼을 누르면 `donationCompletedAt`이 기록되지만, 이는 실제 후원 증명이 아니며 SOOP 알림 대조가 별도로 필요하다.
- `admin-center/functions/index.js`의 `onyuGiftBackgroundFeed`는 `streamerGameGiftRequests`를 서버에서 `onValue`로 감시한다. 관리자 UID로 발급한 제한된 Firebase custom-token 세션을 확장 프로그램이 사용하며, 토큰은 RTDB에 저장하지 않는다. 이 피드는 자동 확인 필요 여부만 확장 프로그램에 전달한다.
- `promo-extension/onyu-game-gift-notifications.js`는 로그인된 SOOP 탭에서 알림 목록을 최대 10초 간격으로 확인한다. 알림의 방송국 아이디, 별풍선 수량, 시각과 중복 판별용 해시만 확인 callable로 보낸다. 알림 원문·쿠키·SOOP 로그인 비밀번호는 보내지 않고, 개별 알림을 클릭하지 않는다.
- 발신자 아이디·50개 수량·신청 및 후원 완료 시각이 대기 신청 하나와 일치할 때만 `onyuConfirmStreamerGameGiftFromNotification`이 기존 승인 처리를 호출한다. 일치하지 않거나 복수 후보인 경우 자동 승인하지 않고 관리자 수동 검수로 남긴다. 결과 표시는 신청자 페이지가 열려 있을 때 약 10초 간격으로 확인한다.
- 통합 관리 센터는 처리 후 10분 이상 `processing`에 머문 신청을 관리자 callable로 대기 상태에 복구할 수 있다. 승인 처리는 같은 요청 ID의 활성 이용권을 확인하므로 복구 후 재승인해도 중복 지급하지 않는다. 이용권 조회·회수도 관리자 callable에서 UID/유형을 검증하고, 회수 사유·관리자·시각을 이용권과 감사 로그에 남긴다.
- 이전 `viewerAccessRequests` 승인 흐름은 종료됐다. 새 요청·Discord 알림·관리자 조작을 만들지 않으며, 기존 기록은 이력으로만 보존하고 게임 권한 판정에 사용하지 않는다.
- 관리자가 통합 관리 센터에서 로그인해 확장 프로그램 세션을 시작해야 한다. 화면에 연결 완료가 표시되면 센터 탭은 닫아도 되지만, 브라우저와 확장 프로그램 및 로그인된 SOOP 탭은 후원 알림 확인 중 계속 실행되어야 한다. 브라우저가 종료되거나 알림 탭에 접근할 수 없으면 자동 확인은 처리되지 않을 수 있다.
- 공개 정책은 `terms.html`, `privacy.html`이며, 이 기능의 입력정보·자동 대조 방식·보유 기간 또는 외부 처리 방식이 변경되면 두 정책과 이 문서 및 `README.md`를 함께 대조한다. 분석 이벤트의 400/30/35일 자동 정리 정책은 이용권 신청·후원 알림 중복 방지 기록의 보유기간과 별개이므로 혼동하지 않는다.

## 확인

- `js/*.js`를 수정하면 해당 스크립트의 문법을 검사하고, HTML에서 모듈/함수 호출 연결도
  확인한다.
- 검증을 통과한 게임 코드·콘텐츠 변경은 별도 배포 확인 없이 온이유 저장소의 작업 파일만
  한글 커밋으로 커밋·push하고 GitHub Pages 배포 성공까지 확인한다. 서버 callable 변경은
  실제 소유자인 `admin-center`에서 변경 함수명만 지정해 배포하고 해당 서버 소스도 커밋·push한다.
- 화면만 변경했으면 서버 배포는 생략한다. admin-center 화면과 서버가 함께 바뀌면 양쪽 저장소를
  각각 검증·커밋·push하고, 서버 함수와 Pages 배포를 모두 확인한다. 검증 실패나 권한·배포 대상
  불확실성이 있으면 강행하지 않고 원인을 알린다.
- RTDB 규칙을 변경하려면 기준 원본 `StreamBet-Market/database.rules.json`과 실제 규칙을
  보유한 여섯 저장소의 파일 및 최근 변경 이력을 확인하고 최신의 합의된 내용을 판단한다.
  변경은 여섯 사본 모두에 동기화하고 바이트 단위 일치를 검증한다. 이 저장소에는 현재 규칙
  사본이 없으므로 임의로 새 파일을 만들지 않는다. 배포 전에는 반드시 `--dry-run`으로 검증한다.
- 함수 구현은 `admin-center/functions/index.js` 및 이 callable을 실제 호출하는 온이유
  클라이언트와 함께 대조한다.
