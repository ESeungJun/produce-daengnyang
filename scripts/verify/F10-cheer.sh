#!/bin/bash
# F10 응원단 + F1 로그인 시트(SC-12). 시작 상태: 주간 센터 글과 그 달 결선(결선이 열렸으면 시험 동안만 미룸, 로컬 DB 만).
bash "$(dirname "$0")/_e2e.sh" "${1:-}" e2e/cheer.spec.ts
