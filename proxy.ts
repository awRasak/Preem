import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isArtistRoute =
    path.startsWith("/artist/dashboard") ||
    path.startsWith("/artist/drops") ||
    path.startsWith("/artist/listeners") ||
    path.startsWith("/artist/profile");
  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/setup";

  if ((isArtistRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/artist/login";
    return NextResponse.redirect(url);
  }

  if (user && (isArtistRoute || isAdminRoute)) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role;

    if (isAdminRoute && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (isArtistRoute && role !== "artist") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/artist/dashboard/:path*",
    "/artist/drops/:path*",
    "/artist/listeners/:path*",
    "/artist/profile/:path*",
    "/admin/:path*",
    // Fans now get real Supabase Auth sessions too (post-purchase email
    // OTP) -- these routes don't gate on role, but still need to run
    // through here so an expiring access token gets refreshed and the new
    // cookie written back, same as the artist/admin routes above.
    "/drop/:path*",
    "/fans",
  ],
};
