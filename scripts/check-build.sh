#!/usr/bin/env bash
# 빌드 결과 검사(#32). scripts/deploy.sh 가 배포 직전에 부른다. 인자: 운영 Supabase 주소.
# 서버 묶음(handler.mjs)에 로컬 주소가 하나라도 있거나 운영 주소가 없으면 1 로 끝난다.
set -euo pipefail
cd "$(dirname "$0")/.."
want="${1:?운영 Supabase 주소를 인자로 주세요}"
handler="${CHECK_HANDLER:-.open-next/server-functions/default/handler.mjs}"
[ -f "$handler" ] || { echo "검사 멈춤: 빌드 결과 $handler 가 없어요." >&2; exit 1; }
if grep -qE '127\.0\.0\.1:54321|localhost:54321' "$handler"; then
  echo "배포 멈춤: 빌드에 로컬 Supabase 주소가 들어갔어요(.env.local 값). 운영 값으로 다시 빌드해요." >&2
  exit 1
fi
if ! grep -qF "$want" "$handler"; then
  echo "배포 멈춤: 빌드에 운영 Supabase 주소($want)가 없어요." >&2
  exit 1
fi
echo "빌드 검사 통과: 로컬 주소 0곳, 운영 주소 있음"
