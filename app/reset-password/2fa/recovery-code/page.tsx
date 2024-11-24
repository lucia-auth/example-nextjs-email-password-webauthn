import { PasswordResetRecoveryCodeForm } from "./components";

import { getCurrentPasswordResetSession } from "@/lib/server/password-reset";
import { redirect } from "next/navigation";
import { globalGETRateLimit } from "@/lib/server/request";

export default async function Page() {
	const canPerformRequest = await globalGETRateLimit();
	if (!canPerformRequest) {
		return "Too many requests";
	}

	const { session, user } = await getCurrentPasswordResetSession();

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
	return (
		<>
			<h1>Use your recovery code</h1>
			<PasswordResetRecoveryCodeForm />
		</>
	);
}
