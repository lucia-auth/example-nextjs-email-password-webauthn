import { Verify2FAWithSecurityKeyButton } from "./components";
import Link from "next/link";

import { get2FARedirect } from "@/lib/server/2fa";
import { getCurrentSession } from "@/lib/server/session";
import { getUserSecurityKeyCredentials } from "@/lib/server/webauthn";
import { redirect } from "next/navigation";
import { encodeBase64 } from "@oslojs/encoding";

export default function Page() {
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
	if (!user.registeredSecurityKey) {
		return redirect(get2FARedirect(user));
	}
	const credentials = getUserSecurityKeyCredentials(user.id);
	return (
		<>
			<h1>Authenticate with security keys</h1>
			<Verify2FAWithSecurityKeyButton
				encodedCredentialIds={credentials.map((credential) => encodeBase64(credential.id))}
			/>
			<Link href="/2fa/reset">Use recovery code</Link>
			{user.registeredTOTP && <Link href="/2fa/totp">Use authenticator apps</Link>}
			{user.registeredPasskey && <Link href="/2fa/passkey">Use passkeys</Link>}
		</>
	);
}
