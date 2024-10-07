import { RegisterPasskeyForm } from "./components";

import { getCurrentSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { get2FARedirect } from "@/lib/server/2fa";
import { getUserPasskeyCredentials } from "@/lib/server/webauthn";
import { bigEndian } from "@oslojs/binary";
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
	if (user.registered2FA && !session.twoFactorVerified) {
		return redirect(get2FARedirect(user));
	}

	const credentials = getUserPasskeyCredentials(user.id);

	const credentialUserId = new Uint8Array(8);
	bigEndian.putUint64(credentialUserId, BigInt(user.id), 0);
	return (
		<>
			<h1>Register passkey</h1>
			<RegisterPasskeyForm
				encodedCredentialIds={credentials.map((credential) => encodeBase64(credential.id))}
				user={user}
				encodedCredentialUserId={encodeBase64(credentialUserId)}
			/>
		</>
	);
}
