#!/usr/bin/env bash
# 스스로 서버 실행 스크립트 (sudo 없이 ciat 계정 홈에서) — 포켓 스도쿠(~/poke-sudoku)와 같은 방식
#   ~/sseuro/app.sh start | stop | restart | status | logs
# 폴더 구성:
#   ~/sseuro/app.jar     Spring Boot (API + 화면)
#   ~/sseuro/web/        화면 빌드 결과 (frontend/dist)
#   ~/sseuro/config/     application.yml (DB 비밀번호 등, 권한 600)
#   ~/sseuro/logs/       app.log (10MB 단위로 자동 교체)
#   Java 17: ~/sseuro/jre 가 있으면 그것, 없으면 포켓 스도쿠의 ~/poke-sudoku/jre 를 함께 쓴다
set -euo pipefail
HOME_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${SSEURO_PORT:-9091}"
if [ -x "$HOME_DIR/jre/bin/java" ]; then JAVA="$HOME_DIR/jre/bin/java"; else JAVA="$HOME/poke-sudoku/jre/bin/java"; fi
PID_FILE="$HOME_DIR/app.pid"
# 메모리 1GB 서버에서 포켓 스도쿠(힙 256MB)와 함께 돌아가므로 더 작게: 힙 192MB
JAVA_OPTS="-Xms64m -Xmx192m -Xss512k -XX:MaxMetaspaceSize=160m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Duser.timezone=Asia/Seoul -Dfile.encoding=UTF-8"

running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

start() {
  if running; then echo "이미 실행 중 (pid $(cat "$PID_FILE"))"; return 0; fi
  mkdir -p "$HOME_DIR/logs"
  cd "$HOME_DIR"
  nohup "$JAVA" $JAVA_OPTS -jar "$HOME_DIR/app.jar" \
    --spring.profiles.active=server \
    --spring.config.additional-location="file:$HOME_DIR/config/" \
    >"$HOME_DIR/logs/console.log" 2>&1 &
  echo $! >"$PID_FILE"
  echo "시작함 (pid $!) — 준비될 때까지 20~40초"
  for i in $(seq 1 60); do
    if curl -fs "http://127.0.0.1:$PORT/api/health" | grep -q UP; then echo "준비 완료: http://127.0.0.1:$PORT"; return 0; fi
    running || { echo "시작 실패 — logs/console.log 확인"; tail -30 "$HOME_DIR/logs/console.log"; return 1; }
    sleep 2
  done
  echo "아직 준비 안 됨 — logs/app.log 확인"
}

stop() {
  if ! running; then echo "실행 중 아님"; rm -f "$PID_FILE"; return 0; fi
  kill "$(cat "$PID_FILE")"
  for i in $(seq 1 30); do running || break; sleep 1; done
  running && kill -9 "$(cat "$PID_FILE")" || true
  rm -f "$PID_FILE"
  echo "멈춤"
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) if running; then echo "실행 중 (pid $(cat "$PID_FILE"))"; curl -fs "http://127.0.0.1:$PORT/api/health" || true; echo; else echo "멈춰 있음"; fi ;;
  logs) tail -n 100 -f "$HOME_DIR/logs/app.log" ;;
  *) echo "사용법: $0 start|stop|restart|status|logs"; exit 1 ;;
esac
