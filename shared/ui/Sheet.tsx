"use client";
/**
 * 아래에서 올라오는 시트. 지금은 로그인 안내(features/auth/LoginSheet)가 쓴다.
 * 1. open 이 바뀌면 먼저 보이게(hidden 해제) 한 뒤 다음 프레임에 올린다(전환 효과가 보이게).
 * 2. 닫을 때는 내려가는 전환이 끝난 뒤 숨긴다. Esc 로도 닫힌다.
 * 3. 열리면 주 버튼에 초점을 두고, 닫히면 시트를 열기 전 초점(누른 버튼)으로 돌려준다.
 */
import { useEffect, useRef, useState } from "react";
import s from "./ui.module.css";

/** 내려가는 전환 시간. tokens.css 의 --pd-sheet-dur(.25s)보다 조금 길게 기다린 뒤 숨긴다. */
const SHEET_MS = 260;

type Props = {
  open: boolean;
  title: string;
  body: string;
  mainLabel: string;
  subLabel: string;
  onMain: () => void;
  onClose: () => void;
};

export function Sheet({ open, title, body, mainLabel, subLabel, onMain, onClose }: Props) {
  const [mounted, setMounted] = useState(open);
  const [up, setUp] = useState(false);
  const main = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const raf = requestAnimationFrame(() => {
        setMounted(true);
        requestAnimationFrame(() => {
          setUp(true);
          main.current?.focus();
        });
      });
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setUp(false));
    const t = setTimeout(() => setMounted(false), SHEET_MS);
    opener.current?.focus();
    opener.current = null;
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={s.sheet} role="dialog" aria-modal="false" aria-label={title} data-on={up} hidden={!mounted}>
      <div className={s.grip} />
      <p className={s.sheetTitle}>{title}</p>
      <p className={s.sheetBody}>{body}</p>
      <button ref={main} className={s.sheetMain} type="button" onClick={onMain}>
        {mainLabel}
      </button>
      <button className={s.sheetSub} type="button" onClick={onClose}>
        {subLabel}
      </button>
    </div>
  );
}
