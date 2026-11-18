"use client";
/**
 * 앱 안 브라우저(인스타·카톡 등) 안내. 구글이 이런 곳의 로그인을 막아서, 등록 폼을 다 쓰고 "등록하기"를 눌렀을 때 막히지 않게
 * 쓰기 전에 기본 브라우저로 옮기도록 먼저 알린다(리뷰 후속 #5). 서버는 UA 를 몰라도 되게 브라우저에서 판단한다.
 */
import { useSyncExternalStore } from "react";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { inAppBrowser, openExternal } from "./handoff";

const noop = () => () => {};
/** "kakao-ios" 같은 글자 하나로 돌려준다(객체면 매번 달라져 무한히 다시 그린다) */
function readKind(): string | null {
  const app = inAppBrowser();
  return app
    ? `${app}-${/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "etc"}`
    : null;
}

export function InAppNotice() {
  const toast = useToast();
  // 서버에서는 늘 null(안내 없음), 브라우저에서는 UA 로 판단한다. 같은 글자를 돌려줘야 다시 그리지 않는다
  const kind = useSyncExternalStore(noop, readKind, () => null);
  if (!kind) return null;
  const state = {
    app: kind.startsWith("kakao") ? "kakao" : "other",
    ios: kind.endsWith("ios"),
  };
  const canOpen = state.app === "kakao" || !state.ios;

  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("주소를 복사했어요. Safari 나 크롬에 붙여 넣어 주세요");
    } catch {
      toast("복사가 막혔어요. 주소창을 길게 눌러 복사해 주세요");
    }
  }

  return (
    <div className={ui.inapp} role="note">
      <p>
        <b>이 화면에서는 구글 로그인이 막혀요</b>
        <span>
          {canOpen
            ? "등록은 로그인해야 끝나요. 쓰기 전에 기본 브라우저로 옮겨 주세요."
            : "등록은 로그인해야 끝나요. 오른쪽 위 ··· 메뉴에서 'Safari로 열기'를 눌러 주세요."}
        </span>
      </p>
      <div className={ui.inappAct}>
        {canOpen ? (
          <button
            type="button"
            className={ui.pill}
            onClick={() => openExternal()}
          >
            기본 브라우저로 열기
          </button>
        ) : null}
        <button type="button" className={ui.ghost} onClick={copy}>
          주소 복사
        </button>
      </div>
    </div>
  );
}
