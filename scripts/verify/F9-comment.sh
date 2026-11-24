#!/bin/bash
# F9 응원 댓글(SC-10). 시작 상태: 열린 주간 라운드(없으면 건너뜀 3).
bash "$(dirname "$0")/_e2e.sh" "${1:-}" e2e/flows.spec.ts "응원 댓글"
