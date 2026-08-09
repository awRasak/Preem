export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PurchaseStatus = "pending" | "success" | "failed";
export type ReleaseType = "single" | "ep" | "album";
export type DropStatus = "draft" | "published";
export type Genre =
  | "afrobeats"
  | "hip_hop"
  | "rnb"
  | "amapiano"
  | "pop"
  | "gospel"
  | "alte"
  | "other";

export type Artist = {
  id: string;
  stage_name: string;
  bio: string | null;
  profile_link: string | null;
  avatar_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  snapchat_url: string | null;
  approval_status: ApprovalStatus;
  thank_you_text: string | null;
  thank_you_media_url: string | null;
  thank_you_media_type: "image" | "video" | null;
  created_at: string;
};

export type Drop = {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  release_type: ReleaseType;
  status: DropStatus;
  genre: Genre;
  secondary_genre: Genre | null;
  min_price_kobo: number;
  artwork_path: string | null;
  window_start: string;
  window_end: string | null;
  is_exclusive: boolean;
  created_at: string;
  artist?: Pick<Artist, "id" | "stage_name" | "avatar_url">;
  tracks?: DropTrack[];
};

export type DropTrack = {
  id: string;
  drop_id: string;
  track_number: number;
  title: string;
  audio_file_path: string;
  min_price_kobo: number;
  collaborators: string | null;
  lyrics: string | null;
  created_at: string;
};

export type ArtistLink = {
  id: string;
  artist_id: string;
  url: string;
  platform: "audiomack" | "boomplay" | "spotify";
  title: string | null;
  thumbnail_url: string | null;
  embed_html: string | null;
  created_at: string;
};

export type Purchase = {
  id: string;
  drop_id: string;
  track_id: string | null;
  fan_name: string;
  fan_phone: string;
  fan_email: string;
  amount_kobo: number;
  paystack_ref: string;
  status: PurchaseStatus;
  purchased_at: string | null;
  access_granted_at: string | null;
  paid_out: boolean;
};
