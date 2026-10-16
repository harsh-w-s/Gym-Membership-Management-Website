import { NextResponse, type NextRequest } from "next/server";

/**
 * Minimal owner-only protection via HTTP Basic Auth (zero cost, no auth provider).
 * Always deploy behind HTTPS (Vercel/Netlify do this by default).
 */
export function proxy(req: NextRequest) {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return new NextResponse("Server misconfigured: set ADMIN_USERNAME and ADMIN_PASSWORD.", { status: 500 });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    if (sep !== -1 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Gym Dashboard", charset="UTF-8"' },
  });
}

export const config = {
  // Protect everything except Next.js static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
