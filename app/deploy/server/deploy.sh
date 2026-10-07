#!/usr/bin/env bash
# 개발 PC 에서 실행: 빌드 · 테스트 → 서버(203.245.30.73, ciat)에 올리기 → 재시작
#   bash app/deploy/server/deploy.sh
# 포켓 스도쿠와 같은 서버 · 같은 접속 키(~/.ssh/poke_deploy)를 쓴다. 서버 폴더는 ~/sseuro, 포트 9092
set -euo pipefail
cd "$(dirname "$0")/../.."   # app/
HOST="ciat@203.245.30.73"
PORT=9092
K=(-i "$HOME/.ssh/poke_deploy" -o BatchMode=yes)

echo "▶ 화면 빌드"
(cd frontend && npm test && npm run build)

echo "▶ 서버(API) 빌드"
if [[ "${OS:-}" == "Windows_NT" ]]; then
  # 이 PC 는 JDK 소켓용 임시 경로가 짧아야 Gradle 이 동작한다
  export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=D:/99_DEV/tmp -Djava.io.tmpdir=D:/99_DEV/tmp"
  (cd backend && cmd //c "gradlew.bat test bootJar --console=plain")
else
  (cd backend && ./gradlew test bootJar --console=plain)
fi

echo "▶ 올리기"
ssh "${K[@]}" "$HOST" 'mkdir -p ~/sseuro/config ~/sseuro/logs'
if ! ssh "${K[@]}" "$HOST" 'test -f ~/sseuro/config/application.yml'; then
  echo "⚠ 서버에 ~/sseuro/config/application.yml 이 없어요."
  echo "  app/deploy/server/application.yml.example 을 복사해 DB 비밀번호를 채운 뒤(chmod 600) 다시 실행해 주세요."
  exit 1
fi
tar -czf web.tgz -C frontend/dist .
scp "${K[@]}" -q backend/build/libs/sseuro-api-0.1.0.jar "$HOST:sseuro/app.jar.new"
scp "${K[@]}" -q web.tgz "$HOST:sseuro/web.tgz"
scp "${K[@]}" -q deploy/server/app.sh "$HOST:sseuro/app.sh"
rm -f web.tgz

echo "▶ 교체 · 재시작"
ssh "${K[@]}" "$HOST" 'set -e; cd ~/sseuro
  sed -i "s/\r$//" app.sh; chmod +x app.sh
  rm -rf web.new && mkdir web.new && tar -xzf web.tgz -C web.new && rm web.tgz
  ./app.sh stop
  mv app.jar app.jar.bak 2>/dev/null || true; mv app.jar.new app.jar
  rm -rf web.bak; mv web web.bak 2>/dev/null || true; mv web.new web
  ./app.sh start'
echo "✅ 완료: http://203.245.30.73:$PORT"
