#!/bin/bash
# F3 픽 + F1 로그인 시트(SC-02·03·04). 시작 상태: 로컬 Supabase·개발 서버, 열린 주간 라운드(없으면 건너뜀 3).
# 사용: bash scripts/verify/F3-pick.sh [캡처 폴더]. 하나라도 실패면 1, 하나라도 통과면 0, 모두 건너뛰면 3.
d=$(dirname "$0"); pass=0; fail=0
bash "$d/_e2e.sh" "${1:-}" e2e/flows.spec.ts "손님 첫 1픽|로그인 시트에서 닫지 않고"; case $? in 0) pass=1 ;; 3) ;; *) fail=1 ;; esac
bash "$d/_e2e.sh" "${1:-}" e2e/concurrency.spec.ts "동시에 6번 픽"; case $? in 0) pass=1 ;; 3) ;; *) fail=1 ;; esac
[ $fail = 1 ] && exit 1; [ $pass = 1 ] && exit 0; exit 3
