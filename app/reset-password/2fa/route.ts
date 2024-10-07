import { getPasswordReset2FARedirect } from "@/lib/server/2fa";
import { getCurrentPasswordResetSession } from "@/lib/server/password-reset";
import { globalGETRateLimit } from "@/lib/server/request";

export async function GET() {
	if (!globalGETRateLimit()) {
		return new Response("Too many requests", {
			status: 429
		});
	}
	const { session, user } = getCurrentPasswordResetSession();
	if (session === null) {
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/login"
			}
		});
	}
	if (!user.registered2FA || session.twoFactorVerified) {
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/reset-password"
			}
		});
	}
	return new Response(null, {
		status: 302,
		headers: {
			Location: getPasswordReset2FARedirect(user)
		}
	});
}
