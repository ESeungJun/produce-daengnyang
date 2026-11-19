-- #24 데뷔 후속
-- 1. get_entry: 주간 글(옛 공유 링크)로 들어와도 그 아이가 데뷔했으면 알 수 있게 debut_link(데뷔한 결선 복사본 id·달)를 더한다.
-- 2. 공유·SNS 기록 자리에 debut(데뷔 화보 상세)를 더해 화보에서 시작한 공유·저장·SNS 이동을 일반 상세(detail)와 나눠 센다.
alter table public.sns_events drop constraint sns_events_place_check;
alter table public.sns_events add constraint sns_events_place_check
  check (place in ('cover', 'center', 'banner', 'detail', 'register', 'debut'));

create or replace function public.record_sns(p_entry_ids uuid[], p_kind text, p_place text, p_viewer_key text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  today date := public.kst_today();
begin
  if p_kind is null or p_place is null
     or p_kind not in ('view', 'instagram', 'threads', 'youtube', 'share_sheet', 'share_copy', 'share_manual', 'share_visit', 'share_insta_story', 'share_insta_feed', 'share_insta_save')
     or p_place not in ('cover', 'center', 'banner', 'detail', 'register', 'debut')
     or p_viewer_key is null or char_length(p_viewer_key) not between 8 and 64
     or p_entry_ids is null or cardinality(p_entry_ids) not between 1 and 8 then
    return 0;
  end if;
  if coalesce((select d.n from public.sns_daily d where d.kst_date = today), 0) >= 200000 then
    return 0;
  end if;
  insert into public.sns_events (entry_id, kind, place, viewer_key, kst_date)
  select e.id, p_kind, p_place, p_viewer_key, today
    from public.entries e
   where e.id = any (p_entry_ids) and e.deleted_at is null and e.hidden_at is null
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.sns_daily as d (kst_date, n) values (today, n)
    on conflict (kst_date) do update set n = d.n + excluded.n;
  end if;
  return n;
end $$;

create or replace function public.get_entry(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when e.deleted_at is not null then jsonb_build_object('id', e.id, 'deleted', true)
  else jsonb_build_object(
    'id', e.id, 'board', e.board, 'pet_name', e.pet_name, 'bio', e.bio,
    -- 데뷔 후보가 아니면 남에게는 SNS 값을 주지 않는다(#21). 주인에게는 고치기용으로 준다
    'sns_open', s.open,
    -- #17 데뷔 글이면 화보 상세를 그리고, 주인이 더한 화보 사진(gallery)을 함께 준다
    'debut', public.is_debut(e.id),
    -- #24 주간 글(옛 공유 링크)의 결선 복사본이 데뷔했으면 그 글로 가는 띠를 그린다. 자기가 데뷔 글이면 null
    'debut_link', case when not public.is_debut(e.id) then (
        select jsonb_build_object('id', c.id, 'month', cr.month)
          from public.entries c join public.rounds cr on cr.id = c.round_id
         where c.source_entry_id = e.id and c.deleted_at is null and c.hidden_at is null and public.is_debut(c.id)
         limit 1) end,
    -- 데뷔가 풀린 글의 화보는 내주지 않는다(주인은 /gallery 에서 비울 수 있다)
    'gallery', case when public.is_debut(e.id) then (select coalesce(jsonb_agg(jsonb_build_object('path', dp.path, 'thumb_path', dp.thumb_path) order by dp.position), '[]'::jsonb)
                  from public.debut_photos dp where dp.entry_id = e.id) else '[]'::jsonb end,
    'instagram', case when s.open or e.owner_id = auth.uid() then e.instagram end,
    'threads', case when s.open or e.owner_id = auth.uid() then e.threads end,
    'youtube', case when s.open or e.owner_id = auth.uid() then e.youtube end,
    'pick_count', case when public.is_blind(r) then null else e.pick_count end,
    'view_count', case when public.is_blind(r) then null else e.view_count end,
    'created_at', e.created_at, 'hidden', e.hidden_at is not null, 'deleted', false,
    'is_mine', coalesce(e.owner_id = auth.uid(), false),
    'photos_locked', case when e.owner_id = auth.uid() then e.pick_count > 0 or e.source_entry_id is not null end,
    'picked_today', exists (select 1 from public.picks p where p.voter_id = auth.uid() and p.entry_id = e.id and p.kst_date = public.kst_today()),
    'round', jsonb_build_object('id', r.id, 'kind', r.kind, 'seq', r.seq, 'month', r.month,
                                'starts_at', r.starts_at, 'ends_at', r.ends_at,
                                'open', now() >= r.starts_at and now() < r.ends_at, 'blind', public.is_blind(r)),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('path', ph.path, 'thumb_path', ph.thumb_path) order by ph.position), '[]'::jsonb)
                 from public.entry_photos ph where ph.entry_id = e.id)
  ) end
    from public.entries e
    join public.rounds r on r.id = e.round_id
    cross join lateral (select public.sns_open(e.id) as open) s
   where e.id = p_entry_id
     and (e.deleted_at is not null or e.hidden_at is null or e.owner_id = auth.uid())
$$;
