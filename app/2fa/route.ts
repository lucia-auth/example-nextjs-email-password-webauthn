import { get2FARedirect } from "@/lib/server/2fa";
import { globalGETRateLimit } from "@/lib/server/request";
import { getCurrentSession } from "@/lib/server/session";

export async function GET() {
	if (!globalGETRateLimit()) {
		return new Response("Too many requests", {
			status: 429
		});
	}
	const { session, user } = getCurrentSession();
	if (session === null || user === null) {
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/login"
			}
		});
	}
	if (session.twoFactorVerified) {
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/"
			}
		});
	}
	if (!user.registered2FA) {
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/2fa/setup"
			}
		});
	}
	return new Response(null, {
		status: 302,
		headers: {
			Location: get2FARedirect(user)
		}
	});
}
