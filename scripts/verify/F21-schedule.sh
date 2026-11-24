#!/bin/bash
# F21 자정 작업·한 달 일정(SC-21). pgTAP 일정 시험만 돌린다(되돌리므로 DB 는 그대로). 시작 상태: 로컬 Supabase.
cd "$(dirname "$0")/../.." || exit 1
npx supabase test db supabase/tests/database/schedule.test.sql 2>&1 | tail -3 | sed "s/^/  /"; exit ${PIPESTATUS[0]}
