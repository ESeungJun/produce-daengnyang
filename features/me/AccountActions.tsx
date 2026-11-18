"use client";
/**
 * 로그아웃·회원 탈퇴.
 * - 로그아웃: 세션을 끊고 이 기기의 등록 임시 저장을 지운다(설계서 5절).
 * - 탈퇴: 확인 시트 → Edge Function delete-account(계정·글·사진·댓글 삭제, 준 픽은 남김) → 세션 정리 → 첫 화면.
 */
import { useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import { clearDraft } from "@/features/register/draft";
import { type FlashCode, withFlash } from "@/shared/ui/flash";
import s from "./me.module.css";

export function AccountActions() {
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function leave(next: string, flash: FlashCode) {
    const sb = await browserClient();
    await sb.auth.signOut({ scope: "local" }).catch(() => null);
    await clearDraft();
    // 서버가 그린 화면(남은 픽·윗줄)을 새 상태로 받으려고 전체를 다시 연다
    // 전체를 다시 열면 토스트가 사라지므로, 다음 화면이 띄울 안내 코드를 주소에 실어 보낸다
    location.href = withFlash(next, flash);
  }

  async function withdraw() {
    setAsk(false);
    setBusy(true);
    const sb = await browserClient();
    const { error } = await sb.functions.invoke("delete-account", { method: "POST" });
    // 응답이 끊겨 다시 눌렀는데 이미 지워진 계정이면 401 이 온다: 탈퇴는 끝난 것이다
    const gone = (error as { context?: Response } | null)?.context?.status === 401;
    if (error && !gone) {
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
      <button type="button" className={s.withdraw} onClick={() => setAsk(true)} disabled={busy}>
        {busy ? "탈퇴하는 중…" : "회원 탈퇴"}
      </button>
      <Sheet
        open={ask}
        title="정말 탈퇴할까요?"
        body="올린 글·사진·댓글이 모두 지워지고 되돌릴 수 없어요. 다른 아이에게 준 픽은 그대로 남아요."
        mainLabel="탈퇴하기"
        subLabel="그만둘게요"
        onMain={withdraw}
        onClose={() => setAsk(false)}
        danger
      />
    </div>
  );
}
