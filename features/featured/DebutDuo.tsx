/**
 * 메인 표지 아래 데뷔 대각선 배너(#20 사용자 의견: 일정 칸 자리를 대각선 반반 배너로, 데뷔한 아이들 사진 영역).
 * 왼쪽 위 댕댕이 · 오른쪽 아래 냥이를 비스듬한 선으로 나눈다. 각 반쪽이 그 글 상세 링크(clip-path 라 누르는 곳도 사진 모양대로).
 * 표지·세로 배너와 같은 사진이 겹치지 않게 사진이 여러 장이면 마지막 장을 쓰고, 한 장뿐이면 얼굴 쪽을 크게 당겨(data-zoom) 다른 구도로 보인다.
 * 1280px 이상은 양옆 세로 배너가 같은 아이를 이미 보여 주므로 높이를 줄인 "데뷔 축하" 띠로 쓴다(#20 리뷰).
 * 데뷔가 한 게시판뿐이면 한 장을 꽉 채우고, 하나도 없으면(서비스 첫 달) "첫 데뷔는 다음 달 1일" 안내 띠와 픽하러 가기 링크를 둔다.
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

export function DebutDuo({ debut, debutMonth, nextMonth }: { debut: FeaturedCard[]; debutMonth: string; nextMonth: number }) {
  if (!debut.length) {
    return (
      <div className={s.duoEmpty}>
        <p>
          <b>첫 데뷔는 {nextMonth}월 1일</b>
          {/* 진행 방식 설명은 바로 위 빈 표지가 하므로 여기는 날짜와 할 일만 */}
          <span>지금 마음에 드는 아이에게 픽해 주세요.</span>
        </p>
        <span className={s.duoGo}>
          <Link href="/dog">댕댕이 픽하러 가기</Link>
          <Link href="/cat">냥이 픽하러 가기</Link>
        </span>
      </div>
    );
  }
  const solo = debut.length === 1;
  return (
    <div className={s.duo}>
      <span className={s.duoCheer} aria-hidden="true">
        {debutMonth}월 데뷔를 축하해요
      </span>
      {debut.slice(0, 2).map((d) => (
        <Link key={d.entry_id} href={`/${d.board}/${d.entry_id}`} className={s.duoHalf} data-side={solo ? "solo" : d.board === "dog" ? "a" : "b"} aria-label={`${debutMonth}월 데뷔 ${BOARD_NAME[d.board]} ${d.pet_name}`}>
          <img src={photoUrl(duoPhoto(d)) ?? undefined} alt="" loading="lazy" decoding="async" data-zoom={debutPhotos(d).length < 2 ? "true" : undefined} />
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
