import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { detectPlatform, fetchOEmbed } from "@/lib/oembed";

const schema = z.object({ url: z.string().trim().url() });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { url } = parsed.data;

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "Use a Spotify, Audiomack, or Boomplay link." },
      { status: 400 },
    );
  }

  const { title, thumbnailUrl, embedHtml } = await fetchOEmbed(url, platform);

  const { data, error } = await supabase
    .from("artist_links")
    .insert({
      artist_id: user.id,
      url,
      platform,
      title,
      thumbnail_url: thumbnailUrl,
      embed_html: embedHtml,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not save link." }, { status: 500 });
  }

  return NextResponse.json({ link: data });
}
