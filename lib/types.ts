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
  slug: string | null;
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
  approval_seen: boolean;
  // Pinned "current single" for the Promote hub + public page hero.
  // Null = newest-first ordering. (0031_featured_drop)
  featured_drop_id: string | null;
  thank_you_text: string | null;
  thank_you_media_url: string | null;
  thank_you_media_type: "image" | "video" | null;
  created_at: string;
};

export type Drop = {
  id: string;
  artist_id: string;
  slug: string | null;
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
  presave_enabled: boolean;
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
  lyrics_lrc: string | null;
  slug: string | null;
  created_at: string;
};

export type BioLink = {
  id: string;
  artist_id: string;
  label: string;
  url: string;
  sort_order: number;
  created_at: string;
};

export type TrackSplit = {
  id: string;
  track_id: string;
  artist_id: string;
  share_bps: number;
  created_at: string;
  artist?: { id: string; stage_name: string; avatar_url: string | null } | null;
};

export type TrackSplitInvite = {
  id: string;
  track_id: string;
  name: string;
  email: string;
  share_bps: number;
  status: "pending" | "claimed" | "revoked";
  claimed_by_artist_id: string | null;
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

export type ShowStatus = "published" | "cancelled";

export type Show = {
  id: string;
  artist_id: string;
  slug: string | null;
  title: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  start_at: string;
  end_at: string | null;
  ticket_price_kobo: number;
  total_tickets: number;
  cover_art_path: string | null;
  status: ShowStatus;
  created_at: string;
  artist?: Pick<Artist, "id" | "stage_name" | "avatar_url">;
};

export type TrackChangeStatus = "pending" | "approved" | "rejected" | "cancelled";

export type TrackChangeRequest = {
  id: string;
  track_id: string;
  drop_id: string;
  artist_id: string;
  new_audio_path: string;
  reason: string;
  status: TrackChangeStatus;
  created_at: string;
  reviewed_at: string | null;
};

export type ShowTicket = {
  id: string;
  show_id: string;
  fan_name: string;
  fan_phone: string;
  fan_email: string;
  amount_kobo: number;
  paystack_ref: string;
  gateway: "paystack" | "monipay" | "squad";
  status: PurchaseStatus;
  purchased_at: string | null;
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
  created_at: string;
};

export type MerchItemStatus = "draft" | "published";

export type MerchItem = {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  price_kobo: number;
  stock: number;
  photo_path: string | null;
  status: MerchItemStatus;
  created_at: string;
};

export type DeliveryZone = {
  id: string;
  label: string;
  fee_kobo: number;
  sort_order: number;
};

export type MerchFulfillment = "pending" | "preparing" | "shipped" | "delivered";

export type MerchOrder = {
  id: string;
  item_id: string;
  fan_name: string;
  fan_phone: string;
  fan_email: string;
  address: string;
  zone_id: string | null;
  zone_label: string;
  quantity: number;
  item_price_kobo: number;
  delivery_fee_kobo: number;
  amount_kobo: number;
  paystack_ref: string;
  gateway: "paystack" | "monipay" | "squad";
  status: PurchaseStatus;
  paid_out: boolean;
  fulfillment: MerchFulfillment;
  purchased_at: string | null;
  created_at: string;
};
