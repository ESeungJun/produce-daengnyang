// 프로듀스 댕냥 구현도 그림 스펙 (doc-diagrams)
// 렌더: node ~/.claude/skills/doc-diagrams/scripts/render.mjs docs/diagrams/구현도.mjs docs/images
// 설계서·코드가 바뀌면 이 스펙을 같이 고치고 다시 렌더한다.

export default [
  {
    name: "architecture",
    type: "arch",
    title: "① 전체 구성도",
    sub: "번호 = 요청 순서 · 응답은 같은 길을 거꾸로",
    labels: { new: "이번에 만드는 것", base: "사용자·외부 계정", infra: "인프라·외부 서비스" },
    top: [
      { icon: "user", title: "국민 집사님", sub: "구경 · 픽 · 등록 · 댓글", kind: "base" },
      { icon: "chrome", title: "브라우저 · PWA", sub: "홈 화면 설치 · 푸시 수신", kind: "base", link: { label: "열기" } },
      { icon: "cloudflare", title: "Cloudflare Workers", sub: "OpenNext · 캐시", kind: "infra", link: { label: "① HTTPS" }, down: "② 화면 · 서버 함수" },
    ],
    group: {
      title: "Next.js 앱 (App Router · TypeScript)",
      cols: 3,
      modules: [
        ["star", "메인 · 표지", "get_featured<br>데뷔 · 센터 · 후보"],
        ["list", "게시판 · 검색", "board_entries<br>인기 · 최신 · 섞어 보기 · 이름"],
        ["check", "픽", "cast_pick RPC<br>얼굴 버튼 · 남은 픽"],
        ["login", "로그인", "익명 → 구글 연결<br>로그인 시트"],
        ["page2", "연습생 등록 · 내 글", "사진 1~3장 · 임시 저장<br>create · update · delete_entry"],
        ["comment", "댓글", "add_comment<br>100자 · 로그인만"],
        ["bell", "알림함 · 푸시 구독", "notifications<br>service worker"],
        ["shield", "관리자", "신고 처리 · 숨김<br>결과 재계산"],
        ["screen", "공유 미리보기", "next/og<br>글마다 이미지"],
      ],
    },
    right: [
      {
        title: "Supabase",
        label: "③ RPC · 읽기",
        items: [
          ["supabase", "Postgres", "규칙 함수 · RLS"],
          ["db", "Storage", "사진 WebP"],
          ["clock", "pg_cron", "00:00 KST 확정"],
          ["fn", "Edge Functions", "알림 발송 · 익명 합치기"],
        ],
      },
      {
        title: "비밀값",
        label: "이름만",
        items: [["key", "비밀값 저장소", "서버 키 · 메일 키 · 푸시 키"]],
      },
    ],
    bottom: {
      label: "④ 외부 서비스",
      items: [
        ["google", "구글 로그인", "OAuth"],
        ["cloudflare", "Turnstile", "봇 확인", "infra"],
        ["resend", "Resend", "1위 · 결선 메일", "infra"],
        ["bell", "Web Push", "브라우저 푸시(VAPID)", "infra"],
      ],
    },
  },

  {
    name: "pick-flow",
    type: "seq",
    title: "② 픽 요청 흐름 — 비로그인 첫 픽부터 로그인 뒤 픽까지",
    parts: [
      { id: "user", title: "사용자", sub: "친구 링크로 처음 옴", icon: "user", kind: "base" },
      { id: "web", title: "브라우저 · Next.js", sub: "얼굴 픽 버튼", icon: "next", kind: "new" },
      { id: "auth", title: "Supabase Auth", sub: "익명 · 구글", icon: "supabase", kind: "infra" },
      { id: "google", title: "구글", sub: "OAuth", icon: "google", kind: "base" },
      { id: "db", title: "Postgres 함수", sub: "cast_pick", icon: "db", kind: "new" },
    ],
    items: [
      { sec: "1. 비로그인 첫 픽" },
      { m: ["user", "web"], t: "강아지 얼굴 픽 누름" },
      { m: ["web", "auth"], t: "익명 로그인 + Turnstile 토큰" },
      { m: ["auth", "web"], t: "익명 세션", ret: 1 },
      { m: ["web", "db"], t: "cast_pick(두부)" },
      { note: ["auth", "db"], t: "잠금 → 익명 오늘 0픽 확인 → 저장" },
      { m: ["db", "web"], t: "완료 · 익명 남은 픽 0", ret: 1 },
      { m: ["web", "user"], t: "\"로그인하면 3픽\" 안내", ret: 1 },
      { sec: "2. 두 번째 픽" },
      { m: ["user", "web"], t: "짱구 픽 누름" },
      { note: ["web", "db"], t: "익명 한도 다 씀 → 서버까지 안 보내고 시트", k: "skip" },
      { m: ["web", "user"], t: "로그인 시트", ret: 1 },
      { sec: "3. 구글로 계속하기" },
      { m: ["user", "web"], t: "구글로 계속하기" },
      { m: ["web", "auth"], t: "linkIdentity(google)" },
      { m: ["auth", "google"], t: "OAuth 동의" },
      { m: ["google", "auth"], t: "승인", ret: 1 },
      { note: ["auth", "db"], t: "같은 사용자 번호 → 첫 픽이 그대로 이어짐\n이미 가입된 계정이면 merge-anon이 옮김" },
      { m: ["auth", "web"], t: "정식 세션", ret: 1 },
      { m: ["web", "db"], t: "cast_pick(짱구)" },
      { m: ["db", "web"], t: "완료 · 강아지 남은 픽 1", ret: 1 },
      { m: ["web", "user"], t: "픽 완료 · 얼굴 1개 남음", k: "ok" },
    ],
  },

  {
    name: "jobs",
    type: "flow",
    title: "③ 예약 작업 흐름",
    sub: "모두 Supabase 안에서 돈다 · 시각은 한국 시간",
    lanes: [
      {
        name: "결과 확정",
        when: "매일 00:00 · pg_cron · finalize_due_rounds",
        icon: "clock",
        steps: [
          ["start", "끝난 라운드 찾기"],
          ["q", "확정할 라운드가 있나?", ["skip", "없음", "아무것도 안 함 · 내일 다시"]],
          ["step", "게시판마다 다시 세기<br>동점은 먼저 도달한 글"],
          ["step", "1위 센터 · 데뷔<br>1·2위 결선 진출"],
          ["db", "round_results<br>notifications"],
          ["step", "pg_net으로 알림 발송 깨우기"],
        ],
        recv: "메인 표지 · 배너 · 1위 주인 알림함",
      },
      {
        name: "알림 발송",
        when: "확정 직후 · Edge Function · dispatch-notifications",
        icon: "bell",
        steps: [
          ["start", "안 보낸 알림 모으기"],
          ["q", "메일 받기 동의?", ["skip", "안 함", "알림함에만 남음"]],
          ["step", "Resend 메일", ["err", "실패", "보낸 시각 비움 · 다음 실행에 다시"]],
          ["q", "푸시 구독 있음?", ["skip", "없음", "메일 · 알림함만"]],
          ["step", "Web Push", ["err", "구독 만료", "구독 지움"]],
          ["db", "emailed_at · pushed_at"],
        ],
        recv: "1위 주인 메일함 · 폰",
      },
      {
        name: "결선 준비",
        when: "매달 22일 00:00 · prepare_final",
        icon: "star",
        steps: [
          ["start", "이번 달 결선 진출 글"],
          ["q", "지워졌거나 숨겨졌나?", ["loop", "그렇다", "그 라운드 3위가 이어받음"]],
          ["step", "결선 라운드로 복사<br>게시판마다 6마리"],
          ["db", "entries(결선)"],
        ],
        recv: "데뷔 평가 화면",
      },
      {
        name: "달 라운드 만들기",
        when: "매달 1일 00:00 · ensure_month_rounds",
        icon: "calendar",
        steps: [
          ["start", "그달 라운드 확인"],
          ["q", "이미 있나?", ["skip", "있음", "건너뜀(여러 번 돌아도 같음)"]],
          ["step", "주간 3개(1~7 · 8~14 · 15~21)<br>결선 1개(22~말일)"],
          ["db", "rounds"],
        ],
        recv: "게시판 · 카운트다운 띠",
      },
    ],
  },
];
