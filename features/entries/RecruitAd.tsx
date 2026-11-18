/** 모집 공고: 큰 제목 + 규칙 목록 + 등록 버튼. 메인·게시판 맨 아래에 둔다. 결선 기간(closed)에는 버튼 대신 다시 여는 날을 알린다. */
import { RegisterButton } from "./RegisterButton";
import s from "./entries.module.css";

export function RecruitAd({ id, title = "우리 애도 연습생으로!", closed = false }: { id?: string; title?: string; closed?: boolean }) {
  return (
    <section id={id} className={s.ad} aria-labelledby={id ? `${id}-t` : undefined}>
      <h2 id={id ? `${id}-t` : undefined}>{title}</h2>
      <ul>
        <li>사진 1~3장 + 이름 + SNS(선택)</li>
        <li>라운드마다 댕댕이·냥이 합쳐 2번까지</li>
        <li>1위는 다음 주 내내 사이트에 걸려요</li>
      </ul>
      {closed ? <p className={s.adNote}>지금은 데뷔 평가 기간이라 등록을 쉬어요. 다음 달 1일부터 다시 받아요.</p> : <RegisterButton className={s.adBtn} />}
    </section>
  );
}
