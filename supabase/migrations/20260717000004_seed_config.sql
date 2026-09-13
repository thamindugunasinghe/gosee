-- GoSee — Section 12 configuration defaults (all values editable in the dashboard)

insert into system_config (key, value, description) values
  ('scheduling_window_hours',        '72',   'Active scheduling window: how far ahead an engineer may select'),
  ('min_lead_time_hours',            '24',   'Minimum lead time before the earliest selectable slot'),
  ('slot_increment_minutes',         '30',   'Timeline granularity / minimum visit duration'),
  ('working_days',                   '[1,2,3,4,5,6]', 'ISO weekday numbers (Mon=1 .. Sun=7) selectable for visits'),
  ('working_hours_start',            '"08:00"', 'Site working hours start'),
  ('working_hours_end',              '"17:00"', 'Site working hours end'),
  ('confirmation_threshold',         '3',    'Available responses that lock the selected time'),
  ('override_count',                 '2',    'Exactly this many Available at cutoff triggers Procurement override'),
  ('response_cutoff_hours',          '24',   'Hours before visit when the final count decision runs'),
  ('min_suppliers_invited',          '3',    'Warn when fewer suppliers are selected'),
  ('supplier_reminder_after_invite_hours', '6', 'First supplier response reminder delay'),
  ('supplier_reminder_before_cutoff_hours', '2', 'Second supplier response reminder before cutoff'),
  ('engineer_closure_grace_minutes', '60',   'After visit time before closure reminders begin'),
  ('engineer_closure_reminder_minutes', '60', 'Repeat frequency of engineer closure reminders'),
  ('procurement_closure_sla_days',   '3',    'Days after engineer close to close / recirculate / cancel'),
  ('manager_escalation_repeat_hours','24',   'Repeat frequency of overdue manager alerts'),
  ('suggestion_gap_minutes',         '45',   'Recommended gap before/after an existing supplier visit'),
  ('otp_validity_minutes',           '5',    'OTP validity period'),
  ('otp_resend_seconds',             '60',   'OTP resend cooldown'),
  ('otp_max_attempts',               '5',    'OTP attempt lockout'),
  ('languages',                      '["en","si","ta"]', 'Available app and SMS template languages')
on conflict (key) do nothing;
