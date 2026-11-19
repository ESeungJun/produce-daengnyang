"use client";
/**
 * 데뷔 화보 "인스타에 올리기"(#18). 스토리·피드 이미지(/<게시판>/<글>/insta/<형식>)를 받아
 * 1. 휴대폰(터치)이고 공유창이 파일을 받으면(navigator.canShare files) 공유창으로 넘긴다 → 인스타를 고르면 올리기 화면. 보내면 share_insta_story·feed 기록.
 * 2. 아니면(컴퓨터는 공유창에 인스타가 없어서 · 파일을 못 받는 브라우저) 이미지를 저장하고, 인스타 앱에서 올리라고 안내한다. share_insta_save 기록.
 * 인스타는 웹사이트가 직접 올리는 길을 막아 두어 이 방식이다(사용자 결정). 공유창을 닫으면 아무것도 남기지 않는다.
 */
import { useState } from "react";
import { trackSns } from "@/features/sns/track";
import ui from "@/shared/ui/ui.module.css";
import s from "./debut.module.css";

type Format = "story" | "feed";
const LABEL: Record<Format, string> = { story: "스토리용", feed: "피드용" };

export function InstaShare({ entryId, board, name }: { entryId: string; board: string; name: string }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [note, setNote] = useState("");

  async function share(format: Format) {
    setBusy(format);
    setNote("이미지를 만들고 있어요");
    try {
      const res = await fetch(`/${board}/${entryId}/insta/${format}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], `${name}-데뷔-${format === "story" ? "스토리" : "피드"}.png`, { type: "image/png" });
      const phone = window.matchMedia("(pointer: coarse)").matches;
      if (phone && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          trackSns([entryId], format === "story" ? "share_insta_story" : "share_insta_feed", "detail");
          setNote("");
        } catch (err) {
          // 공유창을 닫았으면 조용히 끝낸다
          setNote((err as Error).name === "AbortError" ? "" : "공유창을 열지 못했어요. 다시 눌러 주세요");
        }
        return;
      }
      // 저장으로 대신: 잠깐 쓰는 주소로 내려받게 하고 바로 치운다
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      trackSns([entryId], "share_insta_save", "detail");
      setNote(`${LABEL[format]} 이미지를 저장했어요. 휴대폰 인스타 앱에서 올려 주세요`);
    } catch {
      setNote("이미지를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.insta}>
      <p className={s.instaHead}>
        <b>인스타에 올리기</b>
        <span>화보 이미지를 만들어 공유창으로 넘겨요</span>
      </p>
      <div className={s.instaBtns}>
        {(["story", "feed"] as const).map((f) => (
          <button key={f} type="button" className={ui.ghost} onClick={() => share(f)} disabled={busy !== null} aria-busy={busy === f}>
            {busy === f ? "만드는 중…" : LABEL[f]}
          </button>
        ))}
      </div>
      <p className={s.instaNote} role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
