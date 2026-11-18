"use client";
/**
 * 신고 한 줄의 관리 동작(#6).
 * - 숨기기/되살리기: admin_set_hidden. 신고도 처리됨으로 닫는다.
 * - 문제없음: admin_dismiss(신고만 닫음).
 * - 계정 정리: 봇·악성 계정. 확인 시트(되돌릴 수 없음) → Edge Function admin-purge-user
 *   (확정 전 라운드의 그 계정 픽을 지우고 계정·글·사진·댓글 삭제). 자기 자신·관리자는 함수가 거절한다.
 * 끝나면 router.refresh 로 목록을 다시 받는다.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import s from "./admin.module.css";

/** deleted: 주인이 이미 지운 대상(숨길 것이 없어 "문제없음(닫기)"만). restoreOnly: "최근 숨긴 것" 줄(되살리기만) */
type Props = {
  target: "entry" | "comment";
  targetId: string;
  hidden: boolean;
  deleted: boolean;
  authorId: string | null;
  authorName: string | null;
  self: boolean;
  restoreOnly?: boolean;
};

export function AdminActions({ target, targetId, hidden, deleted, authorId, authorName, self, restoreOnly = false }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<null | "hide" | "dismiss" | "purge">(null);
  const [askPurge, setAskPurge] = useState(false);

  async function run(kind: "hide" | "dismiss", fn: () => PromiseLike<{ error: unknown }>, done: string) {
    if (busy) return;
    setBusy(kind);
    const { error } = await fn();
    setBusy(null);
    if (error) return toast("처리하지 못했어요. 관리자 권한과 연결을 확인해 주세요");
    toast(done);
    router.refresh();
  }

  async function purge() {
    if (!authorId || busy) return;
    setBusy("purge");
    const sb = await browserClient();
    const { data, error } = await sb.functions.invoke("admin-purge-user", { method: "POST", body: { uid: authorId } });
    setBusy(null);
    setAskPurge(false);
    const status = (error as { context?: Response } | null)?.context?.status;
    if (status === 409) return toast("관리자 계정은 정리할 수 없어요");
    if (error) return toast("계정을 정리하지 못했어요. 잠시 뒤 다시 눌러 주세요");
    toast(`계정을 정리했어요. 확정 전 픽 ${(data as { picks?: number } | null)?.picks ?? 0}개를 지웠어요`);
    router.refresh();
  }

  return (
    <div className={s.actions}>
      {deleted ? null : (
        <button
          type="button"
          className={ui.pill}
          disabled={!!busy}
          onClick={async () => {
            const sb = await browserClient();
            await run("hide", () => sb.rpc("admin_set_hidden", { p_target: target, p_target_id: targetId, p_hidden: !hidden }), hidden ? "되살렸어요" : "숨겼어요. 아래 '최근 숨긴 것'에서 되살릴 수 있어요");
          }}
        >
          {busy === "hide" ? (hidden ? "되살리는 중…" : "숨기는 중…") : hidden ? "되살리기" : "숨기기"}
        </button>
      )}
      {restoreOnly ? null : (
        <button
          type="button"
          className={ui.ghost}
          disabled={!!busy}
          onClick={async () => {
            const sb = await browserClient();
            await run("dismiss", () => sb.rpc("admin_dismiss", { p_target: target, p_target_id: targetId }), "신고를 닫았어요");
          }}
        >
          {busy === "dismiss" ? "닫는 중…" : deleted ? "닫기" : "문제없음"}
        </button>
      )}
      {authorId && !self && !restoreOnly ? (
        <button type="button" className={s.danger} disabled={!!busy} onClick={() => setAskPurge(true)}>
          계정 정리
        </button>
      ) : null}
      <Sheet
        open={askPurge}
        danger
        title={`${authorName ?? "이 사람"} 계정을 정리할까요?`}
        body="봇·악성 계정일 때만 써 주세요. 결과가 확정되지 않은 라운드에 이 계정이 준 픽을 지우고, 계정·글·사진·댓글을 모두 지워요. 되돌릴 수 없어요."
        mainLabel={busy === "purge" ? "정리하는 중…" : "계정 정리"}
        subLabel="취소"
        onMain={purge}
        onClose={() => setAskPurge(false)}
      />
    </div>
  );
}
