"use client";
/**
 * 메인 보기 토글(#26): 전체 · 댕댕이 · 냥이. 고르면 쿠키에 기억하고 서버에 메인을 다시 그려 달라고 한다(router.refresh).
 * 다시 그리는 동안 누른 버튼을 먼저 켜 둔다. 부르는 곳: MainPage.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BOARD_NAME } from "@/shared/lib/format";
import { saveView } from "./myBoard";
import type { MainView } from "./view";
import ui from "@/shared/ui/ui.module.css";
import s from "./main.module.css";

const LABEL: Record<MainView, string> = { all: "전체", dog: BOARD_NAME.dog, cat: BOARD_NAME.cat };

export function ViewToggle({ current }: { current: MainView }) {
  const router = useRouter();
  const [picked, setPicked] = useState(current);
  const [pending, start] = useTransition();
  const on = pending ? picked : current;
  const pick = (v: MainView) => {
    if (v === on) return;
    setPicked(v);
    saveView(v);
    start(() => router.refresh());
  };
  return (
    <div className={`${ui.tabs} ${s.view}`} role="group" aria-label="메인에서 볼 게시판" aria-busy={pending || undefined}>
      {(["all", "dog", "cat"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={on === v} onClick={() => pick(v)}>
          {LABEL[v]}
        </button>
      ))}
    </div>
  );
}
