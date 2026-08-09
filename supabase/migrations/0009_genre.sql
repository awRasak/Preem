-- Per-drop genre tagging for the Explore page's filter chips.
alter table drops add column genre text not null default 'other'
  check (genre in ('afrobeats', 'hip_hop', 'rnb', 'amapiano', 'pop', 'gospel', 'alte', 'other'));

create index drops_genre_idx on drops (genre);
