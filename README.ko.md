<h1 align="center">프로듀스 댕냥</h1>

<p align="center">강아지·고양이 사진 오디션 웹앱이에요. 매주 픽으로 센터를 뽑고, 월말 결선에서 데뷔해요.</p>

<p align="center"><a href="README.md">English</a> · <b>한국어</b></p>

---

> 지금은 만드는 중이에요. 진행 상황은 [1차 출시 이슈(#10)](https://github.com/ESeungJun/produce-daengnyang/issues/10)에서 볼 수 있어요.

## 어떻게 돌아가나
1. 집사가 우리 애 사진을 올려 **연습생**으로 등록해요(라운드마다 2번까지).
2. 누구나 게시판마다 **하루 3픽**을 해요. 같은 아이는 하루 한 번이고, 로그인하지 않아도 첫 픽은 할 수 있어요.
3. 매달 1~7일, 8~14일, 15~21일 주간전에서 1위가 **센터**가 되고, 1·2위는 결선에 올라가요.
4. 22일부터 말일까지 결선에서 1위가 **데뷔**해요. 다음 달 내내 사이트 첫 화면에 걸리고, 누르면 주인 SNS로 가요.

## 기술
| 층 | 쓰는 것 |
|---|---|
| 화면 | Next.js 16(App Router) + TypeScript, CSS Modules + 디자인 토큰([`shared/styles/tokens.css`](shared/styles/tokens.css)) |
| 배포 | Cloudflare Workers([OpenNext](https://opennext.js.org/cloudflare)) |
| 데이터·로그인 | Supabase(Postgres 규칙 함수·RLS, 익명 로그인 → 구글 연결, Storage, pg_cron) |
| 메일·푸시 | Resend, Web Push |

왜 이렇게 골랐는지는 [설계서](docs/설계서.md)에, 구성도와 흐름도는 [구현도](docs/구현도.md)에 있어요.

## 개발
```bash
npm install
cp .env.example .env.local      # Supabase URL·publishable 키 넣기
npm run dev                     # http://localhost:3000
npm test                        # 단위 시험(Vitest)

# 로컬 Supabase(도커 필요): 예시 데이터와 사진까지 넣고 DB 규칙 시험
npx supabase@3.2.0 start        # .env.local 을 로컬 주소·키로 바꾸면 화면이 예시 데이터로 떠요
bash supabase/seed-photos.sh    # 예시 사진(CC0)을 로컬 Storage 에 올리기
npx supabase@3.2.0 test db      # pgTAP 규칙 시험
npm run preview                 # Cloudflare 런타임으로 미리보기(.dev.vars 필요)
npm run deploy                  # Cloudflare Workers 배포
```

| 환경 변수 | 뜻 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 주소 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저에 나가도 되는 publishable 키 |

## 문서
[기획서](docs/기획서.md) · [디자인 시스템](docs/design/DESIGN_SYSTEM.md) · [설계서](docs/설계서.md) · [구현도](docs/구현도.md) · [결정기록](docs/결정기록.md)

## 브랜치
git flow를 써요. `main`은 릴리스, `develop`은 작업 브랜치예요. 기능은 `feature/<이슈번호>-<이름>`에서 만들고, 커밋 끝에 `(#번호)`를 붙여요.

Claude Code와 함께 만들었어요.
