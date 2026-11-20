#!/usr/bin/env bash
# 운영 배포(#32). npm run deploy 가 부른다.
# NEXT_PUBLIC_* 값은 빌드 때 코드에 박히므로, 운영 값으로 빌드됐는지 확인한 뒤에만 배포한다.
# 2026-11-20 #31 배포 때 .env.local(로컬 Supabase) 값이 박혀 운영 전체가 500 이 된 일을 막는다.
# 1. 운영 값 파일(DEPLOY_ENV, 기본 .work/deploy-env.sh, git 제외)을 읽는다. 없으면 멈춘다
# 2. Supabase 주소가 https://<ref>.supabase.co 꼴이 아니면 멈춘다
# 3. .next·.open-next 를 지우고 빌드한다(dev 서버의 캐시가 섞이지 않게. 끝나면 dev 서버를 다시 띄운다)
# 4. scripts/check-build.sh 로 빌드 결과에 로컬 주소가 없고 운영 주소가 있는지 본다. 아니면 배포하지 않는다
# 5. 배포한다
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${DEPLOY_ENV:-.work/deploy-env.sh}"
if [ ! -f "$ENV_FILE" ]; then
  echo "배포 멈춤: 운영 값 파일 $ENV_FILE 이 없어요(NEXT_PUBLIC_SUPABASE_URL 등을 export 하는 파일)." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"
if [[ ! "${NEXT_PUBLIC_SUPABASE_URL:-}" =~ ^https://[a-z0-9]+\.supabase\.co$ ]]; then
  echo "배포 멈춤: NEXT_PUBLIC_SUPABASE_URL 이 운영 주소(https://<ref>.supabase.co)가 아니에요: ${NEXT_PUBLIC_SUPABASE_URL:-(비어 있음)}" >&2
  exit 1
fi

rm -rf .next .open-next
npx opennextjs-cloudflare build
bash scripts/check-build.sh "$NEXT_PUBLIC_SUPABASE_URL"
npx opennextjs-cloudflare deploy
