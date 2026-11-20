"use client";
/**
 * 라운드 결과 다시 계산(#7, #6에서 옮김). 관리자 화면 "라운드 결과"의 줄마다.
 * 신고로 글을 숨긴 뒤 등에 쓴다. 확인 시트 → admin_recalculate(DB 가 관리자·끝난 라운드인지 다시 확인)
 * → 결과를 다시 쓰고, 주간이면 결선 준비도 다시 돌린다. 새로 오른 글 주인에게만 알림이 더 간다.
 * 계산하는 동안은 시트를 닫지 않는다(취소해도 요청은 계속 가서 끝났는지 헷갈리므로).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";

export function RecalcButton({ roundId, title, finalized, quiet }: { roundId: number; title: string; finalized: boolean; quiet: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const sb = await browserClient();
      const { data, error } = await sb.rpc("admin_recalculate", { p_round_id: roundId });
      setAsk(false);
      if (error) return toast("다시 계산하지 못했어요. 잠시 뒤 다시 눌러 주세요");
      const d = (data ?? {}) as { final_copies?: number; changed?: boolean; notified?: number };
      const what = d.changed ? `1·2위가 바뀌었어요${d.notified ? ` · ${d.notified}명에게 알림을 보냈어요` : " · 노출이 끝난 라운드라 알림은 보내지 않았어요"}` : "1·2위는 그대로예요";
      toast(`${title}: ${what}${d.final_copies ? ` · 결선에 ${d.final_copies}개를 올렸어요` : ""}`);
      router.refresh();
    } catch {
      setAsk(false);
      toast("다시 계산하지 못했어요. 잠시 뒤 다시 눌러 주세요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={ui.ghost} onClick={() => setAsk(true)} disabled={busy} aria-label={`${title} ${finalized ? "다시 계산" : "지금 확정"}`}>
        {busy ? "계산하는 중…" : finalized ? "다시 계산" : "지금 확정"}
      </button>
      <Sheet
        open={ask}
        title={`${title} 결과를 ${finalized ? "다시 계산할까요" : "지금 확정할까요"}?`}
        body={
          quiet
            ? "숨긴 글을 빼고 표를 다시 세요. 노출 기간이 끝난 라운드라 결과만 바뀌고 새 1·2위에게 알림은 가지 않아요. 밀려난 글 주인에게는 알림함에 정정 알림이 가요."
            : "숨긴 글을 빼고 표를 다시 세요. 1·2위가 바뀌면 새로 오른 글 주인에게 알림이 가고, 밀려난 글 주인에게는 알림함에 정정 알림이 가요."
        }
        mainLabel={busy ? "계산하는 중…" : finalized ? "다시 계산" : "지금 확정"}
        subLabel="취소"
        onMain={run}
        onClose={() => !busy && setAsk(false)}
      />
    </>
  );
}
