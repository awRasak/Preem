// Distribution provider adapter interface (v1: Tunearo).
// Every provider speaks the same shape to the rest of Preem: create a
// release from a drop, upload assets, submit with a street date, report
// status. Swapping providers later touches only the adapter, never UI.

export type DistributionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "live";

export type ReleaseInput = {
  title: string;
  artistName: string;
  releaseType: "Single" | "EP" | "Album";
  genre: string;
  releaseDate: string; // YYYY-MM-DD, the DSP street date
  labelName: string;
  copyrightYear: number;
  tracks: {
    title: string;
    trackNumber: number;
    featuredNames?: string;
    lyrics?: string;
  }[];
};

export type ReleaseHandle = {
  externalId: string;
  status: DistributionStatus;
  rejectionReason?: string;
  upc?: string;
  // Present when the provider reports track-level identifiers in its status
  // payload (Tunearo assigns ISRCs at submission).
  tracks?: { id: string; isrc?: string }[];
};

export type AssetUpload = {
  uploadUrl: string;
};

// One release's earnings for one reporting month, normalised to the
// provider's minor unit (pence for GBP). The provider is the source of
// truth for its own cut; `grossMinor` is what it reports as payable.
export type RoyaltySnapshot = {
  period: string; // YYYY-MM
  currency: string; // ISO 4217, e.g. "GBP"
  grossMinor: number;
  transactionCount: number;
  bySource: { source: string; amountMinor: number }[];
};

export interface DistributionProvider {
  readonly name: string;
  createRelease(input: ReleaseInput): Promise<{ externalId: string }>;
  artworkUploadUrl(externalId: string): Promise<AssetUpload>;
  addTrack(
    externalId: string,
    track: ReleaseInput["tracks"][number],
  ): Promise<{ trackId: string; isrc?: string }>;
  audioUploadUrl(externalId: string, trackId: string): Promise<AssetUpload>;
  submit(externalId: string): Promise<void>;
  status(externalId: string): Promise<ReleaseHandle>;
  // Provider-reported earnings for one release in one month.
  royalties(externalId: string, period: string): Promise<RoyaltySnapshot>;
}
