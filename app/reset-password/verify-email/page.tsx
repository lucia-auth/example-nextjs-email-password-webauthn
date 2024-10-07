import { PasswordResetEmailVerificationForm } from "./components";

import { getCurrentPasswordResetSession } from "@/lib/server/password-reset";
import { redirect } from "next/navigation";
import { globalGETRateLimit } from "@/lib/server/request";

export default function Page() {
	if (!globalGETRateLimit()) {
		return "Too many requests";
	}

	const { session } = getCurrentPasswordResetSession();
	if (session === null) {
		return redirect("/forgot-password");
	}
	if (session.emailVerified) {
		if (!session.twoFactorVerified) {
			return redirect("/reset-password/2fa");
		}
		return redirect("/reset-password");
	}
	return (
		<>
			<h1>Verify your email address</h1>
			<p>We sent an 8-digit code to {session.email}.</p>
			<PasswordResetEmailVerificationForm />
		</>
	);
}
