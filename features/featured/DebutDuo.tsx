/**
 * 메인 표지 아래 데뷔 대각선 배너(#20 사용자 의견: 일정 칸 자리를 대각선 반반 배너로, 데뷔한 아이들 사진 영역).
 * 왼쪽 위 댕댕이 · 오른쪽 아래 냥이를 비스듬한 선으로 나눈다. 각 반쪽이 그 글 상세 링크(clip-path 라 누르는 곳도 사진 모양대로).
 * 표지·세로 배너와 같은 사진이 겹치지 않게 사진이 여러 장이면 마지막 장을 쓴다. 데뷔가 한 게시판뿐이면 한 장을 꽉 채운다.
 */
import Link from "next/link";
import { BOARD_NAME } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { debutPhotos, type FeaturedCard } from "./api";
import s from "./featured.module.css";

/** 배너에 쓸 사진: 여러 장이면 마지막 장(표지는 첫 장, 세로 배너는 두 번째 장부터) */
export function duoPhoto(c: FeaturedCard): string | null {
  const list = debutPhotos(c);
  return list.length ? list[list.length - 1] : null;
}

export function DebutDuo({ debut, debutMonth }: { debut: FeaturedCard[]; debutMonth: string }) {
  if (!debut.length) return null;
  const solo = debut.length === 1;
  return (
    <div className={s.duo}>
      {debut.slice(0, 2).map((d) => (
        <Link key={d.entry_id} href={`/${d.board}/${d.entry_id}`} className={s.duoHalf} data-side={solo ? "solo" : d.board === "dog" ? "a" : "b"} aria-label={`${debutMonth}월 데뷔 ${BOARD_NAME[d.board]} ${d.pet_name}`}>
          <img src={photoUrl(duoPhoto(d)) ?? undefined} alt="" loading="lazy" decoding="async" />
          <span className={s.duoTag} aria-hidden="true">
            <small>
              {debutMonth}월 데뷔 · {BOARD_NAME[d.board]}
            </small>
            <b>{d.pet_name}</b>
          </span>
        </Link>
      ))}
    </div>
  );
}
