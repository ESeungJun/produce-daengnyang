"use client";
/**
 * 로그아웃·회원 탈퇴.
 * - 로그아웃: 세션을 끊고 이 기기의 등록 임시 저장을 지운다(설계서 5절).
 * - 탈퇴:
 *   1. 최근 10분 안에 로그인했는지 본다(signedInWithin). 아니면 구글로 다시 확인받고 /me?leave=1 로 돌아온다.
 *      휴대폰을 남이 잠깐 쓰는 사이 탈퇴되지 않게 한다(리뷰 후속 #5). 진짜 검사는 delete-account 함수가 한다.
 *   2. 확인 시트 → Edge Function delete-account(계정·글·사진·댓글·오늘 픽 삭제, 지난 픽은 남김) → 세션 정리 → 첫 화면.
 */
import { useEffect, useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import { continueWithGoogle } from "@/features/auth/session";
import { clearDraft } from "@/features/register/draft";
import { type FlashCode, withFlash } from "@/shared/ui/flash";
import { recentSignIn } from "@/features/auth/reauth";
import s from "./me.module.css";

type Ask = "confirm" | "reauth" | null;

export function AccountActions({ resume = false }: { resume?: boolean }) {
  const toast = useToast();
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);

  // 구글 확인을 마치고 /me?leave=1 로 돌아왔으면 확인 시트를 바로 띄운다(주소의 표시는 지운다)
  useEffect(() => {
    if (!resume) return;
    history.replaceState(history.state, "", location.pathname);
    void recentSignIn().then((ok) => setAsk(ok ? "confirm" : "reauth"));
  }, [resume]);

  async function leave(next: string, flash: FlashCode) {
    const sb = await browserClient();
    await sb.auth.signOut({ scope: "local" }).catch(() => null);
    await clearDraft();
    // 서버가 그린 화면(남은 픽·윗줄)을 새 상태로 받으려고 전체를 다시 연다.
    // 전체를 다시 열면 토스트가 사라지므로, 다음 화면이 띄울 안내 코드를 주소에 실어 보낸다
    location.href = withFlash(next, flash);
  }

  async function start() {
    setAsk((await recentSignIn()) ? "confirm" : "reauth");
  }

  async function reauth() {
    setAsk(null);
    await continueWithGoogle("/me?leave=1", { reauth: true }).catch(() => toast("구글 화면을 열지 못했어요. 잠시 뒤 다시 눌러 주세요"));
  }

  async function withdraw() {
    setAsk(null);
    setBusy(true);
    const sb = await browserClient();
    const { error } = await sb.functions.invoke("delete-account", { method: "POST" });
    const status = (error as { context?: Response } | null)?.context?.status;
    // 함수도 최근 로그인을 본다. 화면 검사와 함수 검사 사이에 시간이 지났으면 다시 확인받는다
    if (status === 403) {
      setBusy(false);
      return setAsk("reauth");
    }
    // 응답이 끊겨 다시 눌렀는데 이미 지워진 계정이면 401 이 온다: 탈퇴는 끝난 것이다
    if (error && status !== 401) {
      setBusy(false);
      return toast("탈퇴를 마치지 못했어요. 잠시 뒤 다시 눌러 주세요");
    }
    await leave("/", "bye");
  }

  return (
    <div className={s.account}>
      <button type="button" className={s.logout} onClick={() => leave("/", "logout")} disabled={busy}>
        로그아웃
      </button>
      <button type="button" className={s.withdraw} onClick={start} disabled={busy}>
        {busy ? "탈퇴하는 중…" : "회원 탈퇴"}
      </button>
      <Sheet
        open={ask === "reauth"}
        title="구글로 한 번 더 확인할게요"
        body="탈퇴는 되돌릴 수 없어서, 방금 로그인한 본인만 할 수 있어요. 구글 계정을 다시 골라 주시면 이 화면으로 돌아와요."
        mainLabel="구글로 확인하기"
        subLabel="그만둘게요"
        onMain={reauth}
        onClose={() => setAsk(null)}
      />
      <Sheet
        open={ask === "confirm"}
        title="정말 탈퇴할까요?"
        body="올린 글·사진·댓글이 모두 지워지고 되돌릴 수 없어요. 오늘 준 픽은 지워지고, 지난날 준 픽은 그대로 남아요."
        mainLabel="탈퇴하기"
        subLabel="그만둘게요"
        onMain={withdraw}
        onClose={() => setAsk(null)}
        danger
      />
    </div>
  );
}
