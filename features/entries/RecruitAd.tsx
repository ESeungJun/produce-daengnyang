/**
 * 모집 공고: 큰 제목 + 규칙 목록 + 등록 버튼. 메인·게시판 맨 아래에 둔다. 결선 기간(closed)에는 버튼 대신 다시 여는 날을 알린다.
 * wide(메인, #16): 화면 폭 전체를 쓰는 긴 띠. 오른쪽에 포스터(지금 연습생 사진 몇 장을 붙인 모집 포스터, 꾸밈이라 읽기 도구에서 숨김).
 * 포스터 사진이 없으면(첫 라운드) 글자만 있는 포스터.
 */
import { photoUrl } from "@/shared/lib/supabase/env";
import { RegisterButton } from "./RegisterButton";
import s from "./entries.module.css";

type Props = { id?: string; title?: string; closed?: boolean; wide?: boolean; poster?: string[] };

export function RecruitAd({ id, title = "우리 애도 연습생으로!", closed = false, wide = false, poster = [] }: Props) {
  return (
    <section id={id} className={`${s.ad} ${wide ? s.adWide : ""}`} aria-labelledby={id ? `${id}-t` : undefined}>
      <div className={s.adText}>
        <h2 id={id ? `${id}-t` : undefined}>{title}</h2>
        <ul>
          <li>사진 1~3장 + 이름 + SNS(선택)</li>
          <li>1~3주차마다 댕댕이·냥이 합쳐 2번까지</li>
          <li>주간 1위는 다음 결과가 나올 때까지 사이트에 걸려요</li>
          {wide ? <li>마지막 주차 1위는 데뷔! 다음 달 내내 메인에 걸려요</li> : null}
        </ul>
        {closed ? <p className={s.adNote}>지금은 데뷔 평가 기간이라 등록을 쉬어요. 다음 달 1일부터 다시 받아요.</p> : <RegisterButton className={s.adBtn} />}
      </div>
      {wide ? (
        <div className={s.poster} aria-hidden="true">
          <span className={s.posterTop}>프로듀스 댕냥 · 연습생 모집</span>
          {poster.length ? (
            <span className={s.posterPics} data-n={Math.min(poster.length, 4)}>
              {poster.slice(0, 4).map((p) => (
                <img key={p} src={photoUrl(p) ?? undefined} alt="" loading="lazy" decoding="async" />
              ))}
            </span>
          ) : (
            <span className={s.posterEmpty}>첫 번째 연습생 자리</span>
          )}
          <span className={s.posterBig}>다음 센터는 너야</span>
          <span className={s.posterFoot}>매달 1·8·15일 0시 등록 시작 · 픽은 언제나 무료</span>
        </div>
      ) : null}
    </section>
  );
}
