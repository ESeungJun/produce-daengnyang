"use client";
/**
 * 표지: 이달의 데뷔(댕댕이·냥이). 휴대폰은 옆으로 넘기고(점으로 위치), 1024px 이상은 두 장을 반반 펼친다.
 * 1024~1279px 은 장마다 아래에 SNS 아이콘 줄(.deskSns). 1280px 이상은 표지를 그대로 두고 양옆 세로 배너(DebutRail)를
 * 함께 띄운다(#16 사용자 의견: 가운데 배너 유지 + 양옆 활용). 그때 SNS 아이콘은 배너가 맡는다.
 * 사진·이름·표 수 어디를 눌러도 글 상세로 간다(#16). 사진이 여러 장이면 제자리에서 자동으로 넘긴다(PhotoFade).
 * 큰 제호("프로듀스 댕냥")는 #16 에서 뺐다. 사이트 이름은 윗줄 로고와 읽기 도구용 h1(MainPage)이 맡는다.
 * 데뷔가 아직 없으면(서비스 첫 달) 사진 없는 글자 표지 한 장.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { BOARD_NAME, SNS_NAME, count, firstSns, snsLinks } from "@/shared/lib/format";
import ui from "@/shared/ui/ui.module.css";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { debutPhotos, type FeaturedCard } from "./api";
import { PhotoFade } from "./PhotoFade";
import s from "./featured.module.css";

type Props = { debutMonth: string; debut: FeaturedCard[]; toc: React.ReactNode };

export function Cover({ debutMonth, debut, toc }: Props) {
  const slides = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const sns = debut[at] ? firstSns(debut[at]) : null;
  const go = (i: number) =>
    slides.current?.scrollTo({
      left: slides.current.clientWidth * i,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });

  return (
    <div className={s.coverWrap}>
      <div className={s.cover}>
        <div
          className={s.slides}
          ref={slides}
          onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          aria-roledescription="표지 넘김"
        >
          {debut.length === 0 ? (
            <div className={`${s.slide} ${s.blank}`}>
              <div className={s.lines}>
                <span className={s.kick}>데뷔 준비 중</span>
                <span className={s.star}>첫 데뷔를 기다려요</span>
                <p>매주 픽으로 센터를 뽑고, 월말 결선에서 댕댕이·냥이 한 마리씩 데뷔해요. 데뷔한 아이가 다음 달 표지 모델이에요.</p>
              </div>
            </div>
          ) : (
            debut.map((d, i) => (
              <Link key={d.entry_id} className={s.slide} href={`/${d.board}/${d.entry_id}`} aria-label={`${debutMonth}월 데뷔 ${BOARD_NAME[d.board]} ${d.pet_name}, ${count(d.votes)}표`}>
                <PhotoFade paths={debutPhotos(d)} alt="" eager={i === 0} />
                <span className={s.scrim} />
                <span className={s.lines} aria-hidden="true">
                  <span className={s.kick}>
                    {debutMonth}월 데뷔 · {BOARD_NAME[d.board]}
                  </span>
                  <span className={s.star}>{d.pet_name}</span>
                  <span className={s.cap}>{count(d.votes)}표로 데뷔</span>
                </span>
              </Link>
            ))
          )}
        </div>
        {debut.length > 1 ? (
          <div className={s.dots}>
            {debut.map((d, i) => (
              <button key={d.entry_id} type="button" aria-label={`${BOARD_NAME[d.board]} 표지`} aria-current={i === at} onClick={() => go(i)} />
            ))}
          </div>
        ) : null}
      </div>
      {/* 노출은 SNS 버튼이 실제로 보일 때(휴대폰, 지금 넘겨 둔 장)만 센다. 데스크톱은 .act 가 숨어 0 크기라 세지 않는다. */}
      <Impression key={debut[at]?.entry_id ?? "none"} className={s.act} ids={sns ? [debut[at].entry_id] : []} place="cover">
        {sns ? <SnsLink className={ui.pill} entryId={debut[at].entry_id} sns={sns} place="cover" /> : null}
      </Impression>
      {/* 1024~1279px 펼침면: 장마다 아래에 SNS 앱 아이콘(장 자체가 링크라 안에 넣지 못한다). 휴대폰·1280 이상은 숨김 */}
      {debut.map((d) => {
        const list = snsLinks(d);
        return (
          <Impression key={d.entry_id} className={s.deskSns} ids={list.length ? [d.entry_id] : []} place="cover">
            {list.map((x) => (
              <SnsLink key={x.kind} className={s.railSnsBtn} entryId={d.entry_id} sns={x} place="cover" iconOnly iconSize="lg" label={`${d.pet_name} ${SNS_NAME[x.kind]} ${x.handle}, 새 창`} />
            ))}
          </Impression>
        );
      })}
      {toc}
    </div>
  );
}
