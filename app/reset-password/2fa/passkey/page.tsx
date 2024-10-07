import Link from "next/link";
import { Verify2FAWithPasskeyButton } from "./components";

import { getUserPasskeyCredentials } from "@/lib/server/webauthn";
import { redirect } from "next/navigation";
import { getCurrentPasswordResetSession } from "@/lib/server/password-reset";
import { getPasswordReset2FARedirect } from "@/lib/server/2fa";
import { encodeBase64 } from "@oslojs/encoding";
import { globalGETRateLimit } from "@/lib/server/request";

export default function Page() {
	if (!globalGETRateLimit()) {
		return "Too many requests";
	}

	const { session, user } = getCurrentPasswordResetSession();

	if (session === null) {
		return redirect("/forgot-password");
	}
	if (!session.emailVerified) {
		return redirect("/reset-password/verify-email");
	}
	if (!user.registered2FA) {
		return redirect("/reset-password");
	}
	if (session.twoFactorVerified) {
		return redirect("/reset-password");
	}
	if (!user.registeredPasskey) {
		return redirect(getPasswordReset2FARedirect(user));
	}
	const credentials = getUserPasskeyCredentials(user.id);
	return (
		<>
			<h1>Authenticate with passkeys</h1>
			<Verify2FAWithPasskeyButton encodedCredentialIds={credentials.map((credential) => encodeBase64(credential.id))} />
			<Link href="/reset-password/2fa/recovery-code">Use recovery code</Link>
			{user.registeredTOTP && <Link href="/reset-password/2fa/totp">Use authenticator apps</Link>}
			{user.registeredSecurityKey && <Link href="/reset-password/2fa/security-key">Use security keys</Link>}
		</>
	);
}
