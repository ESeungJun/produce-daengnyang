-- #47 관리자 "답글만 지우기"는 아직 처리하지 않은 신고가 있는 댓글에만
-- 화면은 신고 목록에서만 버튼을 보여 주지만, 함수는 관리자가 아무 댓글 id 로나 부를 수 있었다.
-- 신고가 닫힌 뒤(문제없음·숨김) 같은 줄을 다시 누르거나 id 를 직접 넣어 신고 없는 답글을 지우는 것을 막는다.
-- 신고가 없으면 'not_reported', 신고는 있는데 지울 답글이 없으면 지금처럼 'not_found'.
create or replace function public.admin_remove_reply(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_admin();
begin
  -- 열린 신고 줄을 잠가, 확인과 지우기 사이에 다른 관리자가 신고를 닫지 못하게 한다
  perform 1 from public.reports
   where target = 'comment' and target_id = p_comment_id and resolved_at is null
     for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_reported';
  end if;
  update public.comments set reply_body = null where id = p_comment_id and reply_body is not null;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  insert into public.admin_actions (actor_id, action, target, target_id) values (uid, 'remove_reply', 'comment', p_comment_id);
end $$;
