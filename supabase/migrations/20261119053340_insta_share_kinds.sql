-- #18 데뷔 화보를 인스타 이미지로 올리기. 공유 기록 종류를 더한다.
-- share_insta_story · share_insta_feed: 휴대폰 공유창으로 스토리·피드 이미지를 넘김
-- share_insta_save: 공유창이 파일을 못 받아(컴퓨터 등) 이미지를 저장함
-- 자리는 기존 detail(데뷔 화보 상세). 하루 한 번·상한·정리 규칙은 그대로다(record_sns 본문은 종류 목록만 바뀐다).
alter table public.sns_events drop constraint sns_events_kind_check;
alter table public.sns_events add constraint sns_events_kind_check
  check (kind in ('view', 'instagram', 'threads', 'youtube', 'share_sheet', 'share_copy', 'share_manual', 'share_visit',
                  'share_insta_story', 'share_insta_feed', 'share_insta_save'));

create or replace function public.record_sns(p_entry_ids uuid[], p_kind text, p_place text, p_viewer_key text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  today date := public.kst_today();
begin
  if p_kind is null or p_place is null
     or p_kind not in ('view', 'instagram', 'threads', 'youtube', 'share_sheet', 'share_copy', 'share_manual', 'share_visit', 'share_insta_story', 'share_insta_feed', 'share_insta_save')
     or p_place not in ('cover', 'center', 'banner', 'detail', 'register')
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
