"use client";
/**
 * Cloudflare Turnstile(보이지 않는 봇 확인). 익명 로그인 직전에만 불러온다(구경만 하는 사람은 스크립트도 받지 않는다).
 * 사이트 키가 없으면(로컬에서 captcha 를 끈 경우) null 을 돌려주고, Supabase 가 확인을 요구하면 로그인이 실패한다.
 * 토큰은 한 번만 쓸 수 있어서 부를 때마다 새로 받는다.
 */
type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Turnstile> | null = null;

function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise<Turnstile>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile_missing")));
      s.onerror = () => reject(new Error("turnstile_load"));
      document.head.appendChild(s);
    });
    loading.catch(() => {
      loading = null; // 네트워크가 돌아오면 다음 누름에 다시 시도
    });
  }
  return loading;
}

/** 확인 토큰 하나를 받는다. 사람 확인이 필요하면(드물게) 화면 아래에 상자가 잠깐 뜬다. 20초 안에 안 되면 실패. */
export async function turnstileToken(): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  const ts = await load();
  const box = document.createElement("div");
  // 토스트(z 30)·시트(z 40) 위, 휴대폰 홈 표시줄을 피해 띄운다
  box.style.cssText = "position:fixed;left:50%;bottom:calc(var(--pd-gutter, 16px) + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);z-index:50";
  document.body.appendChild(box);
  let id = "";
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("turnstile_timeout")), 20000);
      id = ts.render(box, {
        sitekey: siteKey,
        appearance: "interaction-only",
        language: "ko",
        callback: (t: string) => {
          clearTimeout(timer);
          resolve(t);
        },
        "error-callback": () => {
          clearTimeout(timer);
          reject(new Error("turnstile_error"));
        },
      });
    });
  } finally {
    if (id) ts.remove(id);
    box.remove();
  }
}
