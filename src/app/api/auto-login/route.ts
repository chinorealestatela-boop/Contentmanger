import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth";

// Solo-use convenience: skip the login screen entirely and sign straight in
// as the seeded admin account. The /login and /register pages still exist
// and work normally — this route is just the default landing path while
// only one person is using the app. To bring the login screen back for
// multiple users later, point src/app/page.tsx and
// src/lib/queries/scope.ts back at "/login" instead of "/api/auto-login".
const AUTO_LOGIN_EMAIL = "alex.rivera@driveline-motors.com";
const AUTO_LOGIN_PASSWORD = "Password123!";

export async function GET() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  try {
    await signIn("credentials", {
      email: AUTO_LOGIN_EMAIL,
      password: AUTO_LOGIN_PASSWORD,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Seeded account missing/changed — fall back to the real login form
      // instead of an infinite redirect loop.
      redirect("/login");
    }
    // NEXT_REDIRECT is thrown by next-auth on success; rethrow so Next.js handles it.
    throw err;
  }
}
