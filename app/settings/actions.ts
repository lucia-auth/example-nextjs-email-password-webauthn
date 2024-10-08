"use server";

import { verifyPasswordHash, verifyPasswordStrength } from "@/lib/server/password";
import { ExpiringTokenBucket } from "@/lib/server/rate-limit";
import {
	createSession,
	generateSessionToken,
	getCurrentSession,
	invalidateUserSessions,
	setSessionTokenCookie
} from "@/lib/server/session";
import { getUserPasswordHash, resetUserRecoveryCode, updateUserPassword } from "@/lib/server/user";
import {
	createEmailVerificationRequest,
	sendVerificationEmail,
	sendVerificationEmailBucket,
	setEmailVerificationRequestCookie
} from "@/lib/server/email-verification";
import { checkEmailAvailability, verifyEmailInput } from "@/lib/server/email";
import { redirect } from "next/navigation";
import { deleteUserTOTPKey, totpUpdateBucket } from "@/lib/server/totp";
import { decodeBase64 } from "@oslojs/encoding";
import { deleteUserPasskeyCredential, deleteUserSecurityKeyCredential } from "@/lib/server/webauthn";
import { globalPOSTRateLimit } from "@/lib/server/request";

import type { SessionFlags } from "@/lib/server/session";
import { revalidatePath } from "next/cache";

const passwordUpdateBucket = new ExpiringTokenBucket<string>(5, 60 * 30);

export async function updatePasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests"
		};
	}

	const { session, user } = getCurrentSession();
	if (session === null) {
		return {
			message: "Not authenticated"
		};
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden"
		};
	}
	if (!passwordUpdateBucket.check(session.id, 1)) {
		return {
			message: "Too many requests"
		};
	}

	const password = formData.get("password");
	const newPassword = formData.get("new_password");
	if (typeof password !== "string" || typeof newPassword !== "string") {
		return {
			message: "Invalid or missing fields"
		};
	}
	const strongPassword = await verifyPasswordStrength(newPassword);
	if (!strongPassword) {
		return {
			message: "Weak password"
		};
	}
	if (!passwordUpdateBucket.consume(session.id, 1)) {
		return {
			message: "Too many requests"
		};
	}
	const passwordHash = getUserPasswordHash(user.id);
	const validPassword = await verifyPasswordHash(passwordHash, password);
	if (!validPassword) {
		return {
			message: "Incorrect password"
		};
	}
	passwordUpdateBucket.reset(session.id);
	invalidateUserSessions(user.id);
	await updateUserPassword(user.id, newPassword);

	const sessionToken = generateSessionToken();
	const sessionFlags: SessionFlags = {
		twoFactorVerified: session.twoFactorVerified
	};
	const newSession = createSession(sessionToken, user.id, sessionFlags);
	setSessionTokenCookie(sessionToken, newSession.expiresAt);
	return {
		message: "Updated password"
	};
}

export async function updateEmailAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests"
		};
	}

	const { session, user } = getCurrentSession();
	if (session === null) {
		return {
			message: "Not authenticated"
		};
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden"
		};
	}
	if (!sendVerificationEmailBucket.check(user.id, 1)) {
		return {
			message: "Too many requests"
		};
	}

	const email = formData.get("email");
	if (typeof email !== "string") {
		return { message: "Invalid or missing fields" };
	}
	if (email === "") {
		return {
			message: "Please enter your email"
		};
	}
	if (!verifyEmailInput(email)) {
		return {
			message: "Please enter a valid email"
		};
	}
	const emailAvailable = checkEmailAvailability(email);
	if (!emailAvailable) {
		return {
			message: "This email is already used"
		};
	}
	if (!sendVerificationEmailBucket.consume(user.id, 1)) {
		return {
			message: "Too many requests"
		};
	}
	const verificationRequest = createEmailVerificationRequest(user.id, email);
	sendVerificationEmail(verificationRequest.email, verificationRequest.code);
	setEmailVerificationRequestCookie(verificationRequest);
	return redirect("/verify-email");
}

export async function disconnectTOTPAction(): Promise<ActionResult> {
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests"
		};
	}

	const { session, user } = getCurrentSession();
	if (session === null || user === null) {
		return {
			message: "Not authenticated"
		};
	}
	if (!user.emailVerified) {
		return {
			message: "Forbidden"
		};
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden"
		};
	}
	if (!totpUpdateBucket.consume(user.id, 1)) {
		return {
			message: ""
		};
	}
	deleteUserTOTPKey(user.id);

	revalidatePath("/settings");
	return {
		message: "Disconnected authenticator app"
	};
}

export async function deletePasskeyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests"
		};
	}

	const { session, user } = getCurrentSession();
	if (session === null || user === null) {
		return {
			message: "Not authenticated"
		};
	}
	if (!user.emailVerified) {
		return {
			message: "Forbidden"
		};
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden"
		};
	}
	const encodedCredentialId = formData.get("credential_id");
	if (typeof encodedCredentialId !== "string") {
		return {
			message: "Invalid or missing fields"
		};
	}
	let credentialId: Uint8Array;
	try {
		credentialId = decodeBase64(encodedCredentialId);
	} catch {
		return {
			message: "Invalid or missing fields"
		};
	}
	const deleted = deleteUserPasskeyCredential(user.id, credentialId);
	if (!deleted) {
		return {
			message: "Invalid credential ID"
		};
	}

	revalidatePath("/settings");
	return {
		message: "Removed credential"
	};
}

export async function deleteSecurityKeyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests"
		};
	}

	const { session, user } = getCurrentSession();
	if (session === null || user === null) {
		return {
			message: "Not authenticated"
		};
	}
	if (!user.emailVerified) {
		return {
			message: "Forbidden"
		};
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden"
		};
	}

	const encodedCredentialId = formData.get("credential_id");
	if (typeof encodedCredentialId !== "string") {
		return {
			message: "Invalid or missing fields"
		};
	}
	let credentialId: Uint8Array;
	try {
		credentialId = decodeBase64(encodedCredentialId);
	} catch {
		return {
			message: "Invalid or missing fields"
		};
	}
	const deleted = deleteUserSecurityKeyCredential(user.id, credentialId);
	if (!deleted) {
		return {
			message: "Invalid credential ID"
		};
	}

	revalidatePath("/settings");
	return {
		message: "Removed credential"
	};
}

export async function regenerateRecoveryCodeAction(): Promise<RegenerateRecoveryCodeActionResult> {
	if (!globalPOSTRateLimit()) {
		return {
			error: "Too many requests",
			recoveryCode: null
		};
	}

	const { session, user } = getCurrentSession();
	if (session === null || user === null) {
		return {
			error: "Not authenticated",
			recoveryCode: null
		};
	}
	if (!user.emailVerified) {
		return {
			error: "Forbidden",
			recoveryCode: null
		};
	}
	if (!session.twoFactorVerified) {
		return {
			error: "Forbidden",
			recoveryCode: null
		};
	}
	const recoveryCode = resetUserRecoveryCode(session.userId);
	return {
		error: null,
		recoveryCode
	};
}

interface ActionResult {
	message: string;
}

type RegenerateRecoveryCodeActionResult =
	| {
			error: string;
			recoveryCode: null;
	  }
	| {
			error: null;
			recoveryCode: string;
	  };
