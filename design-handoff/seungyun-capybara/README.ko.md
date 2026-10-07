# 승윤이와 카피바라의 초록 쉼터 · Claude 전달 파일

## 사용 방법
- Claude Code: ZIP을 풀어 저장소의 design-handoff/seungyun-capybara/에 두고 CLAUDE_START.ko.txt의 내용을 요청한다.
- 일반 Claude 대화: ZIP 업로드가 지원되지 않으면 압축을 풀고 images/approved-concept.png와 CLAUDE_HANDOFF.ko.txt를 첨부한다. 요청문은 CLAUDE_START.ko.txt를 복사한다.
- 로컬 확인: preview.html을 브라우저로 연다.

## 포함 파일
- images/approved-concept.png: 사용자 선호가 확인된 전체 시안 원본
- DESIGN_GUIDE.ko.md: 화면·캐릭터·반응형·상태·검수 규칙
- tokens.json / theme.css: 제안 색상과 UI 수치
- assets-needed.json: 추가 제작할 분리 자산 목록
- CLAUDE_START.ko.txt: 개발 시작 요청문
- CLAUDE_HANDOFF.ko.txt: 일반 대화에 첨부할 텍스트 통합본
- CLAUDE.md: 개발 에이전트용 안내
- preview.html: 시안과 색상 확인용 정적 페이지

현재는 디자인 인계 패키지이며 완성 앱, Figma 편집 원본, 개별 투명 캐릭터 파일 세트가 아니다. 구체적인 에셋 제공 범위는 디자인 가이드를 확인한다.

## 추가 제공: 표정 9종
EMOTIONS_GUIDE.ko.md와 emotions-preview.html을 확인한다. 투명 PNG 아틀라스·CSS·상태 JSON을 포함한다.

스킨 속 표정 전환은 skin-emotions-demo.html을 열어 확인할 수 있다. 실제 학습 데이터와 연결하지 않은 디자인 데모다.
