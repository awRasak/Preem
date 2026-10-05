-- Show tickets join the single withdrawable pot. The artist who created the
-- show is owed 95% of every successful ticket sale (Preem keeps a flat 5%).
--
-- Settlement mirrors gifts/merch -- a per-row paid_out flag that the
-- claim-then-pay withdraw flips exactly once -- because a ticket has no
-- split sheet: the show's owner is the only payee, so there is no ledger of
-- per-artist shares to reconcile. Existing success rows read back false and
-- become claimable the moment the withdrawal code below ships.
alter table show_tickets
  add column if not exists paid_out boolean not null default false;
