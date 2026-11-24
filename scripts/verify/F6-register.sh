#!/bin/bash
# F6 등록·임시 저장 · F7 사진 잠금(SC-08·09). 시작 상태: 열린 주간 라운드(없으면 건너뜀 3).
# 사용: bash scripts/verify/F6-register.sh [캡처 폴더]. 하나라도 실패면 1, 하나라도 통과면 0, 모두 건너뛰면 3.
d=$(dirname "$0"); pass=0; fail=0
bash "$d/_e2e.sh" "${1:-}" e2e/flows.spec.ts "연습생 등록|등록 임시 저장"; case $? in 0) pass=1 ;; 3) ;; *) fail=1 ;; esac
bash "$d/_e2e.sh" "${1:-}" e2e/concurrency.spec.ts "사진 바꾸기와 첫 픽"; case $? in 0) pass=1 ;; 3) ;; *) fail=1 ;; esac
[ $fail = 1 ] && exit 1; [ $pass = 1 ] && exit 0; exit 3
