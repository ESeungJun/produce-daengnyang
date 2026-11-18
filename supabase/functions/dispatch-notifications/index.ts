/**
 * dispatch-notifications (#7, 설계서 4-4 5번)
 * 결과 알림(center·finalist·debut)을 메일(Resend)과 웹 푸시로 보낸다. 알림함 줄은 결과 확정 때 DB 가 이미 넣었다.
 * 부르는 곳: DB 의 kick_dispatch()(매일 0시 자정 작업, 관리자 다시 계산) → pg_net → 이 함수. 사용자 토큰이 없으므로
 *   게이트웨이 JWT 확인은 끄고(verify_jwt false), 헤더 x-dispatch-token 을 DB 의 dispatch_token_ok() 로 확인한다.
 * 1. 토큰 확인. 틀리면 401.
 * 2. dispatch_queue(): 최근 3일 결과 알림 중 메일·푸시를 아직 못 보낸 것(메일 주소 포함).
 * 3. 메일: RESEND_API_KEY·MAIL_FROM 이 없으면 건너뛴다(표시하지 않아 설정 뒤 다음 실행 때 보낸다).
 *    알림 번호로 Idempotency-Key 를 붙여 두 번 불려도 한 통만 간다. 메일 주소가 없는 계정은 "보냄"으로 표시한다.
 * 4. 푸시: VAPID 키가 없으면 건너뛴다. 구독마다 보내고, 410·404(구독 끝남)면 그 구독을 지운다.
 *    구독이 없거나 한 곳이라도 받았거나 모두 끝난 구독이면 "보냄"으로 표시한다. 일시 오류만 남겨 다음 실행 때 다시 보낸다.
 * 5. 보낸 표시는 mark_dispatched(). 표시가 실패하면 500(다음 실행 때 다시 보낼 수 있음). 알림함 줄은 그대로다.
 * 메일은 550ms 간격으로 보낸다(Resend 기본 초당 2통).
 * 비밀값: RESEND_API_KEY, MAIL_FROM("프로듀스 댕냥 <알림@도메인>"), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(mailto:…), SITE_URL.
 */
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";
import { noticeView } from "../_shared/notice.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "http://localhost:3104").replace(/\/$/, "");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";
const pushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (pushReady) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

type Row = { id: number; user_id: string; kind: string; payload: unknown; email: string | null; need_email: boolean; need_push: boolean };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** 메일 본문. 사용자 글(이름)은 HTML 로 넣기 전에 바꾼다. 색은 토큰 --pd-ink #141414 · --pd-ink-2 #5F5F5F(메일 앱은 CSS 변수를 못 읽어 값을 적는다). */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function mailHtml(text: string, link: string): string {
  return `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#141414;background:#ffffff">
<p style="font-size:13px;color:#5F5F5F;margin:0 0 8px">프로듀스 댕냥</p>
<p style="font-size:18px;font-weight:700;line-height:1.5;margin:0 0 20px">${escapeHtml(text)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#141414;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">결과 보러 가기</a></p>
<p style="font-size:12px;color:#5F5F5F;line-height:1.6;margin:0">1·2위에 오른 글의 주인에게만 결과가 나올 때 보내요. 알림은 사이트의 내 정보에서도 볼 수 있어요.</p>
</div>`;
}

async function sendMail(r: Row): Promise<boolean> {
  const { text, href } = noticeView(r.kind, r.payload);
  const link = `${SITE_URL}${href ?? "/me"}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `pd-notice-${r.id}` },
    body: JSON.stringify({ from: MAIL_FROM, to: [r.email], subject: text, html: mailHtml(text, link), text: `${text}\n\n${link}` }),
  }).catch(() => null);
  if (!res) return false;
  await res.body?.cancel();
  return res.ok;
}

/** 이 사람의 모든 구독에 보낸다. 다시 시도할 필요가 없으면 true. */
async function sendPush(r: Row): Promise<boolean> {
  const { data: subs, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", r.user_id);
  if (error) return false;
  if (!subs?.length) return true;
  const { text, href } = noticeView(r.kind, r.payload);
  const body = JSON.stringify({ title: "프로듀스 댕냥", body: text, url: href ?? "/me", tag: `pd-notice-${r.id}` });
  let delivered = 0;
  let gone = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 });
      delivered++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        gone++;
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
  return delivered > 0 || gone === subs.length;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // 1. 토큰 확인(값은 DB 안에서만 비교한다)
  const token = req.headers.get("x-dispatch-token") ?? "";
  // 토큰은 64자 16진수. 모양이 다르면 DB 를 부르기 전에 끊는다(공개 주소라 두드리는 비용을 줄인다)
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "unauthorized" }, 401);
  const ok = await admin.rpc("dispatch_token_ok", { p_token: token });
  if (ok.error || ok.data !== true) return json({ error: "unauthorized" }, 401);

  // 2. 보낼 거리
  const { data, error } = await admin.rpc("dispatch_queue", { p_limit: 100 });
  if (error) return json({ error: "queue_failed" }, 500);
  const rows = (data ?? []) as Row[];

  // 3. 메일
  const mailed: number[] = [];
  if (RESEND_API_KEY && MAIL_FROM) {
    for (const r of rows.filter((x) => x.need_email)) {
      if (!r.email) {
        mailed.push(r.id);
        continue;
      }
      if (await sendMail(r)) mailed.push(r.id);
      await new Promise((ok) => setTimeout(ok, 550)); // Resend 기본 속도 제한(초당 2통)에 걸리지 않게
    }
  }

  // 4. 푸시
  const pushed: number[] = [];
  if (pushReady) {
    for (const r of rows.filter((x) => x.need_push)) {
      if (await sendPush(r)) pushed.push(r.id);
    }
  }

  // 5. 보낸 표시
  // 표시를 못 하면 다음 실행 때 한 번 더 갈 수 있으니 오류로 남긴다
  const marks = await Promise.all([
    mailed.length ? admin.rpc("mark_dispatched", { p_ids: mailed, p_channel: "email" }) : null,
    pushed.length ? admin.rpc("mark_dispatched", { p_ids: pushed, p_channel: "push" }) : null,
  ]);
  if (marks.some((m) => m?.error)) {
    console.error(`dispatch-notifications: 보낸 표시 실패 mailed=${mailed.length} pushed=${pushed.length}`);
    return json({ error: "mark_failed" }, 500);
  }
  const result = { queued: rows.length, mailed: mailed.length, pushed: pushed.length, mail_ready: !!(RESEND_API_KEY && MAIL_FROM), push_ready: pushReady };
  console.log(`dispatch-notifications: ${JSON.stringify(result)}`);
  return json(result);
});
