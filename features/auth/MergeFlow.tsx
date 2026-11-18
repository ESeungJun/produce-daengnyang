"use client";
/**
 * /auth/merge: 구글 로그인을 마무리하는 중간 화면(#3, 설계서 4-2). step 에 따라:
 * - check : 콜백이 code 도 오류도 못 읽었다. 주소 # 뒤의 오류를 보고, "이미 가입된 계정"이면 start 로, 아니면 실패 안내.
 * - start : 익명 세션 토큰을 이 탭(sessionStorage)에 10분만 들고, 이미 가입된 구글 계정으로 일반 로그인하러 간다.
 * - finish: 그 계정으로 돌아왔다. 들고 있던 익명 토큰으로 merge-anon 을 불러 오늘 픽을 옮기고 원래 보던 곳으로.
 * 어느 단계든 실패하면 픽만 못 옮길 뿐 로그인은 된 상태라, 안내하고 원래 곳으로 보낸다.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserClient } from "@/shared/lib/supabase/client";
import { safeNext } from "@/shared/lib/next-path";
import { Notice } from "@/shared/ui/Notice";
import ui from "@/shared/ui/ui.module.css";
import { MERGE_KEY, callbackUrl } from "./session";
import { saveFlash } from "./handoff";

type View = { title: string; body: string; failed?: boolean } | null;
const WORKING: View = { title: "로그인을 이어 가는 중이에요", body: "잠시만 기다려 주세요. 방금 한 픽도 같이 옮겨요." };

export function MergeFlow() {
  const q = useSearchParams();
  const step = q.get("step") ?? "check";
  const next = safeNext(q.get("next"));
  const [view, setView] = useState<View>(WORKING);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // 개발 모드에서 두 번 돌지 않게
    ran.current = true;
    const fail = (body: string) => setView({ title: "로그인하지 못했어요", body, failed: true });
    const go = () => location.replace(next); // 전체 새로 고침으로 윗줄·남은 픽을 새 로그인 상태로

    (async () => {
      const sb = await browserClient();
      if (step === "check") {
        const h = new URLSearchParams(location.hash.slice(1));
        const code = h.get("error_code") ?? q.get("error_code");
        if (code === "identity_already_exists") return location.replace(`/auth/merge?step=start&next=${encodeURIComponent(next)}`);
        if ((h.get("error") ?? q.get("error")) === "access_denied") return go(); // 구글 화면에서 취소
        if (code || h.get("error") || q.get("error")) return fail("구글 로그인을 마치지 못했어요. 보던 곳으로 돌아가 \"구글로 계속하기\"를 다시 눌러 주세요.");
        // 오류 표시 없이 code 를 못 바꿨다(다른 브라우저에서 열었거나 오래된 주소)
        const { data } = await sb.auth.getSession();
        return data.session?.user.is_anonymous === false ? go() : fail("로그인을 마치지 못했어요. 처음 연 브라우저에서 다시 해 주세요.");
      }
      if (step === "start") {
        // 이유를 먼저 알린다(같은 구글 화면이 한 번 더 뜨는 까닭)
        setView({ title: "이미 가입된 계정이에요", body: "같은 구글 계정을 한 번 더 골라 주세요. 방금 한 픽도 그 계정으로 옮겨요." });
        // 구글 2단계 인증까지 걸려도 토큰이 살아 있게 새로 받는다(1시간)
        const { data } = await sb.auth.refreshSession();
        const s = data.session;
        if (!s?.user.is_anonymous) return go();
        await new Promise((r) => setTimeout(r, 1500));
        try {
          sessionStorage.setItem(MERGE_KEY, JSON.stringify({ token: s.access_token, at: Date.now() }));
        } catch {
          // 저장이 막힌 브라우저면 픽은 못 옮기지만 로그인은 이어 간다
        }
        const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next, true) } });
        if (error) fail("구글 로그인 화면을 열지 못했어요. 보던 곳으로 돌아가 잠시 뒤 다시 해 주세요.");
        return;
      }
      if (step === "finish") {
        let stash: { token?: string; at?: number } = {};
        try {
          stash = JSON.parse(sessionStorage.getItem(MERGE_KEY) ?? "{}");
          sessionStorage.removeItem(MERGE_KEY);
        } catch {
          stash = {};
        }
        // 실패해도 로그인은 됐다. 픽만 못 옮긴 것이라 돌아간 화면에서 한 줄로 알린다.
        let moved = -1;
        if (stash.token && Date.now() - (stash.at ?? 0) < 30 * 60_000) {
          const r = await sb.functions.invoke("merge-anon", { body: { anon_token: stash.token } }).catch(() => null);
          if (r && !r.error) moved = Number((r.data as { moved?: number } | null)?.moved ?? 0);
        }
        // 하려던 픽(handoff)은 그대로 둔다. 돌아간 화면이 이어서 보낸다.
        saveFlash(
          moved > 0
            ? "로그인했어요. 로그인 전에 한 픽도 이 계정으로 옮겼어요"
            : moved === 0
              ? "로그인했어요. 로그인 전 픽은 이 계정의 오늘 픽과 겹쳐서 빠졌어요"
              : "로그인했어요. 로그인 전에 한 픽은 옮기지 못했어요",
        );
        return go();
      }
      go();
    })().catch(() => fail("인터넷 연결을 확인하고 보던 곳에서 다시 해 주세요."));
  }, [step, next, q]);

  if (!view) return null;
  // 진행 중에는 다른 곳으로 가는 버튼을 두지 않는다(픽 옮기기가 끊기지 않게). 실패하면 보던 곳으로 돌아갈 길을 준다.
  if (!view.failed) return <Notice title={view.title} body={view.body} home={false} />;
  return (
    <Notice
      title={view.title}
      body={view.body}
      action={
        <a className={ui.ghost} href={next}>
          보던 곳으로
        </a>
      }
    />
  );
}
