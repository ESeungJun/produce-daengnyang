"use client";
/**
 * 신고 버튼(#6). 글 상세(글 신고)와 댓글마다(댓글 신고) 쓴다.
 * 회원이면 확인 시트 → report() RPC. 같은 대상은 한 사람이 한 번만(DB 유일 조건). 손님·익명은 "신고" 문구의 로그인 시트.
 * 신고했거나 이미 신고한 대상이면 이 화면에서는 버튼을 "신고함"으로 끈다.
 * 사유는 고르게 하지 않는다: 관리자가 대상을 직접 보고 판단하고, 고르는 단계가 늘면 신고가 줄어서다.
 */
import { useState } from "react";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { usePicks } from "@/features/picks/PicksProvider";
import { browserClient } from "@/shared/lib/supabase/client";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import { reportErrorText } from "./messages";

const TEXT = {
  entry: ["이 글을 신고할까요?", "동물이 아닌 사진, 불쾌한 사진, 남의 사진 같은 글이면 신고해 주세요. 관리자가 확인하고 문제가 있으면 숨겨요."],
  comment: ["이 댓글을 신고할까요?", "욕설·비방·광고 같은 댓글이면 신고해 주세요. 관리자가 확인하고 문제가 있으면 숨겨요."],
} as const;

export function ReportButton({ target, targetId, className }: { target: "entry" | "comment"; targetId: string; className?: string }) {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send() {
    if (busy) return;
    setBusy(true);
    const sb = await browserClient();
    const { error } = await sb.rpc("report", { p_target: target, p_target_id: targetId });
    setBusy(false);
    setOpen(false);
    if (!error || error.message === "already_reported") setDone(true);
    toast(error ? reportErrorText(error.message) : "신고했어요. 관리자가 확인할게요");
  }

  return (
    <>
      <button type="button" className={className} disabled={done} onClick={() => (viewer === "member" ? setOpen(true) : openLogin("report"))}>
        {done ? "신고함" : "신고"}
      </button>
      <Sheet open={open} title={TEXT[target][0]} body={TEXT[target][1]} mainLabel={busy ? "보내는 중…" : "신고하기"} subLabel="취소" onMain={send} onClose={() => setOpen(false)} />
    </>
  );
}
