-- #31 데뷔 화보 맺음 기록
-- 맺음의 "{게시판} 연습생 픽하러 가기"가 화보를 본 사람을 투표로 얼마나 데려가는지 센다.
-- 1. 종류 pick_cta(맺음 픽하러 가기 클릭)를 더한다.
-- 2. 자리 debut_back(데뷔 화보 맺음)을 더한다. 화보 상세 노출(debut)과 나눠야 "끝까지 내려온 사람 중 몇 명이 눌렀나"를 셀 수 있다
--    (같은 사람·날·글·자리·종류는 한 번만 세므로 debut 자리에 view 를 또 남기면 묻힌다).
alter table public.sns_events drop constraint sns_events_kind_check;
alter table public.sns_events add constraint sns_events_kind_check
  check (kind in ('view', 'instagram', 'threads', 'youtube', 'share_sheet', 'share_copy', 'share_manual', 'share_visit',
                  'share_insta_story', 'share_insta_feed', 'share_insta_save', 'pick_cta'));
alter table public.sns_events drop constraint sns_events_place_check;
alter table public.sns_events add constraint sns_events_place_check
  check (place in ('cover', 'center', 'banner', 'detail', 'register', 'debut', 'debut_back'));

create or replace function public.record_sns(p_entry_ids uuid[], p_kind text, p_place text, p_viewer_key text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  today date := public.kst_today();
begin
  if p_kind is null or p_place is null
     or p_kind not in ('view', 'instagram', 'threads', 'youtube', 'share_sheet', 'share_copy', 'share_manual', 'share_visit', 'share_insta_story', 'share_insta_feed', 'share_insta_save', 'pick_cta')
     or p_place not in ('cover', 'center', 'banner', 'detail', 'register', 'debut', 'debut_back')
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
