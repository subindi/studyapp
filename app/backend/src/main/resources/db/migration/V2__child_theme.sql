-- 아이별 화면 테마 (색 · 캐릭터 · 배경만 바뀐다. 기록 · 설정 · 정책과 무관)
-- dragon: 아기 용(기본) · capybara: 카피바라 초록 쉼터 · seal: 물범 작은 바다
ALTER TABLE ss_child ADD COLUMN theme VARCHAR(20) NOT NULL DEFAULT 'dragon';
