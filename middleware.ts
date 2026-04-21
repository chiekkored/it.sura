import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not add logic between this and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  
  // Helper to create a redirect response with refreshed cookies
  const createRedirectResponse = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const response = NextResponse.redirect(url);
    
    // First, copy all cookies from the original request to ensure persistence
    request.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value);
    });
    
    // Then, overwrite with refreshed cookies from the supabaseResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      const { name, value, ...options } = cookie;
      response.cookies.set(name, value, options);
    });
    
    return response;
  };

  const isLoginPage = pathname === "/admin/login";

  // Protect admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && !isLoginPage) {
    if (!user) {
      return createRedirectResponse("/admin/login");
    }

    // Role check to prevent loops
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["superadmin", "admin", "staff"].includes(profile.role)) {
      await supabase.auth.signOut();
      return createRedirectResponse("/admin/login?error=Unauthorized");
    }

    if (profile.role === "staff" && (pathname.startsWith("/admin/users") || pathname.startsWith("/admin/logs"))) {
      return createRedirectResponse("/admin");
    }
  }

  // Redirect authenticated users away from login page
  if (isLoginPage && user) {
    // Check if they have the role before redirecting to /admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile && ["superadmin", "admin", "staff"].includes(profile.role)) {
      return createRedirectResponse("/admin");
    }
    // If authenticated but no role, we let it fall through so the layout can handle the signout/redirect
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
