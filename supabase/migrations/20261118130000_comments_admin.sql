-- ─────────────────────────────────────────────────────────────
-- #6 댓글·신고·관리자(설계서 5절, 기획서 4절)
-- 1. 금지어: has_banned_word(text). 댓글을 넣기 전에 add_comment 가 거른다(목록은 여기 한 곳).
-- 2. add_comment: 금지어 거절(banned_word), 알림 payload 에 게시판(board)을 더해 알림함이 글로 바로 잇는다.
-- 3. entry_comments: 전체 댓글 수(total)를 같이 준다("응원 댓글 N").
-- 4. 관리자: require_admin() → admin_reports · admin_set_hidden · admin_dismiss. 화면 권한과 별개로 함수가 다시 확인한다.
-- ─────────────────────────────────────────────────────────────

-- ── 1. 금지어 ───────────────────────────────────────────────
-- 띄어쓰기·기호·숫자를 빼고 찾는다("씨 1 발" 같은 우회). 흔한 낱말 안에 들어가는 것은 먼저 지운다(시발점·졸라맨).
-- 완벽하게 거를 수는 없다. 빠진 것은 신고 → 관리자 숨김으로 처리한다(기획서 7절 감수).
create function public.has_banned_word(p_text text) returns boolean
language sql immutable set search_path = '' as $$
  select replace(replace(lower(regexp_replace(coalesce(p_text, ''), '[[:space:][:punct:][:digit:]]', '', 'g')), '시발점', ''), '졸라맨', '')
         ~ '(씨발|시발|씨빨|씨바|ㅅㅂ|ㅆㅂ|병신|븅신|ㅂㅅ|개새끼|개새기|개색기|좆|존나|지랄|ㅈㄹ|미친놈|미친년|닥쳐|엿먹|느금|니애미|니애비|애미뒤|썅|싸가지|fuck|shit|bitch)'
$$;

-- ── 2. 댓글 쓰기 ────────────────────────────────────────────
create or replace function public.add_comment(p_entry_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_member();
  body text := trim(coalesce(p_body, ''));
  e public.entries;
  new_id uuid;
begin
  if char_length(body) not between 1 and 100 or public.has_hidden_chars(body) then
    raise exception using errcode = 'P0001', message = 'invalid_body';
  end if;
  if public.has_banned_word(body) then
    raise exception using errcode = 'P0001', message = 'banned_word';
  end if;
  select * into e from public.entries where id = p_entry_id and deleted_at is null and hidden_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  -- 도배 막기: 10분에 10개까지.
  if (select count(*) from public.comments c where c.author_id = uid and c.created_at > now() - interval '10 minutes') >= 10 then
    raise exception using errcode = 'P0001', message = 'too_fast';
  end if;
  insert into public.comments (entry_id, author_id, body) values (p_entry_id, uid, body) returning id into new_id;
  -- 글 주인 알림함(메일·푸시는 보내지 않음, 기획서 4절). board 는 알림함이 글 주소를 만드는 데 쓴다.
  if e.owner_id <> uid then
    insert into public.notifications (user_id, kind, payload)
    values (e.owner_id, 'comment', jsonb_build_object('entry_id', e.id, 'comment_id', new_id, 'pet_name', e.pet_name, 'board', e.board));
  end if;
  return new_id;
end $$;

-- ── 3. 댓글 목록(전체 수 포함) ───────────────────────────────
drop function public.entry_comments(uuid, int, int);
create function public.entry_comments(p_entry_id uuid, p_limit int default 30, p_offset int default 0)
returns table (id uuid, body text, nickname text, is_entry_owner boolean, is_mine boolean, created_at timestamptz, total int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.body, coalesce(pr.nickname, '집사'), c.author_id = e.owner_id, coalesce(c.author_id = auth.uid(), false), c.created_at,
         (count(*) over ())::int
    from public.comments c
    join public.entries e on e.id = c.entry_id
    left join public.profiles pr on pr.id = c.author_id
   where c.entry_id = p_entry_id and c.deleted_at is null and c.hidden_at is null
     and e.deleted_at is null and e.hidden_at is null
   order by c.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ── 4. 관리자 ───────────────────────────────────────────────
-- 회원이면서 profiles.is_admin 인 사람만. 관리자 지정은 SQL 로만 한다(화면에서 바꿀 길이 없다).
create function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := public.require_member();
begin
  if not exists (select 1 from public.profiles p where p.id = uid and p.is_admin) then
    raise exception using errcode = 'P0001', message = 'not_admin';
  end if;
  return uid;
end $$;

-- 처리 안 된 신고를 대상별로 묶어 보여 준다(신고 많은 순 → 최근 순).
-- 글이면 이름·사진·게시판, 댓글이면 본문과 어느 글의 댓글인지. author_id 는 봇 계정 정리 버튼이 쓴다.
create function public.admin_reports(p_limit int default 50)
returns table (
  target public.report_target, target_id uuid, reports int, last_at timestamptz, reasons text[],
  entry_id uuid, board public.board_kind, pet_name text, thumb_path text, body text,
  author_id uuid, author_name text, hidden boolean, deleted boolean
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
         coalesce(e.deleted_at, c.deleted_at) is not null
    from open_reports o
    left join public.entries e on o.target = 'entry' and e.id = o.target_id
    left join public.comments c on o.target = 'comment' and c.id = o.target_id
    left join public.entries ce on ce.id = c.entry_id
   order by o.n desc, o.last_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

-- 숨기기(또는 되살리기). 그 대상의 열린 신고는 처리됨으로 닫는다.
-- 숨긴 글은 게시판·상세·센터·결과 계산에서 빠진다(각 함수가 hidden_at 을 본다). 주인에게는 "관리자가 숨긴 글"로 보인다.
create function public.admin_set_hidden(p_target public.report_target, p_target_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_target = 'entry' then
    update public.entries set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_target_id;
  else
    update public.comments set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_target_id;
  end if;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  update public.reports set resolved_at = now() where target = p_target and target_id = p_target_id and resolved_at is null;
end $$;

-- 신고 기각(문제없음): 숨기지 않고 신고만 닫는다.
create function public.admin_dismiss(p_target public.report_target, p_target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.reports set resolved_at = now() where target = p_target and target_id = p_target_id and resolved_at is null;
end $$;

create index reports_open_idx on public.reports (target, target_id) where resolved_at is null;

-- ── 실행 권한 ───────────────────────────────────────────────
revoke execute on function
  public.has_banned_word(text), public.require_admin(), public.entry_comments(uuid, int, int),
  public.admin_reports(int), public.admin_set_hidden(public.report_target, uuid, boolean), public.admin_dismiss(public.report_target, uuid)
from public, anon, authenticated;
grant execute on function public.entry_comments(uuid, int, int) to anon, authenticated;
-- 관리자 함수는 회원 역할에 열고, 안에서 require_admin 으로 다시 막는다.
grant execute on function
  public.admin_reports(int), public.admin_set_hidden(public.report_target, uuid, boolean), public.admin_dismiss(public.report_target, uuid)
to authenticated;
