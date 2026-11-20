-- #21 SNS 는 데뷔 후보(데뷔조)부터 공개: 인스타·스레드·유튜브 링크를 아무 글에나 보여 주지 않고, 순위 보상으로 연다.
-- 공개 조건(sns_open): 마지막 주차(결선) 글이거나, 확정된 주간 결과에서 보여 줄 수 있는 글 중 2위 안(숨긴 글을 건너뛴 순서,
-- get_featured 의 pos 와 같은 규칙이라 메인 데뷔조 후보와 어긋나지 않는다). 결선 글은 데뷔 후보를 복사한 글이라 늘 공개.
-- 글 주인은 고치기 화면에 자기 값을 채워야 하므로 get_entry 가 주인에게는 값을 그대로 주고, 화면이 sns_open 으로 보여 줄지 정한다.
-- entries 표는 직접 읽을 수 없으므로(rls.sql) 값이 나가는 길은 함수뿐이다. get_featured 는 원래 결과 줄(데뷔조·센터·데뷔)만 다룬다.
create or replace function public.sns_open(p_entry_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.entries e join public.rounds r on r.id = e.round_id
            where e.id = p_entry_id and r.kind = 'final')
      or exists (
           select 1
             from (select rr.entry_id,
                          row_number() over (partition by rr.round_id, rr.board order by rr.rank) as pos
                     from public.round_results rr
                     join public.rounds r on r.id = rr.round_id and r.kind = 'weekly' and r.finalized_at is not null
                     join public.entries e on e.id = rr.entry_id and e.deleted_at is null and e.hidden_at is null
                    where rr.round_id in (select x.round_id from public.round_results x where x.entry_id = p_entry_id)) ranked
            where ranked.entry_id = p_entry_id and ranked.pos <= 2)
$$;
revoke all on function public.sns_open(uuid) from public, anon, authenticated;

create or replace function public.get_entry(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when e.deleted_at is not null then jsonb_build_object('id', e.id, 'deleted', true)
  else jsonb_build_object(
    'id', e.id, 'board', e.board, 'pet_name', e.pet_name, 'bio', e.bio,
    -- 데뷔 후보가 아니면 남에게는 SNS 값을 주지 않는다(#21). 주인에게는 고치기용으로 준다
    'sns_open', s.open,
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
