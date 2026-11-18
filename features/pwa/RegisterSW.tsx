"use client";
/**
 * 서비스 워커 등록(#8). 홈 화면 설치·오프라인 안내 화면이 되려면 첫 방문부터 /sw.js 가 있어야 한다.
 * 화면이 다 뜬 뒤(load) 등록해 첫 그리기를 늦추지 않는다. 지원하지 않는 브라우저·실패는 조용히 넘긴다(사이트는 그대로 쓸 수 있음).
 */
import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const go = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") go();
    else {
      window.addEventListener("load", go, { once: true });
      return () => window.removeEventListener("load", go);
    }
  }, []);
  return null;
}
