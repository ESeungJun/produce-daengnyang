"use client";
/**
 * 공유하기. "{이름} 픽해 주세요! {주소}" 문구를 보낸다(기획서 4절 공유 문구).
 * 주소에는 ref=share 를 붙여 그 주소로 들어온 방문을 센다(ShareVisit, #15).
 * 1. 휴대폰(터치)이고 공유 시트가 있으면 공유 시트를 연다. 보내기를 마치면 share_sheet 를 남긴다(닫으면 남기지 않음).
 * 2. 아니면 문구를 복사하고 share_copy 를 남긴다.
 * 3. 복사가 막힌 브라우저면 문구를 고를 수 있는 칸을 버튼 아래에 띄우고 share_manual 을 남긴다(토스트는 금방 사라져 따라 쓸 수 없어서).
 */
import { useState } from "react";
import { trackSns } from "@/features/sns/track";
import { shareUrl } from "@/features/share/link";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import s from "./entries.module.css";

export function CopyLink({
  entryId,
  name,
  place,
  primary = false,
  label = "공유하기",
  text: shareText,
}: {
  entryId: string;
  name: string;
  /** 기록 자리: 글 상세(detail) · 등록 직후 띠(register) · 데뷔 화보(debut) */
  place: "detail" | "register" | "debut";
  primary?: boolean;
  label?: string;
  /** 공유 문구(기본 "{이름} 픽해 주세요!"). 데뷔 화보는 축하 문구를 넘긴다(#17) */
  text?: string;
}) {
  const toast = useToast();
  const [manual, setManual] = useState<string | null>(null);

  async function share() {
    // 등록 직후 표시(?new=1)는 빼고 공유 표시(ref=share)를 붙인다
    const url = shareUrl(window.location.href);
    const text = shareText ?? `${name} 픽해 주세요!`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: text, text, url });
        trackSns([entryId], "share_sheet", place);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // 사용자가 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast("공유 문구를 복사했어요. 단톡방이나 SNS 에 붙여 넣어 주세요");
      trackSns([entryId], "share_copy", place);
    } catch {
      setManual(`${text} ${url}`);
      trackSns([entryId], "share_manual", place);
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
