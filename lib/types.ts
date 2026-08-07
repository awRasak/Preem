export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PurchaseStatus = "pending" | "success" | "failed";

export type Artist = {
  id: string;
  stage_name: string;
  bio: string | null;
  profile_link: string | null;
  avatar_url: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
};

export type Drop = {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  lyrics: string | null;
  collaborators: string | null;
  price_kobo: number;
  audio_file_path: string;
  artwork_path: string | null;
  window_start: string;
  window_end: string | null;
  is_exclusive: boolean;
  created_at: string;
  artist?: Pick<Artist, "id" | "stage_name" | "avatar_url">;
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
