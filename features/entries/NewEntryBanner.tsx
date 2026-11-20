"use client";
/**
 * 등록 직후(/dog/<글>?new=1) 상세 위에 뜨는 띠. 첫 픽은 보통 아는 사람에게서 오므로 바로 공유하게 한다(리뷰 후속 #5).
 * 새로고침·공유해도 다시 뜨지 않게 주소의 ?new=1 은 처음 그릴 때 지운다.
 */
import { useEffect } from "react";
import { CopyLink } from "./CopyLink";
import s from "./entries.module.css";

export function NewEntryBanner({ entryId, name }: { entryId: string; name: string }) {
  useEffect(() => {
    const u = new URL(location.href);
    if (!u.searchParams.has("new")) return;
    u.searchParams.delete("new");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  }, []);
  return (
    <div className={s.fresh} role="status">
      <p>
        <b>{name}, 등록했어요!</b>
        <span>
          첫 픽은 가까운 사람에게서 와요. 단톡방이나 SNS 에 링크를 나눠 주세요.
        </span>
      </p>
      <CopyLink entryId={entryId} name={name} place="register" primary label="링크 나누기" />
    </div>
  );
}
