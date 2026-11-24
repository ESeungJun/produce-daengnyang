# 코드 규칙표

이 저장소의 코드 규칙마다 무엇이 막는지 적는다. 장치가 없으면 `글` 이라고 그대로 적는다.
`scripts/harness/check-rules.sh` 가 적힌 장치·시험 파일이 실제로 있는지, 장치에 시험이 있는지 확인한다(CI 에서도 돈다).

규칙이 생기는 곳은 세 군데다.
- **설계서**: `docs/설계서.md` "구조 규칙" 표(`S1`, `S2` …: 의존 방향, 모듈 경계, 금지 API). 출처 칸에 `설계서 S1` 처럼 ID 를 적는다. 빠진 ID 가 있으면 check-rules 가 실패한다. 구현 하네스를 깔 때 몇 개를 바로 장치로 만든다.
- **리뷰 지적**: review-all·사람 리뷰에서 같은 지적이 두 번 나오면 여기에 올린다.
- **사용자 지적**: 사용자가 같은 실수를 두 번 짚으면 여기에 올린다.

경로는 백틱으로 감싸고 `/` 나 `.` 이 들어가게 쓴다(예: `lint.config.js`, `tests/rule1.test.ts`). 칸 안에 세로선을 쓰려면 `\|`.

장치로 만드는 순서: 코드 구조·타입으로 아예 못 하게 → 린트 규칙 → 테스트 → CI → 그래도 판단이 필요하면 글.
새 장치는 **과거 실수를 시험으로 먼저 넣어 실패하는 것을 확인한 뒤** 만든다.

| 번호 | 규칙 | 출처 | 장치 | 시험 | 메모 |
|---|---|---|---|---|---|
| 1 | 한도·순위·주차가 걸린 쓰기는 DB 함수(RPC)로만, 테이블 직접 쓰기 금지 | 설계서 S1 | `supabase/migrations/20261117171855_rls.sql` | `supabase/tests/database/rules.test.sql` | RLS 가 직접 쓰기를 막고 pgTAP 가 확인한다(CI db 작업) |
| 2 | 색은 디자인 토큰으로만 쓴다(하드코딩 금지) | 설계서 S4 | `scripts/harness/check-tokens.sh` | `scripts/harness/tests/check-tokens.test.sh` | 토큰 원본·변수를 못 읽는 곳은 `scripts/harness/tokens.allow`. 기준선은 `shared/ui/page.module.css` 1곳(#37) |
| 3 | 기능 지도의 코드·확인 스크립트·시나리오가 실제로 있다 | qa-check | `scripts/harness/check-map.sh` | `scripts/harness/tests/check-map.test.sh` | 지도는 `docs/기능지도.md`, 확인 스크립트는 `scripts/verify/`. 지도 채우기는 keel D 단계(별도 이슈) |
| 4 | `shared/` 는 `features/`·`app/` 을 가져오지 않는다 | 설계서 S2 | 글 | | 2026-11-24 위반 0. 어기는 일이 생기면 eslint `no-restricted-imports` 로 옮긴다 |
| 5 | service_role 키는 Edge Function·로컬 스크립트에서만 | 설계서 S3 | 글 | | 2026-11-24 `app/`·`features/`·`shared/` 에 0곳. 배포 전 `scripts/deploy.sh` 의 check-build 가 빌드에 로컬 주소가 박히는 것만 막는다 |

메모
- 이 저장소의 린트·타입·시험은 원래 있던 `npm run lint`·`npm run typecheck`·`npm test`·E2E(Playwright)·pgTAP 를 그대로 쓴다. keel 검사는 기존 `.github/workflows/ci.yml` 의 `harness` 작업으로 더했다.

## 실수 기록

`mistake-guard` 스킬로 적는다. 같은 꼴이면 횟수만 올린다. 횟수가 2 이상이면 표 번호(위 표의 번호)나 `보류: 이유` 를 적는다. 비면 `check-rules.sh` 가 실패한다.

| 날짜 | 실수 | 어디서 발견 | 횟수 | 표 번호 |
|---|---|---|---|---|
