# onyu-vn 작업 지침

이 프로젝트는 번들러 없는 정적 비주얼 노벨이며, 게임 페이지는 GitHub Pages로 배포한다.
로그인은 Firebase Authentication을 사용한다.

## Firebase 연동

- Firebase 프로젝트는 `soop-stock-market`이며, 전용 데이터는 RTDB의 `onyuVn/` 아래에 둔다.
- 현재 공유 `database.rules.json`은 `onyuVn`의 클라이언트 읽기·쓰기를 차단한다. 이 데이터는
  클라이언트에서 RTDB로 직접 읽거나 쓰지 말고 `admin-center/functions/`의 callable을
  통해 처리한다.
- 온이유 callable은 현재 `admin-center` 저장소의 `admincenter` codebase가 소유한다.
  새 함수를 만들거나 배포할 때는 함수명 전역 충돌을 확인하고, 함수 이름을 명시해 배포한다.
- 후기·접근 권한처럼 UID와 결부되는 작업은 클라이언트 입력의 UID를 신뢰하지 않고,
  callable의 인증 컨텍스트에서 UID를 가져와 서버에서 권한과 입력을 검증한다.

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
