#!/usr/bin/env bash
# 로컬 Supabase Storage 에 시드 사진을 올린다(seed.sql 의 entry_photos 경로와 같은 이름).
# 사용: npx supabase@3.2.0 db reset 뒤에 bash supabase/seed-photos.sh
# 로컬 전용: status 에서 로컬 주소·서버 키를 읽는다. 원격 프로젝트에는 쓰지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."
# eval 대신 값만 뽑는다(출력에 명령이 섞여도 실행되지 않게).
status="$(npx -y supabase@3.2.0 status -o env 2>/dev/null)"
API_URL="$(printf '%s\n' "$status" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
SERVICE_ROLE_KEY="$(printf '%s\n' "$status" | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "로컬 주소가 아니에요: $API_URL" >&2; exit 1 ;; esac
owners=(00000000-0000-0000-0000-00000000aa01 00000000-0000-0000-0000-00000000aa02 00000000-0000-0000-0000-00000000aa03)
n=0
for o in "${owners[@]}"; do
  for f in supabase/seed-photos/*.webp; do
    name="seed-$(basename "$f")"
    curl -sf -X POST "$API_URL/storage/v1/object/entry-photos/$o/$name" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" \
      -H "Content-Type: image/webp" -H "x-upsert: true" --data-binary "@$f" >/dev/null
    n=$((n + 1))
  done
done
echo "시드 사진 ${n}장을 올렸어요"
