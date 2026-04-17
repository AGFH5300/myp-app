-- Seed data for MYP eAssessment Platform

-- Insert MYP Subject Groups
insert into public.subjects (name, code, description, color, icon) values
  ('Mathematics', 'MATH', 'MYP Mathematics - Number, Algebra, Geometry, Statistics', '#3b82f6', 'calculator'),
  ('Sciences', 'SCI', 'MYP Sciences - Biology, Chemistry, Physics', '#22c55e', 'flask'),
  ('Language and Literature', 'LANG', 'MYP Language and Literature - English', '#f59e0b', 'book'),
  ('Individuals and Societies', 'IAS', 'MYP Individuals and Societies - History, Geography, Economics', '#8b5cf6', 'globe'),
  ('Language Acquisition', 'LACQ', 'MYP Language Acquisition - French, Spanish, Mandarin', '#ec4899', 'languages'),
  ('Design', 'DES', 'MYP Design - Digital and Product Design', '#06b6d4', 'pencil-ruler'),
  ('Arts', 'ARTS', 'MYP Arts - Visual Arts, Music, Drama', '#f43f5e', 'palette'),
  ('Physical and Health Education', 'PHE', 'MYP Physical and Health Education', '#84cc16', 'heart-pulse')
on conflict (code) do nothing;

-- Insert sample papers for Mathematics
insert into public.papers (subject_id, title, year, session, timezone, paper_number, duration_minutes, total_marks, description) 
select 
  s.id,
  'Mathematics Extended Paper 1',
  2024,
  'May',
  'TZ1',
  1,
  90,
  80,
  'Extended mathematics paper covering algebra, functions, and geometry'
from public.subjects s where s.code = 'MATH'
on conflict do nothing;

insert into public.papers (subject_id, title, year, session, timezone, paper_number, duration_minutes, total_marks, description) 
select 
  s.id,
  'Mathematics Extended Paper 2',
  2024,
  'May',
  'TZ1',
  2,
  90,
  80,
  'Extended mathematics paper covering statistics, probability, and calculus'
from public.subjects s where s.code = 'MATH'
on conflict do nothing;

insert into public.papers (subject_id, title, year, session, timezone, paper_number, duration_minutes, total_marks, description) 
select 
  s.id,
  'Mathematics Standard Paper 1',
  2024,
  'May',
  'TZ1',
  1,
  60,
  60,
  'Standard mathematics paper covering core concepts'
from public.subjects s where s.code = 'MATH'
on conflict do nothing;

-- Insert sample papers for Sciences
insert into public.papers (subject_id, title, year, session, timezone, paper_number, duration_minutes, total_marks, description) 
select 
  s.id,
  'Sciences Paper 1 - Biology Focus',
  2024,
  'May',
  'TZ1',
  1,
  75,
  70,
  'Sciences paper with emphasis on biological concepts'
from public.subjects s where s.code = 'SCI'
on conflict do nothing;

insert into public.papers (subject_id, title, year, session, timezone, paper_number, duration_minutes, total_marks, description) 
select 
  s.id,
  'Sciences Paper 2 - Chemistry Focus',
  2024,
  'May',
  'TZ1',
  2,
  75,
  70,
  'Sciences paper with emphasis on chemical concepts'
from public.subjects s where s.code = 'SCI'
on conflict do nothing;

-- Insert sample questions for Mathematics Paper 1
with math_paper as (
  select p.id from public.papers p 
  join public.subjects s on p.subject_id = s.id 
  where s.code = 'MATH' and p.title like '%Extended Paper 1%'
  limit 1
)
insert into public.questions (paper_id, question_number, question_text, question_type, marks, command_term, criterion, strand, correct_answer, mark_scheme, order_index)
select 
  mp.id,
  q.question_number,
  q.question_text,
  q.question_type,
  q.marks,
  q.command_term,
  q.criterion,
  q.strand,
  q.correct_answer,
  q.mark_scheme,
  q.order_index
from math_paper mp,
(values
  ('1a', 'Solve the equation: 2x + 5 = 17', 'short_answer', 2, 'Solve', 'A', 'Algebra', 'x = 6', 'Award 1 mark for correct method, 1 mark for correct answer', 1),
  ('1b', 'Solve the equation: 3(x - 2) = 12', 'short_answer', 3, 'Solve', 'A', 'Algebra', 'x = 6', 'Award 1 mark for expanding brackets, 1 mark for isolating x, 1 mark for correct answer', 2),
  ('2', 'A rectangle has length (2x + 3) cm and width (x - 1) cm. If the perimeter is 38 cm, find the value of x.', 'structured', 5, 'Find', 'A', 'Algebra', 'x = 6', 'Award 2 marks for setting up equation, 2 marks for solving, 1 mark for checking', 3),
  ('3a', 'Calculate the gradient of the line passing through points (2, 5) and (6, 13).', 'short_answer', 2, 'Calculate', 'A', 'Geometry', 'm = 2', 'Award 1 mark for correct formula, 1 mark for correct answer', 4),
  ('3b', 'Find the equation of this line in the form y = mx + c.', 'short_answer', 3, 'Find', 'A', 'Geometry', 'y = 2x + 1', 'Award 1 mark for gradient, 1 mark for y-intercept calculation, 1 mark for final equation', 5),
  ('4', 'Simplify: (3x²y³)² ÷ (9xy²)', 'short_answer', 4, 'Simplify', 'A', 'Algebra', 'x³y⁴', 'Award 1 mark for each correct step in simplification', 6),
  ('5', 'The sum of three consecutive integers is 72. Find the integers.', 'structured', 4, 'Find', 'B', 'Number', '23, 24, 25', 'Award 2 marks for setting up equation, 1 mark for solving, 1 mark for stating all three integers', 7),
  ('6', 'A car travels 240 km at an average speed of 60 km/h. It then travels a further 180 km at 45 km/h. Calculate the average speed for the whole journey.', 'extended_response', 6, 'Calculate', 'C', 'Number', '52.5 km/h', 'Award marks for: time calculations (2), total time (1), total distance (1), average speed formula (1), correct answer (1)', 8),
  ('7a', 'Factorize completely: x² - 9', 'short_answer', 2, 'Factorize', 'A', 'Algebra', '(x+3)(x-3)', 'Award 2 marks for correct factorization using difference of squares', 9),
  ('7b', 'Factorize completely: 2x² + 5x - 3', 'short_answer', 3, 'Factorize', 'A', 'Algebra', '(2x-1)(x+3)', 'Award 1 mark for correct factors of 2x², 1 mark for correct factors of -3, 1 mark for correct final answer', 10)
) as q(question_number, question_text, question_type, marks, command_term, criterion, strand, correct_answer, mark_scheme, order_index)
on conflict do nothing;

-- Insert sample questions for Sciences Paper 1
with sci_paper as (
  select p.id from public.papers p 
  join public.subjects s on p.subject_id = s.id 
  where s.code = 'SCI' and p.title like '%Biology%'
  limit 1
)
insert into public.questions (paper_id, question_number, question_text, question_type, marks, command_term, criterion, strand, options, correct_answer, mark_scheme, order_index)
select 
  sp.id,
  q.question_number,
  q.question_text,
  q.question_type,
  q.marks,
  q.command_term,
  q.criterion,
  q.strand,
  q.options::jsonb,
  q.correct_answer,
  q.mark_scheme,
  q.order_index
from sci_paper sp,
(values
  ('1', 'Which organelle is responsible for photosynthesis in plant cells?', 'multiple_choice', 1, 'Identify', 'A', 'Biology', '["Mitochondria", "Chloroplast", "Nucleus", "Ribosome"]', 'Chloroplast', 'Award 1 mark for correct answer', 1),
  ('2', 'State the function of the mitochondria in a cell.', 'short_answer', 2, 'State', 'A', 'Biology', null, 'To carry out cellular respiration / produce ATP / release energy from glucose', 'Award 1 mark for mentioning respiration or energy, 1 mark for ATP or glucose', 2),
  ('3', 'Describe the structure and function of the cell membrane.', 'extended_response', 6, 'Describe', 'B', 'Biology', null, 'Phospholipid bilayer, selectively permeable, controls what enters and leaves the cell', 'Award marks for: structure description (2), phospholipid mention (1), function (2), selectively permeable (1)', 3),
  ('4', 'Explain why plants appear green.', 'short_answer', 3, 'Explain', 'C', 'Biology', null, 'Chlorophyll absorbs red and blue light but reflects green light', 'Award 1 mark for chlorophyll, 1 mark for absorption, 1 mark for reflection of green', 4),
  ('5', 'Which gas is released during photosynthesis?', 'multiple_choice', 1, 'Identify', 'A', 'Biology', '["Carbon dioxide", "Nitrogen", "Oxygen", "Hydrogen"]', 'Oxygen', 'Award 1 mark for correct answer', 5),
  ('6', 'Write the word equation for photosynthesis.', 'short_answer', 3, 'State', 'A', 'Biology', null, 'Carbon dioxide + Water → Glucose + Oxygen', 'Award 1 mark for reactants, 1 mark for products, 1 mark for correct format', 6),
  ('7', 'Compare and contrast aerobic and anaerobic respiration.', 'extended_response', 8, 'Compare', 'D', 'Biology', null, 'Aerobic uses oxygen, produces more ATP, occurs in mitochondria. Anaerobic does not use oxygen, produces less ATP, can occur in cytoplasm', 'Award marks for: oxygen use (2), ATP comparison (2), location (2), products comparison (2)', 7),
  ('8', 'Calculate the magnification of a microscope with an eyepiece lens of 10x and an objective lens of 40x.', 'short_answer', 2, 'Calculate', 'A', 'Biology', null, '400x', 'Award 1 mark for correct method (multiplication), 1 mark for correct answer', 8)
) as q(question_number, question_text, question_type, marks, command_term, criterion, strand, options, correct_answer, mark_scheme, order_index)
on conflict do nothing;
