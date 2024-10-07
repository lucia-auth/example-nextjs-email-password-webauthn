import Link from "next/link";
import {
	DisconnectTOTPButton,
	PasskeyCredentialListItem,
	RecoveryCodeSection,
	SecurityKeyCredentialListItem,
	UpdateEmailForm,
	UpdatePasswordForm
} from "./components";

import { getCurrentSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { getUserRecoverCode } from "@/lib/server/user";
import { get2FARedirect } from "@/lib/server/2fa";
import { getUserPasskeyCredentials, getUserSecurityKeyCredentials } from "@/lib/server/webauthn";
import { encodeBase64 } from "@oslojs/encoding";
import { globalGETRateLimit } from "@/lib/server/request";

export default function Page() {
	if (!globalGETRateLimit()) {
		return "Too many requests";
	}

	const { session, user } = getCurrentSession();
	if (session === null) {
		return redirect("/login");
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return redirect(get2FARedirect(user));
	}
	let recoveryCode: string | null = null;
	if (user.registered2FA) {
		recoveryCode = getUserRecoverCode(user.id);
	}
	const passkeyCredentials = getUserPasskeyCredentials(user.id);
	const securityKeyCredentials = getUserSecurityKeyCredentials(user.id);
	return (
		<>
			<header>
				<Link href="/">Home</Link>
				<Link href="/settings">Settings</Link>
			</header>
			<main>
				<h1>Settings</h1>
				<section>
					<h2>Update email</h2>
					<p>Your email: {user.email}</p>
					<UpdateEmailForm />
				</section>
				<section>
					<h2>Update password</h2>
					<UpdatePasswordForm />
				</section>
				<section>
					<h2>Authenticator app</h2>
					{user.registeredTOTP ? (
						<>
							<Link href="/2fa/totp/setup">Update TOTP</Link>
							<DisconnectTOTPButton />
						</>
					) : (
						<Link href="/2fa/totp/setup">Set up TOTP</Link>
					)}
				</section>
				<section>
					<h2>Passkeys</h2>
					<p>Passkeys are WebAuthn credentials that validate your identity using your device.</p>
					<ul>
						{passkeyCredentials.map((credential) => {
							return (
								<PasskeyCredentialListItem
									encodedId={encodeBase64(credential.id)}
									name={credential.name}
									key={encodeBase64(credential.id)}
								/>
							);
						})}
					</ul>
					<Link href="/2fa/passkey/register">Add</Link>
				</section>
				<section>
					<h2>Security keys</h2>
					<p>Security keys are WebAuthn credentials that can only be used for two-factor authentication.</p>
					<ul>
						{securityKeyCredentials.map((credential) => {
							return (
								<SecurityKeyCredentialListItem
									encodedId={encodeBase64(credential.id)}
									name={credential.name}
									key={encodeBase64(credential.id)}
								/>
							);
						})}
					</ul>
					<Link href="/2fa/security-key/register">Add</Link>
				</section>
				{recoveryCode !== null && <RecoveryCodeSection recoveryCode={recoveryCode} />}
			</main>
		</>
	);
}
