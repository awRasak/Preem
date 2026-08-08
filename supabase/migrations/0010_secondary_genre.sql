-- Optional secondary genre tag, alongside the existing required genre.
alter table drops add column secondary_genre text
  check (secondary_genre in ('afrobeats', 'hip_hop', 'rnb', 'amapiano', 'pop', 'gospel', 'alte', 'other'));
