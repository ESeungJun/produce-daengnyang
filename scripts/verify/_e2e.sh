#!/bin/bash
# 확인 스크립트 공통: 기존 Playwright E2E 중 고른 시험만 돌린다(scripts/verify/F*.sh 가 부른다). 이 파일은 F 로 시작하지 않아 "전부 돌리기"에서 빠진다.
# 사용: bash scripts/verify/_e2e.sh <캡처 폴더|""> <spec 파일> [시험 이름 정규식]
# 시작 상태: 로컬 Supabase(npx supabase start, seed.sql·seed-photos.sh), 개발 서버 localhost:3104(E2E_PORT 로 바꿈). 운영에는 돌지 않는다(global-setup 이 막음).
# 끝 코드: 0 통과 · 1 실패 · 3 모두 건너뜀(주간 투표가 없는 21일·결선 기간 등, 이유를 출력)
set -u
out="${1:-}"; case "$out" in ""|/*) ;; *) out="$PWD/$out" ;; esac
spec="$2"; grep_re="${3:-}"
cd "$(dirname "$0")/../.." || exit 1   # spec 경로는 저장소 최상위 기준
[ -n "$out" ] && { mkdir -p "$out"; export E2E_SHOTS_DIR="$out"; }
args=("$spec" --reporter=list)
[ -n "$grep_re" ] && args+=(-g "$grep_re")
log=$(npx playwright test "${args[@]}" 2>&1); code=$?
printf '%s\n' "$log" | grep -E "✓|✘|-  |passed|failed|skipped|Error:" | sed 's/^/  /'
[ $code -ne 0 ] && { echo "실패: $spec ${grep_re}"; exit 1; }
if printf '%s' "$log" | grep -qE '[0-9]+ passed'; then exit 0; fi
if printf '%s' "$log" | grep -qE '[0-9]+ skipped'; then
  echo "건너뜀: $spec ${grep_re} (열린 주간 라운드·데뷔 글 같은 시작 상태가 없어요)"; exit 3
fi
echo "실패: 돈 시험이 없어요($spec ${grep_re})"; exit 1
