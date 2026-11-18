<h1 align="center">Produce Daengnyang · 프로듀스 댕냥</h1>

<p align="center">A photo audition for dogs and cats. Picks crown a weekly center, and a month-end final picks who debuts.</p>

<p align="center"><b>English</b> · <a href="README.ko.md">한국어</a></p>

---

> Work in progress. Track it in [the first-release issue (#10)](https://github.com/ESeungJun/produce-daengnyang/issues/10). The service and its docs are in Korean.

## How it works
1. Owners enter their pet's photo as a **trainee** (up to two entries per round).
2. Anyone gets **three picks a day on each board**, one per pet per day. Your first pick works without signing in.
3. Weekly rounds run on the 1st–7th, 8th–14th and 15th–21st. The winner becomes the **center**, and the top two go to the final.
4. The final runs from the 22nd to the end of the month. The winner **debuts**: it fills the front page all next month and links to the owner's social account.

## Built with
| Layer | Stack |
|---|---|
| UI | Next.js 16 (App Router) + TypeScript, CSS Modules + design tokens ([`shared/styles/tokens.css`](shared/styles/tokens.css)) |
| Hosting | Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare) |
| Data & auth | Supabase (Postgres rule functions with RLS, anonymous sign-in linked to Google, Storage, pg_cron) |
| Mail & push | Gmail SMTP, Web Push |

Design notes are in [docs/](docs/) (Korean).

## Development
```bash
npm install
cp .env.example .env.local      # add the Supabase URL and publishable key
npm run dev                     # http://localhost:3000
npm test                        # unit tests (Vitest)

# Local Supabase (needs Docker): sample data, photos and the database rule tests
npx supabase@3.2.0 start        # point .env.local at the local URL and key to see the sample data
bash supabase/seed-photos.sh    # upload the sample photos (CC0) to local Storage
npx supabase@3.2.0 test db      # pgTAP rule tests
npm run preview                 # preview on the Cloudflare runtime (needs .dev.vars)
npm run deploy                  # deploy to Cloudflare Workers
```

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key, safe for the browser |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public). Locally use the test key `1x00000000000000000000BB` |

For the local Supabase stack, put `SUPABASE_AUTH_CAPTCHA_SECRET=1x0000000000000000000000000000000AA` (Turnstile's public test secret) in `supabase/.env` so anonymous sign-in works.

## Branches
git flow: `main` for releases, `develop` for work. Features live on `feature/<issue>-<name>`, and commits end with `(#issue)`.

Built together with Claude Code.
