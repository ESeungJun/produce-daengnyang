"use client";
/**
 * 토스트(픽·한도·복사 안내). 화면 어디서나 const toast = useToast(); toast("…") 로 띄운다.
 * 2.4초 뒤 사라진다(tokens.css 의 --pd-toast 와 같은 값).
 * 읽기 프로그램이 읽도록 role=status 로 둔다.
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import s from "./ui.module.css";

const TOAST_MS = 2400;

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), TOAST_MS);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={s.toast} role="status" aria-live="polite" data-on={on}>
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
