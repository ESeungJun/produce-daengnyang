-- #15 공유 기록. 기존 SNS 이동률 기록(record_sns, sns_events)에 공유 종류·자리를 더한다.
-- 종류: share_sheet(휴대폰 공유 창) · share_copy(문구 복사) · share_manual(복사가 막혀 직접 고르는 칸을 띄움) · share_visit(공유 주소 ?ref=share 로 들어옴)
-- 자리: register(등록 직후 띠)를 더한다. 글 상세는 기존 detail.
-- 같은 사람(방문자 키)·날·글·자리·종류는 한 번만 세고, 하루 20만 줄 상한·90일 정리는 그대로 따른다.
alter table public.sns_events drop constraint sns_events_kind_check;
alter table public.sns_events add constraint sns_events_kind_check
  check (kind in ('view', 'instagram', 'threads', 'youtube', 'share_sheet', 'share_copy', 'share_manual', 'share_visit'));
alter table public.sns_events drop constraint sns_events_place_check;
alter table public.sns_events add constraint sns_events_place_check
  check (place in ('cover', 'center', 'banner', 'detail', 'register'));

create or replace function public.record_sns(p_entry_ids uuid[], p_kind text, p_place text, p_viewer_key text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  today date := public.kst_today();
begin
  if p_kind is null or p_place is null
     or p_kind not in ('view', 'instagram', 'threads', 'youtube', 'share_sheet', 'share_copy', 'share_manual', 'share_visit')
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
