-- Synced lyrics (LRC format) for Spotify-style karaoke highlighting in the
-- player. Stored alongside -- never replacing -- the plain-text lyrics
-- column: lib/lrc.ts splits artist input into both, so existing consumers
-- of `lyrics` (drop page sheet, etc.) keep working unchanged.

alter table drop_tracks add column if not exists lyrics_lrc text;
