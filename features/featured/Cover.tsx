"use client";
/**
 * 표지: 이달의 데뷔(강아지·고양이). 휴대폰은 옆으로 넘기고(점으로 위치), 데스크톱은 CSS 가 펼침면으로 놓는다.
 * 데스크톱 펼침면에서는 두 장이 나란히 놓여 SNS 버튼(.act)을 숨긴다(이름을 누르면 글로 간다).
 * 데뷔가 아직 없으면(서비스 첫 달) 사진 없는 글자 표지 한 장. 목차는 데스크톱에서 오른쪽 아래 칸에 들어가도록 같은 틀 안에 둔다.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { BOARD_NAME, count, firstSns } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import ui from "@/shared/ui/ui.module.css";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import type { FeaturedCard } from "./api";
import s from "./featured.module.css";

type Props = { issue: string; debutMonth: string; debut: FeaturedCard[]; toc: React.ReactNode };

export function Cover({ issue, debutMonth, debut, toc }: Props) {
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
              <h1 className={s.mast}>
                프로듀스
                <br />
                댕냥
              </h1>
              <span className={s.issue}>{issue}</span>
              <div className={s.lines}>
                <span className={s.kick}>창간호</span>
                <span className={s.star}>첫 데뷔를 기다려요</span>
                <p>매주 픽으로 센터를 뽑고, 월말 결선에서 강아지·고양이 한 마리씩 데뷔해요. 데뷔한 아이가 다음 달 표지 모델이에요.</p>
              </div>
            </div>
          ) : (
            debut.map((d, i) => (
              <div key={d.entry_id} className={s.slide} aria-label={`${BOARD_NAME[d.board]} 표지`}>
                <img src={photoUrl(d.path) ?? undefined} alt={`${debutMonth}월 데뷔 ${BOARD_NAME[d.board]} ${d.pet_name}`} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
                <div className={s.scrim} />
                {i === 0 ? (
                  <h1 className={s.mast}>
                    프로듀스
                    <br />
                    댕냥
                  </h1>
                ) : (
                  <p className={s.mast} aria-hidden="true">
                    프로듀스
                    <br />
                    댕냥
                  </p>
                )}
                <span className={s.issue}>{issue}</span>
                <div className={s.lines}>
                  <span className={s.kick}>
                    {debutMonth}월 데뷔 · {BOARD_NAME[d.board]}
                  </span>
                  <Link className={s.star} href={`/${d.board}/${d.entry_id}`}>
                    {d.pet_name}
                  </Link>
                  <span className={s.cap}>{count(d.votes)}표로 데뷔</span>
                </div>
              </div>
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
      {toc}
    </div>
  );
}
