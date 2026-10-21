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
- 인증 스트리머의 미연시 제작 문의는 `onyuVn/productionInquiries`에 서버 callable로만 저장한다. 신청 UID·방송국 프로필은 인증 UID와 `streamerVerifications`에서 서버가 확인하며, 관리자 조회는 `admin-center` callable, 신규 신청 알림은 같은 저장소의 Discord RTDB 트리거가 담당한다. 공개 규정에는 문의 항목·처리 목적·보유 기간과 펀딩금 전달 후 제작 안내를 반영한다.
- 스트리머 인증 상태는 온이유 전용 `onyuVn/` 노드가 아니라 공유 `users/{uid}/streamerVerified`에서 본인 UID만 `onValue`로 구독한다. 승인 결과와 `users/{uid}/streamerVerificationSwitchApproval` 계정 전환 신호는 로그인한 페이지가 연결된 동안 반영되며, 닫힌 페이지용 푸시는 없다.
- 전환 신호 `{ requestId, approvedAt }`를 받으면 공유 `requestStreamerVerification` callable이 신청·승인 상태를 서버에서 재검증한 뒤 custom token을 반환한다. 토큰은 데이터베이스에 저장하지 않고, 전환 처리 후 신호를 삭제한다. 온이유 규칙이나 공유 규칙을 수정할 때는 해당 경로의 소유자 전용 읽기 권한을 대조하고 공유 6개 규칙 사본 동기화 절차를 지킨다.

## 무료 게임 이용 및 과거 이용권 신청 기록

- Google/Kakao 로그인 사용자와 인증 스트리머는 이용권 없이 무료로 플레이한다. 미인증 익명 게스트만 게임을 시작할 수 없으며, Google/Kakao 로그인 또는 스트리머 인증을 안내한다. `onyuGetViewerAccess`와 `onyuStartSession`은 이 조건을 서버에서 판정하고, 과거 이용권 노드를 접근 허가에 사용하지 않는다.
- `onyuListStreamerGiftTargets`와 `onyuSubmitStreamerGameGift`는 과거 클라이언트 호환용 이름을 유지하되, 새 이용권 구매·선물 신청을 제공하지 않고 종료 안내를 반환한다.
- 시행일 전에 이미 접수된 `onyuVn/streamerGameGiftRequests` 신청은 기존 관리자 검수·승인·후원 대조·계정 인증 후 연결 callable로 마무리할 수 있다. 신규 신청이 종료됐으므로 `onyuGiftBackgroundFeed`의 지속 백그라운드 감시는 온이유 이용권 경로를 구독하지 않는다. 온이유 과거 신청 기록은 관리센터에서 필요할 때 한 번 조회하며, 후원·신청 이력과 이용권 데이터는 무료 접근 여부를 결정하지 않는다.
- 과거 승인 처리는 같은 요청 ID의 중복 지급 방지 절차를 유지한다. 이용권 이력 조회·정정은 관리자 callable에서 UID/유형을 확인하고 사유·관리자·시각을 기록한다. 이전 `viewerAccessRequests`도 과거 이력으로만 보관한다.
- 공개 정책은 `terms.html`, `privacy.html`이다. 무료 접근, 새 신청 종료, 기존 요청의 보존·처리 방식이 바뀌면 두 정책과 이 문서 및 `README.md`를 함께 갱신한다. 분석 이벤트의 400/30/35일 자동 정리 정책은 기존 이용권 신청·후원 중복 방지 기록의 보유기간과 별개다.

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
