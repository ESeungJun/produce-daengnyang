#!/bin/bash
# F4 이름 검색 · F5 가림 기간(SC-06·07). 시작 상태: 열린 주간 라운드(없으면 건너뜀 3).
bash "$(dirname "$0")/_e2e.sh" "${1:-}" e2e/flows.spec.ts "이름 검색|가림 기간"
