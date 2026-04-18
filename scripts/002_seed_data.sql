-- MYP Atlas Phase 1 seed data (sample structure, real-product-aligned scope)

insert into public.subjects (name, code, description) values
  ('Mathematics', 'MATH', 'MYP eAssessment Mathematics papers and question records.'),
  ('Sciences', 'SCI', 'MYP eAssessment Sciences papers and question records.'),
  ('Language and Literature', 'LANG', 'MYP eAssessment Language and Literature papers and question records.'),
  ('Individuals and Societies', 'IAS', 'MYP eAssessment Individuals and Societies papers and question records.'),
  ('Language Acquisition', 'LACQ', 'MYP eAssessment Language Acquisition papers and question records.')
on conflict (code) do update
set description = excluded.description;

insert into public.exam_sessions (session_month, session_year, is_published)
values
  ('May', 2024, true),
  ('November', 2024, true),
  ('May', 2025, true)
on conflict (session_month, session_year) do update
set is_published = excluded.is_published;

with math as (
  select id as subject_id from public.subjects where code = 'MATH'
), may2024 as (
  select id as exam_session_id from public.exam_sessions where session_month = 'May' and session_year = 2024
)
insert into public.papers (
  subject_id, exam_session_id, title, year, paper_code, timezone,
  pdf_url, markscheme_url, markscheme_text, is_published, source_notes
)
select
  math.subject_id,
  may2024.exam_session_id,
  'Mathematics eAssessment Paper 1',
  2024,
  'MATH-2024-MAY-P1',
  'UTC',
  'https://example.org/myp/math-2024-may-paper-1.pdf',
  'https://example.org/myp/math-2024-may-paper-1-markscheme.pdf',
  'Sample markscheme excerpt for structure only. Replace with official source text.',
  true,
  'Seed sample: replace links/text with verified licensed archive sources.'
from math, may2024
on conflict do nothing;

with sci as (
  select id as subject_id from public.subjects where code = 'SCI'
), nov2024 as (
  select id as exam_session_id from public.exam_sessions where session_month = 'November' and session_year = 2024
)
insert into public.papers (
  subject_id, exam_session_id, title, year, paper_code, timezone,
  pdf_url, markscheme_url, markscheme_text, is_published, source_notes
)
select
  sci.subject_id,
  nov2024.exam_session_id,
  'Sciences eAssessment Paper 2',
  2024,
  'SCI-2024-NOV-P2',
  'UTC',
  'https://example.org/myp/sciences-2024-nov-paper-2.pdf',
  'https://example.org/myp/sciences-2024-nov-paper-2-markscheme.pdf',
  'Sample markscheme excerpt for structure only. Replace with official source text.',
  true,
  'Seed sample: replace links/text with verified licensed archive sources.'
from sci, nov2024
on conflict do nothing;

insert into public.topics (name) values
  ('Algebraic manipulation'),
  ('Functions'),
  ('Data interpretation'),
  ('Scientific reasoning')
on conflict (name) do nothing;

with p as (
  select id from public.papers where paper_code = 'MATH-2024-MAY-P1' limit 1
)
insert into public.questions (paper_id, question_number, prompt_text, marks, answer_mode, options_json, markscheme_text, is_published)
select p.id, q.question_number, q.prompt_text, q.marks, q.answer_mode, q.options_json::jsonb, q.markscheme_text, true
from p,
(
  values
    ('1', 'Solve the equation: 2x + 5 = 17.', 2, 'short_text', null, 'Award method and final-answer marks according to official markscheme.'),
    ('2', 'A linear function passes through (1,3) and (5,11). Find the gradient.', 3, 'numeric', null, 'Award marks for working and correct gradient.'),
    ('3', 'Which graph best represents y = x^2 - 4?', 1, 'multiple_choice', '["A","B","C","D"]', 'Award 1 mark for the correct option.')
) as q(question_number, prompt_text, marks, answer_mode, options_json, markscheme_text)
on conflict (paper_id, question_number) do update
set
  prompt_text = excluded.prompt_text,
  marks = excluded.marks,
  answer_mode = excluded.answer_mode,
  options_json = excluded.options_json,
  markscheme_text = excluded.markscheme_text,
  is_published = excluded.is_published;

with p as (
  select id from public.papers where paper_code = 'SCI-2024-NOV-P2' limit 1
)
insert into public.questions (paper_id, question_number, prompt_text, marks, answer_mode, markscheme_text, is_published)
select p.id, q.question_number, q.prompt_text, q.marks, q.answer_mode, q.markscheme_text, true
from p,
(
  values
    ('1', 'Describe one reason controlled variables are required in a fair test.', 2, 'short_text', 'Award 1 mark for identifying control variable purpose, 1 mark for clarity.'),
    ('2', 'Interpret the data table and state one supported conclusion.', 3, 'long_text', 'Award marks for evidence-linked conclusion.')
) as q(question_number, prompt_text, marks, answer_mode, markscheme_text)
on conflict (paper_id, question_number) do update
set
  prompt_text = excluded.prompt_text,
  marks = excluded.marks,
  answer_mode = excluded.answer_mode,
  markscheme_text = excluded.markscheme_text,
  is_published = excluded.is_published;

insert into public.question_topics (question_id, topic_id)
select q.id, t.id
from public.questions q
join public.papers p on p.id = q.paper_id
join public.topics t on t.name = 'Algebraic manipulation'
where p.paper_code = 'MATH-2024-MAY-P1' and q.question_number = '1'
on conflict do nothing;

insert into public.question_topics (question_id, topic_id)
select q.id, t.id
from public.questions q
join public.papers p on p.id = q.paper_id
join public.topics t on t.name = 'Functions'
where p.paper_code = 'MATH-2024-MAY-P1' and q.question_number = '2'
on conflict do nothing;

insert into public.question_topics (question_id, topic_id)
select q.id, t.id
from public.questions q
join public.papers p on p.id = q.paper_id
join public.topics t on t.name = 'Scientific reasoning'
where p.paper_code = 'SCI-2024-NOV-P2' and q.question_number = '1'
on conflict do nothing;
