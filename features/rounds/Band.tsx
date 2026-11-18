"use client";
/**
 * 마감 띠: "마감까지 2일 05:03:09". 1초마다 다시 센다.
 * 서버 렌더와 첫 화면이 어긋나지 않게 처음에는 "--" 를 그리고, 브라우저에서 시계를 시작한다.
 */
import { useEffect, useState } from "react";
import { countdown } from "@/shared/lib/format";
import s from "./rounds.module.css";

export function Band({ endsAt, label = "마감까지", className }: { endsAt: string; label?: string; className?: string }) {
  const [text, setText] = useState("--");
  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => setText(countdown(end - Date.now()));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endsAt]);
  return (
    <div className={`${s.band} ${className ?? ""}`}>
      <span>{label}</span>
      <strong aria-live="off">{text}</strong>
    </div>
  );
}
