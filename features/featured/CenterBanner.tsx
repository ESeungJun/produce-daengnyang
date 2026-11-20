/**
 * 게시판 위 센터 카드(#20): 이번 주 강아지·고양이 센터(지난 주차 1위)를 사진 카드로 크게 보여 준다
 * (기획서 "1위는 다음 주 내내 사이트 곳곳에 걸린다"). 메인 데뷔조 후보 폴라로이드와 같은 모양.
 * 메인은 센터 화보가, 글 상세는 보던 아이에 집중하도록 넣지 않는다(#20). 지금 보는 게시판의 센터가 앞에 온다.
 * 카드를 누르면 글 상세, 아래 앱 아이콘은 그 아이 SNS. 노출·클릭은 place "banner" 로 남긴다.
 * 센터가 아직 없거나 읽지 못하면 그리지 않는다(페이지는 그대로 뜬다).
 */
import Link from "next/link";
import { BOARD_NAME, SNS_NAME, roundName, snsLinks, type Board } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { getFeatured } from "./server";
import s from "./featured.module.css";

export async function CenterBanner({ board }: { board?: Board }) {
  const all = await getFeatured()
    .then((f) => f.center)
    .catch(() => []);
  const center = board ? [...all].sort((a, b) => Number(b.board === board) - Number(a.board === board)) : all;
  if (!center.length) return null;
  return (
    <Impression className={s.centerCards} ids={center.filter((c) => snsLinks(c).length).map((c) => c.entry_id)} place="banner">
      <p className={s.centerCardsHead}>
        <b>지금 센터</b> 가장 최근 주간 투표 1위가 다음 결과까지 걸려요
      </p>
      <ul>
        {center.map((c) => {
          const list = snsLinks(c);
          return (
            <li key={c.entry_id} className={s.pola}>
              <Link href={`/${c.board}/${c.entry_id}`}>
                <img src={photoUrl(c.thumb_path) ?? undefined} alt="" loading="lazy" decoding="async" />
                <span>
                  <b>{c.pet_name}</b>
                  {Number(c.round_month.slice(5, 7))}월 {roundName("weekly", c.round_seq)} 1위 · {BOARD_NAME[c.board]}
                </span>
              </Link>
              {list.length ? (
                <span className={s.centerSns}>
                  {list.map((x) => (
                    <SnsLink key={x.kind} className={s.railSnsBtn} entryId={c.entry_id} sns={x} place="banner" iconOnly iconSize="sm" label={`${c.pet_name} ${SNS_NAME[x.kind]} ${x.handle}, 새 창`} />
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Impression>
  );
}
