import Link from "next/link";

import { getCurrentSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { globalGETRateLimit } from "@/lib/server/request";

export default function Page() {
	if (!globalGETRateLimit()) {
		return "Too many requests";
	}

	const { session, user } = getCurrentSession();
	if (session === null || user === null) {
		return redirect("/login");
	}
	if (!user.emailVerified) {
		return redirect("/verify-email");
	}
	if (user.registered2FA) {
		return redirect("/");
	}
	return (
		<>
			<h1>Set up two-factor authentication</h1>
			<ul>
				<li>
					<Link href="/2fa/totp/setup">Authenticator apps</Link>
				</li>
				<li>
					<Link href="/2fa/passkey/register">Passkeys</Link>
				</li>
				<li>
					<Link href="/2fa/security-key/register">Security keys</Link>
				</li>
			</ul>
		</>
	);
}
