"use server";

import { verifyEmailInput } from "@/lib/server/email";
import { verifyPasswordHash } from "@/lib/server/password";
import { RefillingTokenBucket, Throttler } from "@/lib/server/rate-limit";
import { createSession, generateSessionToken, setSessionTokenCookie } from "@/lib/server/session";
import { getUserFromEmail, getUserPasswordHash } from "@/lib/server/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
	ClientDataType,
	coseAlgorithmES256,
	coseAlgorithmRS256,
	createAssertionSignatureMessage,
	parseAuthenticatorData,
	parseClientDataJSON
} from "@oslojs/webauthn";
import { ObjectParser } from "@pilcrowjs/object-parser";
import { decodeBase64 } from "@oslojs/encoding";
import { getPasskeyCredential, verifyWebAuthnChallenge } from "@/lib/server/webauthn";
import { decodePKIXECDSASignature, decodeSEC1PublicKey, p256, verifyECDSASignature } from "@oslojs/crypto/ecdsa";
import { sha256 } from "@oslojs/crypto/sha2";
import { decodePKCS1RSAPublicKey, sha256ObjectIdentifier, verifyRSASSAPKCS1v15Signature } from "@oslojs/crypto/rsa";
import { get2FARedirect } from "@/lib/server/2fa";

import type { SessionFlags } from "@/lib/server/session";
import type { AuthenticatorData, ClientData } from "@oslojs/webauthn";

const throttler = new Throttler<number>([1, 2, 4, 8, 16, 30, 60, 180, 300]);
const ipBucket = new RefillingTokenBucket<string>(20, 1);

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// TODO: Assumes X-Forwarded-For is always included.
	const clientIP = headers().get("X-Forwarded-For");
	if (clientIP !== null && !ipBucket.check(clientIP, 1)) {
		return {
			message: "Too many requests"
		};
	}

	const email = formData.get("email");
	const password = formData.get("password");
	if (typeof email !== "string" || typeof password !== "string") {
		return {
			message: "Invalid or missing fields"
		};
	}
	if (email === "" || password === "") {
		return {
			message: "Please enter your email and password."
		};
	}
	if (!verifyEmailInput(email)) {
		return {
			message: "Invalid email"
		};
	}
	const user = getUserFromEmail(email);
	if (user === null) {
		return {
			message: "Account does not exist"
		};
	}
	if (clientIP !== null && !ipBucket.consume(clientIP, 1)) {
		return {
			message: "Too many requests"
		};
	}
	if (!throttler.consume(user.id)) {
		return {
			message: "Too many requests"
		};
	}
	const passwordHash = getUserPasswordHash(user.id);
	const validPassword = await verifyPasswordHash(passwordHash, password);
	if (!validPassword) {
		return {
			message: "Invalid password"
		};
	}
	throttler.reset(user.id);
	const sessionFlags: SessionFlags = {
		twoFactorVerified: false
	};
	const sessionToken = generateSessionToken();
	const session = createSession(sessionToken, user.id, sessionFlags);
	setSessionTokenCookie(sessionToken, session.expiresAt);

	if (!user.emailVerified) {
		return redirect("/verify-email");
	}
	if (!user.registered2FA) {
		return redirect("/2fa/setup");
	}
	return redirect(get2FARedirect(user));
}

export async function loginWithPasskeyAction(data: unknown): Promise<ActionResult> {
	const parser = new ObjectParser(data);
	let encodedAuthenticatorData: string;
	let encodedClientDataJSON: string;
	let encodedCredentialId: string;
	let encodedSignature: string;
	try {
		encodedAuthenticatorData = parser.getString("authenticator_data");
		encodedClientDataJSON = parser.getString("client_data_json");
		encodedCredentialId = parser.getString("credential_id");
		encodedSignature = parser.getString("signature");
	} catch {
		return {
			message: "Invalid or missing fields"
		};
	}
	let authenticatorDataBytes: Uint8Array;
	let clientDataJSON: Uint8Array;
	let credentialId: Uint8Array;
	let signatureBytes: Uint8Array;
	try {
		authenticatorDataBytes = decodeBase64(encodedAuthenticatorData);
		clientDataJSON = decodeBase64(encodedClientDataJSON);
		credentialId = decodeBase64(encodedCredentialId);
		signatureBytes = decodeBase64(encodedSignature);
	} catch {
		return {
			message: "Invalid or missing fields"
		};
	}

	let authenticatorData: AuthenticatorData;
	try {
		authenticatorData = parseAuthenticatorData(authenticatorDataBytes);
	} catch {
		return {
			message: "Invalid data"
		};
	}
	// TODO: Update host
	if (!authenticatorData.verifyRelyingPartyIdHash("localhost")) {
		return {
			message: "Invalid data"
		};
	}
	if (!authenticatorData.userPresent || !authenticatorData.userVerified) {
		return {
			message: "Invalid data"
		};
	}

	let clientData: ClientData;
	try {
		clientData = parseClientDataJSON(clientDataJSON);
	} catch {
		return {
			message: "Invalid data"
		};
	}
	if (clientData.type !== ClientDataType.Get) {
		return {
			message: "Invalid data"
		};
	}

	if (!verifyWebAuthnChallenge(clientData.challenge)) {
		return {
			message: "Invalid data"
		};
	}
	// TODO: Update origin
	if (clientData.origin !== "http://localhost:3000") {
		return {
			message: "Invalid data"
		};
	}
	if (clientData.crossOrigin !== null && clientData.crossOrigin) {
		return {
			message: "Invalid data"
		};
	}

	const credential = getPasskeyCredential(credentialId);
	if (credential === null) {
		return {
			message: "Invalid credential"
		};
	}

	let validSignature: boolean;
	if (credential.algorithmId === coseAlgorithmES256) {
		const ecdsaSignature = decodePKIXECDSASignature(signatureBytes);
		const ecdsaPublicKey = decodeSEC1PublicKey(p256, credential.publicKey);
		const hash = sha256(createAssertionSignatureMessage(authenticatorDataBytes, clientDataJSON));
		validSignature = verifyECDSASignature(ecdsaPublicKey, hash, ecdsaSignature);
	} else if (credential.algorithmId === coseAlgorithmRS256) {
		const rsaPublicKey = decodePKCS1RSAPublicKey(credential.publicKey);
		const hash = sha256(createAssertionSignatureMessage(authenticatorDataBytes, clientDataJSON));
		validSignature = verifyRSASSAPKCS1v15Signature(rsaPublicKey, sha256ObjectIdentifier, hash, signatureBytes);
	} else {
		return {
			message: "Internal error"
		};
	}

	if (!validSignature) {
		return {
			message: "Invalid signature"
		};
	}
	const sessionFlags: SessionFlags = {
		twoFactorVerified: true
	};
	const sessionToken = generateSessionToken();
	const session = createSession(sessionToken, credential.userId, sessionFlags);
	setSessionTokenCookie(sessionToken, session.expiresAt);
	return redirect("/");
}

interface ActionResult {
	message: string;
}
