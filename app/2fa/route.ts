import { get2FARedirect } from "@/lib/server/2fa";
import { getCurrentSession } from "@/lib/server/session";

export async function GET() {
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
