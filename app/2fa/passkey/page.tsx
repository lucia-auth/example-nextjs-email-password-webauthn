import Link from "next/link";
import { Verify2FAWithPasskeyButton } from "./components";

import { get2FARedirect } from "@/lib/server/2fa";
import { getCurrentSession } from "@/lib/server/session";
import { getUserPasskeyCredentials } from "@/lib/server/webauthn";
import { redirect } from "next/navigation";
import { encodeBase64 } from "@oslojs/encoding";
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
	if (!user.registered2FA) {
		return redirect("/");
	}
	if (session.twoFactorVerified) {
		return redirect("/");
	}
	if (!user.registeredPasskey) {
		return redirect(get2FARedirect(user));
	}
	const credentials = getUserPasskeyCredentials(user.id);
	return (
		<>
			<h1>Authenticate with passkeys</h1>
			<Verify2FAWithPasskeyButton encodedCredentialIds={credentials.map((credential) => encodeBase64(credential.id))} />
			<Link href="/2fa/reset">Use recovery code</Link>
			{user.registeredTOTP && <Link href="/2fa/totp">Use authenticator apps</Link>}
			{user.registeredSecurityKey && <Link href="/2fa/security-key">Use security keys</Link>}
		</>
	);
}
