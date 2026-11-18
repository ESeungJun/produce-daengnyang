"use client";
/**
 * 공유하기. "{이름} 픽해 주세요! {주소}" 문구를 보낸다(기획서 4절 공유 문구).
 * 1. 휴대폰(터치)이고 공유 시트가 있으면 공유 시트를 연다.
 * 2. 아니면 문구를 복사한다.
 * 3. 복사가 막힌 브라우저면 문구를 고를 수 있는 칸을 버튼 아래에 띄운다(토스트는 금방 사라져 따라 쓸 수 없어서).
 */
import { useState } from "react";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import s from "./entries.module.css";

export function CopyLink({ name, primary = false, label = "공유하기" }: { name: string; primary?: boolean; label?: string }) {
  const toast = useToast();
  const [manual, setManual] = useState<string | null>(null);

  async function share() {
    // 등록 직후 표시(?new=1)는 남에게 보낼 주소에서 뺀다
    const u = new URL(window.location.href);
    u.searchParams.delete("new");
    const url = u.toString();
    const text = `${name} 픽해 주세요!`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // 사용자가 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast("공유 문구를 복사했어요. 단톡방이나 SNS 에 붙여 넣어 주세요");
    } catch {
      setManual(`${text} ${url}`);
    }
  }

  return (
    <>
      <button type="button" className={primary ? ui.pill : ui.ghost} onClick={share}>
        {label}
      </button>
      {manual ? (
        <label className={s.manual}>
          <span>이 문구를 길게 눌러 복사해 주세요</span>
          <input readOnly value={manual} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </label>
      ) : null}
    </>
  );
}
