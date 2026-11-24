#!/bin/bash
# F14 데뷔 화보(SC-15). 시작 상태: 데뷔한 글(seed.sql 의 지난달 결선 결과). 사진 더하고 빼기는 열린 주간 라운드도 있어야 해요.
# 사용: bash scripts/verify/F14-debut.sh [캡처 폴더]. 하나라도 실패면 1, 하나라도 통과면 0, 모두 건너뛰면 3.
d=$(dirname "$0"); pass=0; fail=0
bash "$d/_e2e.sh" "${1:-}" e2e/debut-media.spec.ts ""; case $? in 0) pass=1 ;; 3) ;; *) fail=1 ;; esac
bash "$d/_e2e.sh" "${1:-}" e2e/flows.spec.ts "데뷔 화보"; case $? in 0) pass=1 ;; 3) ;; *) fail=1 ;; esac
[ $fail = 1 ] && exit 1; [ $pass = 1 ] && exit 0; exit 3
