"use client";
/**
 * 표지: 이달의 데뷔(댕댕이·냥이). 휴대폰은 옆으로 넘기고(점으로 위치), 1024~1279px 은 두 장을 반반 펼치고
 * 장마다 아래에 SNS 아이콘 줄(.deskSns)을 둔다.
 * 1280px 이상은 양옆 세로 배너(DebutRail, #16)가 두 아이를 이미 보여 주므로, 가운데는 잡지 표지 한 장으로 두고
 * 두 아이를 천천히 번갈아 넘긴다(#25: 같은 두 아이가 한 화면에 세 번 나와 정신없다는 의견). SNS 아이콘은 배너가 맡는다.
 * 시작 장은 방문자가 마지막으로 본 게시판 쪽 아이다(myBoard, #25 "내 쪽 먼저").
 * 사진·이름·표 수 어디를 눌러도 글 상세로 간다(#16). 사진이 여러 장이면 제자리에서 자동으로 넘긴다(PhotoFade).
 * 큰 제호("프로듀스 댕냥")는 #16 에서 뺐다. 사이트 이름은 윗줄 로고와 읽기 도구용 h1(MainPage)이 맡는다.
 * 데뷔가 아직 없으면(서비스 첫 달) 사진 없는 글자 표지 한 장.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BOARD_NAME, SNS_NAME, count, snsLinks } from "@/shared/lib/format";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { debutPhotos, type FeaturedCard } from "./api";
import { coverStart, readMyBoard } from "./myBoard";
import { PhotoFade } from "./PhotoFade";
import s from "./featured.module.css";

/** below: 표지 바로 아래 한 줄(메인은 데뷔 대각선 배너, #20) */
type Props = { debutMonth: string; debut: FeaturedCard[]; below?: React.ReactNode };

/** 1280 이상 표지가 다음 아이로 넘어가는 간격. 장 안의 사진 넘김(PhotoFade 4.5초)보다 느리게 */
const TURN_MS = 8000;
/** 저절로 넘기는 바퀴 수. 다 돌면 시작 장에서 멈춘다(WCAG 2.2.2, PhotoFade 와 같은 기준) */
const TURN_ROUNDS = 3;

/** 표지 i 번째 장으로 옮긴다. '움직임 줄이기'면 미끄러지지 않고 바로 */
function turnTo(el: HTMLElement | null, i: number, smooth = true) {
  el?.scrollTo({
    left: el.clientWidth * i,
    behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto",
  });
}

export function Cover({ debutMonth, debut, below }: Props) {
  const slides = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const sns = debut[at] ? snsLinks(debut[at]) : [];
  // 사람이 점을 눌러 고르면 그 장에 머문다(자동 넘김을 끝낸다)
  const picked = useRef(false);
  const go = (i: number) => {
    picked.current = true;
    turnTo(slides.current, i);
  };
  const n = debut.length;
  const start = useRef(debut);

  // 1. 처음 그릴 때 마지막으로 본 게시판 쪽 장으로 바로 옮긴다(휴대폰·1280 이상. 1024~1279 는 두 장이 다 보여 그대로)
  useEffect(() => {
    const i = coverStart(start.current, readMyBoard());
    if (i > 0) {
      turnTo(slides.current, i, false);
      setAt(i);
    }
  }, []);

  // 2. 1280 이상에서만 표지를 저절로 넘긴다. 휴대폰은 손으로 넘기고, 1024~1279 는 두 장이 나란히 다 보인다.
  //    화면에 보일 때만, 마우스·키보드 초점이 표지에 있으면 멈추고, '움직임 줄이기'면 넘기지 않는다.
  useEffect(() => {
    const el = slides.current;
    if (n < 2 || !el) return;
    const wide = window.matchMedia("(min-width: 1280px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let seen = false;
    let steps = 0;
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting));
    io.observe(el);
    // 멈춤 판정은 점 줄까지 포함한 표지 전체(.cover)로 본다
    const box = el.parentElement ?? el;
    const timer = window.setInterval(() => {
      if (picked.current) return window.clearInterval(timer);
      const held = box.matches(":hover") || box.contains(document.activeElement);
      if (!wide.matches || reduce.matches || !seen || held || document.hidden) return;
      if (steps >= n * TURN_ROUNDS) return window.clearInterval(timer);
      steps += 1;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      turnTo(el, (cur + 1) % n);
    }, TURN_MS);
    return () => {
      window.clearInterval(timer);
      io.disconnect();
    };
  }, [n]);

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
                <p>매주 픽으로 센터를 뽑고, 마지막 주차 데뷔 평가에서 댕댕이·냥이 한 마리씩 데뷔해요. 데뷔한 아이가 다음 달 표지 모델이에요.</p>
              </div>
            </div>
          ) : (
            debut.map((d, i) => (
              <Link key={d.entry_id} className={s.slide} href={`/${d.board}/${d.entry_id}`} aria-label={`${debutMonth}월 데뷔 ${BOARD_NAME[d.board]} ${d.pet_name}, ${count(d.votes)}표`}>
                {/* 시작 장이 기억에 따라 바뀌어 두 장 모두 먼저 받는다(많아야 두 장). 1280 이상은 장 넘김만 돌고 장 안 사진은 멈춘다 */}
                <PhotoFade paths={debutPhotos(d)} alt="" eager stillWhen="(min-width: 1280px)" />
                <span className={s.scrim} />
                {/* 1280 이상 잡지 표지 윗줄(표지 이름 + 몇 번째 장). 사이트 이름은 바로 위 로고가 맡아 넣지 않는다(#16). 그 밖의 폭은 숨김 */}
                <span className={s.mast} aria-hidden="true">
                  <b>이달의 커버 스타</b>
                  {n > 1 ? (
                    <span>
                      {i + 1} / {n}
                    </span>
                  ) : null}
                </span>
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
      <Impression key={debut[at]?.entry_id ?? "none"} className={s.act} ids={sns.length ? [debut[at].entry_id] : []} place="cover">
        {sns.length ? <span className={s.railSnsCap}>{debut[at].pet_name} SNS 구경 가기</span> : null}
        {sns.map((x) => (
          <SnsLink key={x.kind} className={s.railSnsBtn} entryId={debut[at].entry_id} sns={x} place="cover" iconSize="lg" label={`${debut[at].pet_name} ${SNS_NAME[x.kind]} ${x.handle}, 새 창`} />
        ))}
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
      {below}
    </div>
  );
}
