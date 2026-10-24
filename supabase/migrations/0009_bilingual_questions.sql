-- Two branches were filed as Jewellery; both are automobile showrooms (also changes their offer letter wording).
update branches set business_type = 'Automobiles' where name in ('Balsanka Cycle - Theni', 'Balasanka TVS - Tenkasi');

-- Every apply-page question, option and section in English and Tamil. Past applications keep the wording they were sent with.
with t (old_label, label, section, options) as (values
  ('Gender', 'Gender / பாலினம்', 'About you / உங்களைப் பற்றி', array['Male / ஆண்', 'Female / பெண்', 'Other / மற்றவை']),
  ('Date Of Birth', 'Date of birth / பிறந்த தேதி', 'About you / உங்களைப் பற்றி', null),
  ('Educational Qualification', 'Educational qualification / கல்வித் தகுதி', 'About you / உங்களைப் பற்றி', null),
  ('Are you a Fresher or Experienced? / நீங்கள் Fresher-ஆ அல்லது முன் அனுபவம் உள்ளவரா?', 'Fresher or experienced? / புதியவரா அல்லது அனுபவம் உள்ளவரா?',
     'Experience / பணி அனுபவம்', array['Fresher / புதியவர்', 'Experienced / அனுபவம் உள்ளவர்']),
  ('Expected Salary', 'Expected salary per month / எதிர்பார்க்கும் மாதச் சம்பளம்', 'Experience / பணி அனுபவம்', null),
  ('Name of the Last Worked Company & Total Experience', 'Last company & total experience / கடைசியாக பணிபுரிந்த நிறுவனம் & மொத்த அனுபவம்', 'Experience / பணி அனுபவம்', null),
  ('Last Drawn Salary', 'Last drawn salary per month / கடைசியாகப் பெற்ற மாதச் சம்பளம்', 'Experience / பணி அனுபவம்', null),
  ('Experience Certificate', 'Experience certificate / அனுபவச் சான்றிதழ்', 'Experience / பணி அனுபவம்', null),
  ('Salary Proof', 'Salary proof (payslip or bank statement) / சம்பளச் சான்று', 'Experience / பணி அனுபவம்', null),
  ('Passport Size Photo', 'Passport size photo / பாஸ்போர்ட் அளவு புகைப்படம்', 'Documents / ஆவணங்கள்', null),
  ('Resume or Biodata', 'Resume or biodata / சுயவிவரம்', 'Documents / ஆவணங்கள்', null)
)
update application_questions q set label = t.label, section = t.section, options = coalesce(t.options, q.options), updated_at = now()
from t where q.label = t.old_label and q.active;

-- the follow-up questions now match the bilingual answer
update application_questions set show_when = jsonb_set(show_when, '{equals}', '"Experienced / அனுபவம் உள்ளவர்"')
where show_when ->> 'equals' = 'Experienced';
