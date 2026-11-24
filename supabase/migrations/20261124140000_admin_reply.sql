-- #40 관리자가 주인 답글을 보고 답글만 지우기
-- 1. admin_reports: 댓글 신고 줄에 그 댓글의 주인 답글(reply_body)도 준다. 답글은 따로 신고하지 않고 댓글 신고로 같이 들어온다(2026-11-24 사용자 결정).
-- 2. admin_remove_reply: 답글만 지운다. 댓글 본문은 그대로 둔다.
--    replied_at 은 남긴다. 비우면 주인이 다시 답글을 달 수 있게 되는데, reply_comment 가 "한 번만" 막는 까닭(알림 뒤 몰래 바꾸기)과 같아 다시 쓰지 못하게 한다.
--    신고는 닫지 않는다. 댓글 본문도 문제면 이어서 숨기고, 괜찮으면 "문제없음"으로 닫는다.
-- 3. admin_actions 에 remove_reply 를 남긴다.

alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in ('hide', 'unhide', 'dismiss', 'purge_user', 'recalc', 'remove_reply'));

-- 돌려주는 줄 모양이 바뀌므로 지우고 다시 만든다(본문은 reply_body 한 칸만 더함)
drop function public.admin_reports(int);
create function public.admin_reports(p_limit int default 50)
returns table (
  target public.report_target, target_id uuid, reports int, last_at timestamptz, reasons text[],
  entry_id uuid, board public.board_kind, pet_name text, thumb_path text, body text,
  author_id uuid, author_name text, hidden boolean, deleted boolean,
  reply_body text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  with open_reports as (
    select r.target, r.target_id, count(*)::int as n, max(r.created_at) as last_at,
           array_remove(array_agg(r.reason order by r.created_at desc), null) as reasons
      from public.reports r
     where r.resolved_at is null
     group by r.target, r.target_id
  )
  select o.target, o.target_id, o.n, o.last_at, o.reasons,
         coalesce(e.id, ce.id), coalesce(e.board, ce.board), coalesce(e.pet_name, ce.pet_name),
         (select ph.thumb_path from public.entry_photos ph where ph.entry_id = coalesce(e.id, ce.id) and ph.position = 0),
         c.body,
         coalesce(e.owner_id, c.author_id),
         (select pr.nickname from public.profiles pr where pr.id = coalesce(e.owner_id, c.author_id)),
         coalesce(e.hidden_at, c.hidden_at) is not null,
         coalesce(e.deleted_at, c.deleted_at) is not null,
         c.reply_body
    from open_reports o
    left join public.entries e on o.target = 'entry' and e.id = o.target_id
    left join public.comments c on o.target = 'comment' and c.id = o.target_id
    left join public.entries ce on ce.id = c.entry_id
   where coalesce(e.id, c.id) is not null
   order by o.n desc, o.last_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

create function public.admin_remove_reply(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_admin();
begin
  update public.comments set reply_body = null where id = p_comment_id and reply_body is not null;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  insert into public.admin_actions (actor_id, action, target, target_id) values (uid, 'remove_reply', 'comment', p_comment_id);
end $$;

-- 관리자 함수는 회원 역할에 열고, 안에서 require_admin 으로 다시 막는다(다른 관리자 함수와 같게)
revoke execute on function public.admin_reports(int), public.admin_remove_reply(uuid) from public, anon, authenticated;
grant execute on function public.admin_reports(int), public.admin_remove_reply(uuid) to authenticated;
