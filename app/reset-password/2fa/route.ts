import { getPasswordReset2FARedirect } from "@/lib/server/2fa";
import { getCurrentPasswordResetSession } from "@/lib/server/password-reset";

export async function GET() {
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
