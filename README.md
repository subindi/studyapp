# 스스로 · 디자인 및 개발 인계 패키지

작성일: 2026-10-07 / 버전: 디자인 시안 v1.0

## 먼저 보기

압축을 풀고 `index.html`을 Chrome 또는 Edge에서 열어 주세요.
각 화면의 하단 선택 메뉴에서 승윤·시윤·부모 또는 상태별 화면을 전환할 수 있습니다.
부모 PIN 체험값은 1234이며, 처음 시작 화면에서 설정한 경우 해당 파일 안에서는 새 PIN을 사용합니다.

## 파일 구성

- `designs/01-core-flow.html`: 아이·부모의 핵심 학습 흐름. 브라우저에서 실행 가능.
- `designs/02-start-and-states.html`: 초기 설정, PIN, 예외·저장 상태, 알림·성장, 태블릿.
- `designs/03-parent-desktop.html`: 부모 PC 관리 화면.
- `source/`: 위 시안의 편집 가능한 HTML/CSS/JavaScript 원본. Claude 개발 시 참고할 소스.
- `docs/`: 정책, 화면 목록, 디자인 규칙, 개발 시작 요청문.
- `CLAUDE.md`: Claude Code에 전달할 프로젝트 안내.
- `CLAUDE_UPLOAD.txt`: 일반 Claude 대화에 한 번에 업로드하기 위한 정책·개발 안내·원본 소스 묶음.

## 완료 범위와 한계

핵심 화면과 주요 예외 화면의 인터랙션 디자인을 정리한 개발 참고 시안입니다.
로그인, 서버 저장, 부모 권한 검증, 실제 알림, 반복 일정 자동 생성, 실제 다른 앱 제한은 연결되어 있지 않습니다.
시안은 각 파일 안의 임시 데이터로 동작하며 파일 간 상태가 공유되지 않습니다. 새로 열면 초기화됩니다.
시안에 등장하는 주간 기록은 화면 설명용 예시이고, 실제 시윤·승윤의 활동 기록이 아닙니다.
여러 시안의 임시 동작에 차이가 있을 경우 `docs/01-product-policy.md`에 정리한 구현 규칙을 따르고 미정 항목을 확인하세요.
태블릿·PC는 반응형 배치가 포함되어 있습니다. 실제 기기에서 레이아웃·접근성·브라우저 호환성을 검증해야 합니다.
독립 HTML에는 화면 전환을 위한 실행 코드가 포함됩니다. 이미지 파일이나 Figma 원본은 아닙니다.

## Claude와 이어서 개발하기

### 일반 Claude 대화 / 프로젝트

1. ZIP 압축을 해제합니다.
2. `CLAUDE_UPLOAD.txt`를 첨부합니다. 일반 업로드 형식에 맞춘 TXT입니다.
3. `docs/04-claude-start.txt` 내용을 요청문으로 붙여넣습니다.
4. 화면이 필요하면 `designs/` HTML을 브라우저에서 열고 캡처를 추가로 첨부합니다.
   HTML 소스는 제공되지만, 일반 문서 업로드가 화면을 브라우저처럼 자동 실행하는 것은 아닙니다.

### Claude Code

압축을 푼 폴더를 Claude Code에서 작업 폴더로 열고 `CLAUDE.md`부터 읽도록 요청하세요.
이 폴더에는 디자인 참고 소스만 있으며 실제 앱의 프로젝트는 아직 생성되지 않았습니다.
개발 코드는 `app/` 아래 새로 만들고 `source/`와 `designs/`를 원본으로 보존합니다.
처음에는 화면 구현과 정책 테스트부터 하고, 이후 인증·데이터 저장을 연결합니다.

### GitHub를 통한 인계

계속 디자인과 개발을 나눠 진행한다면 이 패키지와 앱 코드를 한 저장소에 두고 버전 관리합니다.
Claude의 GitHub 연결은 저장소를 개발 문맥으로 제공하는 용도로 사용할 수 있습니다.
ChatGPT 대화가 Claude로 자동 동기화되는 방식은 아니므로 정책 변경을 문서에 기록합니다.

공식 안내 (2026-10-07 확인):
- 파일 업로드: https://support.claude.com/en/articles/8241126-upload-files-to-claude
- Claude Code: https://code.claude.com/docs/en/overview
- GitHub 연결: https://support.claude.com/en/articles/10167454-use-the-github-integration
