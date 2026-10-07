# 스스로 · 앱 (MVP 1차)

`docs/01-product-policy.md` 정책과 `source/` · `designs/` 시안을 바탕으로 만든 실제 앱입니다.
개발 스펙은 `subindi/sudoku_pokemon`(포켓몬 스도쿠)과 같습니다.

| 폴더 | 내용 |
|---|---|
| `frontend/` | React 19 + TypeScript + Vite (vitest). PWA(홈 화면에 추가), `nginx.conf`, `Dockerfile` |
| `backend/` | Spring Boot 3.3 (Java 17) · JPA · Flyway · Spring Security · Spring Session JDBC. 로컬은 H2, 운영은 MySQL 8 |
| `deploy/` | Docker Compose (web · api · mysql). 사용법은 `subindi/sudoku_pokemon` 의 `deploy/README.md` 와 같음 |

## 정책 미정 항목 · 이번 구현에서 쓴 임시 기준

정책서에서 "개발 전 확정" 항목은 아래처럼 **임시 기준**으로 구현했습니다. 바뀌면 표시한 곳만 고치면 됩니다.

| 항목 | 임시 기준 | 위치 |
|---|---|---|
| 웹/PWA vs 네이티브 | 웹/PWA 먼저 | `frontend/public/manifest.webmanifest`, `sw.js` |
| 부모 로그인 | 이메일 + 비밀번호 (세션 쿠키 `SSID`, 30일). 가입 = 새 가족. **가족 초대(두 번째 부모)는 아직 없음** | `auth/` |
| 하루 마감 | Asia/Seoul 자정. 진행 중이던 과제 타이머는 자정까지만 세고 '쉬는 중'으로 | `app.zone`, `DayService.closePastDays` |
| 남은 자유시간 | 다음 날로 넘기지 않음. 일시정지는 허용 | `FreePass.settle` |
| 하루 중 필수 추가/삭제 | 이용권 발급 전이면 조건을 다시 계산하고, 승인 조건이 깨지면 승인 해제. 발급 뒤에는 이용권 유지 | `DayService.recheckApproval` |
| 오프라인 | 아이의 '완료' · '회고'만 기기에 보관 후 재전송. 타이머 · 승인 · 이용권은 온라인에서만 | `frontend/src/sync/outbox.ts` |
| PIN 오류 | 가족 단위로 5회 틀리면 10분 잠금. 복구는 계정 비밀번호 확인 후 새 PIN | `app.pin.*` |
| 부모 모드 유지 | 마지막 부모 요청 뒤 20분 지나면 서버에서 다시 잠금 | `app.pin.idle-minutes` |
| 알림 | 부모 '오늘' 화면이 15초마다 새로 고침 (도움 요청 · 확인 대기). 푸시 알림은 미연결 | `ParentApp.TodayPage` |

## 데이터 모델

- `family` / `parent_user`: 가족 = 데이터 격리 단위. 모든 아이 조회는 `findByIdAndFamilyId` 로 (다른 가족이면 404).
- `child`: 자기주도 단계 `level`(나이와 별개, Lv.2 순서 · Lv.3 순서+예상시간), 화면 모양 `ui_style`(quest | planner).
- `routine`: **반복 원본**. 고쳐도 이미 만들어진 날은 그대로 (다음 생성일부터).
- `task`: **날짜별 할 일 인스턴스**. 원본 값을 복사. 상태 `ready·active·paused·done·waived·moved`. 면제 · 이동은 완료가 아니다.
- `day_record`: 아이+날짜 하나. 반복 생성 여부, 계획 여부, **부모의 하루 승인**. 이 행을 잠가(`SELECT … FOR UPDATE`) 같은 날 변경을 한 줄로 세운다.
- `free_pass`: **자유시간 이용권**. 아이+날짜 유일 제약 → 연속 클릭 · 재시도에도 하나. 분(minutes)은 발급 때 값을 복사(설정 변경 소급 없음).
- `help_request`, `review`.

타이머는 `elapsed_sec`(누적) + `running_since`(시작 시각)로 **서버 시계만** 씁니다. 화면은 받아 온 값에 1초씩 더해 보여 줄 뿐이라 새로고침 · 다른 기기에서도 중복으로 늘지 않습니다.

## 권한

- `/api/children/**`: 로그인한 가족 기기면 사용 (아이 모드).
- `/api/parent/**`: 세션의 **부모 모드**(PIN 또는 계정 비밀번호 확인)가 열려 있어야 함. `ParentModeInterceptor` 가 매 요청 확인 → 화면 버튼과 무관하게 서버에서 403 `PARENT_LOCKED`.
- 아이 모드로 전환(`POST /api/auth/pin/lock`)하면 서버 세션의 부모 모드를 닫는다.
- 시안 체험 PIN 1234 는 쓰지 않습니다 (1234 · 같은 숫자 4개는 설정 화면에서 거절).

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/signup` · `/login` · `/logout` | 가입(새 가족) · 로그인 · 로그아웃 |
| GET | `/api/auth/me` | `{email, displayName, familyName, pinSet, parentMode}` |
| POST | `/api/auth/pin/unlock` · `/lock` · `/reset` | 부모 모드 열기 · 잠그기 · 비밀번호로 PIN 복구 |
| GET | `/api/family` | 가족 이름 · 아이 목록 · 오늘 날짜 |
| GET | `/api/children/{id}/today` | 오늘 화면 (열면서 반복 생성 · 지난 날 마감) |
| PUT | `/api/children/{id}/today/plan` | `{order, estimates}` 순서 (Lv.2+) · 예상시간 (Lv.3+) |
| POST | `/api/children/{id}/tasks/{tid}/start` · `pause` · `complete` · `undo` | 타이머 · 자기확인 완료 · 잘못 누른 완료 되돌리기 |
| POST | `/api/children/{id}/tasks/{tid}/help` | `{reason}` 도움 요청 (타이머 멈춤, 열린 요청 하나) |
| POST | `/api/children/{id}/today/free-pass` · `/start` · `/pause` | 이용권 받기(하루 하나) · 시작 · 멈춤 |
| POST | `/api/children/{id}/today/free-request` | 필수 0개인 날 부모님께 자유시간 요청 |
| PUT | `/api/children/{id}/today/review` | `{mood, note}` 회고 |
| GET | `/api/children/{id}/growth` | 최근 7일 실제 기록 (메모 제외) |
| GET | `/api/parent/overview` | 아이별 오늘 요약 · 도움 요청 · 확인 대기 |
| POST | `/api/parent/children/{id}/tasks/{tid}/adjust` | `{action: amount·waive·move·recognize·restore}` 오늘만 조정 |
| POST | `/api/parent/children/{id}/today/approve` | 부모의 하루 확인 |
| POST | `/api/parent/children/{id}/help/{hid}/resolve` | 도움 요청 처리 |
| GET | `/api/parent/children/{id}/report?from=` | 주간 리포트 (기록 없는 날은 `recorded:false`) |
| GET/POST/PUT/DELETE | `/api/parent/children/{id}/routines[/{rid}]` | 반복 할 일 (생성은 `requestId` 로 중복 방지, 삭제 = 다음 생성일부터 중단) |
| POST/PUT | `/api/parent/children[/{id}]` | 아이 등록(+첫 반복, `requestId`) · 설정 |
| PUT | `/api/parent/pin` · `/api/parent/family` | PIN 변경 · 가족 이름 |

## 로컬 개발

```bash
# API (H2 파일 DB: app/backend/data, 8080)
cd app/backend && ./gradlew bootRun     # 테스트: ./gradlew test
# 화면 (http://localhost:9090, /api 는 8080 으로 프록시)
cd app/frontend && npm install && npm run dev   # 테스트: npm test
```

운영 배포: `cd app/deploy && cp .env.example .env && docker compose up -d --build` (HTTPS 앞단 설정은 sudoku_pokemon 배포 안내와 동일).

## 정책 검증 목록 → 자동 테스트

| 검증 항목 | 테스트 |
|---|---|
| 두 아이의 데이터가 섞이지 않는다 · 다른 가족 접근 차단 | `ApiTest.두_아이의_데이터가…`, `다른_가족의_아이는…` |
| 순서 변경이 저장 · 재진입 후 유지 | `순서_변경은_저장되고…` |
| 예상시간 초과가 실패가 아니다 | `예상시간을_넘겨도…` |
| 타이머 · 자유시간이 새로고침/다기기에서 중복 증가하지 않음 | `타이머는_서버_시간으로…`, `부모_확인_없이는…`(이용권 남은 시간) , `하루_마감에…` |
| 선택 과제 미완료여도 필수만 마치면 조건 충족 | `선택_할_일이_남아도…` |
| 오늘만 조정이 반복 원본에 반영되지 않음 | `오늘만_조정해도…` |
| 부모 확인 없이 완료만으로 이용권이 열리지 않음 | `부모_확인_없이는…` |
| 연속 클릭 · 재시도에도 일일 이용권은 하나 | `부모_확인_없이는…`, `반복_할_일_저장_재시도…`, `아이_등록_재시도…` |
| 면제 · 이동은 완료로 세지 않음 · 필수 0개는 자동 지급 안 함 | `면제_이동은…` |
| 부모 권한이 서버에서 검증됨 · PIN 잠금 · 복구 | `부모_권한은_서버에서…` |
| 저장 실패 · 오프라인에서 입력 보존 | `frontend/src/sync/outbox.test.ts`, 저장 실패 시 폼 유지(`useSave`) |
| 320px · 태블릿 · PC 겹침 없음 | Playwright로 320 / 820 / 1280px 흐름 확인 (가로 넘침 0). 실기기 확인은 남음 |

## 아직 연결하지 않은 것

- 실제 푸시 알림, 가족 초대(두 번째 부모), 계정 탈퇴 · 데이터 삭제
- 실제 스마트폰 앱 잠금, AI 사진 판독, 아지트, 포인트 상점 (MVP 제외)
- 이모지 아이콘은 시안 그대로 — 운영 전 라이선스 아이콘으로 바꿀지 결정 필요
- 실기기(iOS · Android · 태블릿) 레이아웃 · 스크린리더 · 글자 확대 검증
