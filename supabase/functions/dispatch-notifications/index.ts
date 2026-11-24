/**
 * dispatch-notifications (#7, 설계서 4-4 5번)
 * 결과 알림(center·finalist·debut)을 메일(Gmail SMTP)과 웹 푸시로, 응원단·센터 성과 알림(final_open·center_report, #39)은 푸시로만 보낸다.
 * 알림함 줄은 DB 가 이미 넣었다(메일을 안 보낼 줄은 넣을 때 emailed_at 을 채운다).
 * 부르는 곳: DB 의 kick_dispatch()(매일 0시 자정 작업, 아침 9시 0·10·20분 pd-morning-push(#42·#44), 관리자 다시 계산) → pg_net → 이 함수.
 *   응원단·센터 성과 푸시는 dispatch_queue 가 KST 9~21시에만 넣어 준다(push_due, #42·#46). 사용자 토큰이 없으므로
 *   게이트웨이 JWT 확인은 끄고(verify_jwt false), 헤더 x-dispatch-token 을 DB 의 dispatch_token_ok() 로 확인한다.
 * 1. 토큰 확인. 틀리면 401.
 * 2. dispatch_queue(): 최근 3일 알림 중 메일·푸시를 아직 못 보낸 것(메일 주소 포함). 100줄씩 이어 받아(p_after) 큐를 비운다.
 *    응원단 알림은 사람마다 한 줄이라 하루 100줄을 넘을 수 있다. 실행 시간 한도 안(약 100초)까지만 돌고 남은 것은 다음 실행에.
 * 3. 메일: GMAIL_USER·GMAIL_APP_PASSWORD 가 없으면 건너뛴다(표시하지 않아 설정 뒤 다음 실행 때 보낸다).
 *    Gmail(smtp.gmail.com:465, SSL)로 연결 하나를 열어 차례로 보낸다. Supabase Edge Function 은 25·587 포트를 막아 465 를 쓴다.
 *    로그인이 거절되면(EAUTH) 남은 메일은 보내지 않고 다음 실행으로 넘긴다(틀린 비밀번호로 계속 두드리면 구글이 계정을 잠글 수 있어서).
 *    메일 주소가 없는 계정은 "보냄"으로 표시한다.
 * 4. 푸시: VAPID 키가 없으면 건너뛴다. 구독마다 보내고, 410·404(구독 끝남)면 그 구독을 지운다.
 *    구독이 없거나 한 곳이라도 받았거나 모두 끝난 구독이면 "보냄"으로 표시한다. 일시 오류만 남겨 다음 실행 때 다시 보낸다.
 * 5. 보낸 표시는 mark_dispatched(). 표시가 실패하면 500(다음 실행 때 다시 보낼 수 있음). 알림함 줄은 그대로다.
 * Gmail 개인 계정은 하루 500통까지라 라운드마다 1·2위 주인(하루 수십 통 이하)이면 넉넉하다.
 * 비밀값: GMAIL_USER(보내는 Gmail 주소), GMAIL_APP_PASSWORD(구글 계정의 앱 비밀번호 16자), MAIL_FROM_NAME(보내는 이름, 기본 "프로듀스 댕냥"),
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(mailto:…), SITE_URL. 보내는 주소는 공개 저장소라 코드·문서에 적지 않는다.
 */
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";
import nodemailer from "npm:nodemailer@6.9.16";
import { debutMail } from "../_shared/debutMail.ts";
import { noticeLink, noticeView } from "../_shared/notice.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "";
// 구글은 앱 비밀번호를 4자씩 띄어 보여 준다. 띄어 쓴 채 넣어도 되게 공백을 뺀다
const GMAIL_APP_PASSWORD = (Deno.env.get("GMAIL_APP_PASSWORD") ?? "").replace(/\s/g, "");
const MAIL_FROM_NAME = Deno.env.get("MAIL_FROM_NAME") || "프로듀스 댕냥";
const mailReady = !!(GMAIL_USER && GMAIL_APP_PASSWORD);
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

type Mailer = ReturnType<typeof nodemailer.createTransport>;
type MailResult = "sent" | "failed" | "auth";

function gmail(): Mailer {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    pool: true, // 한 번 로그인한 연결로 차례로 보낸다
    maxConnections: 1,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

async function sendMail(mailer: Mailer, r: Row): Promise<MailResult> {
  const { text, href } = noticeView(r.kind, r.payload);
  const link = `${SITE_URL}${noticeLink(href ?? "/me", r.kind, "mail")}`;
  // 데뷔는 화보 사진 요청 + 노출 가이드 본문(#27), 나머지는 한 줄 본문
  const debut = debutMail(r.kind, r.payload, SITE_URL);
  try {
    await mailer.sendMail({
      from: { name: MAIL_FROM_NAME, address: GMAIL_USER },
      to: r.email!,
      subject: debut?.subject ?? text,
      html: debut?.html ?? mailHtml(text, link),
      text: debut?.text ?? `${text}\n\n${link}`,
    });
    return "sent";
  } catch (e) {
    const code = (e as { code?: string }).code ?? "unknown";
    // 주소·비밀번호는 남기지 않는다. 오류 종류만
    console.error(`dispatch-notifications: 메일 실패 notice=${r.id} code=${code}`);
    return code === "EAUTH" ? "auth" : "failed";
  }
}

/** 이 사람의 모든 구독에 보낸다. 다시 시도할 필요가 없으면 true. */
async function sendPush(r: Row): Promise<boolean> {
  const { data: subs, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", r.user_id);
  if (error) return false;
  if (!subs?.length) return true;
  const { text, href } = noticeView(r.kind, r.payload);
  const body = JSON.stringify({ title: "프로듀스 댕냥", body: text, url: noticeLink(href ?? "/me", r.kind, "push"), tag: `pd-notice-${r.id}` });
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

  // 2~5. 100줄씩 받아 보내고 표시한다. 큐가 비거나 시간 한도(약 100초)에 닿으면 멈춘다(남은 것은 다음 실행에)
  const started = Date.now();
  let after = 0;
  let queued = 0;
  let mailedN = 0;
  let pushedN = 0;
  let mailAuthFailed = false;
  for (let page = 0; page < 20 && Date.now() - started < 100_000; page++) {
    // 2. 보낼 거리
    const { data, error } = await admin.rpc("dispatch_queue", { p_limit: 100, p_after: after });
    if (error) return json({ error: "queue_failed" }, 500);
    const rows = (data ?? []) as Row[];
    queued += rows.length;
    if (!rows.length) break;
    after = rows[rows.length - 1].id;

    // 3. 메일(로그인이 한 번 거절되면 이번 실행에서는 더 보내지 않는다)
    const mailed: number[] = [];
    if (mailReady && !mailAuthFailed && rows.some((x) => x.need_email)) {
      const mailer = gmail();
      try {
        for (const r of rows.filter((x) => x.need_email)) {
          if (!r.email) {
            mailed.push(r.id);
            continue;
          }
          const res = await sendMail(mailer, r);
          if (res === "sent") mailed.push(r.id);
          if (res === "auth") {
            mailAuthFailed = true;
            break;
          }
        }
      } finally {
        mailer.close();
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
    mailedN += mailed.length;
    pushedN += pushed.length;
    if (rows.length < 100) break;
  }
  const result = { queued, mailed: mailedN, pushed: pushedN, mail_ready: mailReady, mail_auth_failed: mailAuthFailed, push_ready: pushReady };
  console.log(`dispatch-notifications: ${JSON.stringify(result)}`);
  return json(result);
});
