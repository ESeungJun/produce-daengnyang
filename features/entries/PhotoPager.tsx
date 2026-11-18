"use client";
/** 글 상세 사진 1~3장 옆으로 넘김. 2장 이상이면 아래 점으로 위치를 보여 준다. */
import { useState } from "react";
import { photoUrl } from "@/shared/lib/supabase/env";
import s from "./entries.module.css";

export function PhotoPager({ photos, name }: { photos: { path: string }[]; name: string }) {
  const [at, setAt] = useState(0);
  return (
    <div>
      <div
        className={s.pager}
        onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        aria-roledescription={photos.length > 1 ? "사진 넘김" : undefined}
        // 2장 이상이면 초점을 받아 ←/→ 키로 넘길 수 있게 한다(Safari 는 스크롤 칸에 초점을 주지 않는다).
        tabIndex={photos.length > 1 ? 0 : undefined}
        aria-label={photos.length > 1 ? `${name} 사진 ${photos.length}장, 좌우로 넘겨 보세요` : undefined}
      >
        {photos.map((p, i) => (
          <img key={p.path} src={photoUrl(p.path) ?? undefined} alt={photos.length > 1 ? `${name} 사진 ${i + 1}/${photos.length}` : `${name} 사진`} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
        ))}
      </div>
      {photos.length > 1 ? (
        <div className={s.pagerDots} aria-hidden="true">
          {photos.map((p, i) => (
            <span key={p.path} data-on={i === at} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
