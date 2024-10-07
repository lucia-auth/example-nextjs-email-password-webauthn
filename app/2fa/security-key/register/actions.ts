"use server";

import { getCurrentSession, setSessionAs2FAVerified } from "@/lib/server/session";
import { decodeBase64 } from "@oslojs/encoding";
import { redirect } from "next/navigation";
import {
	AttestationStatementFormat,
	ClientDataType,
	coseAlgorithmES256,
	coseAlgorithmRS256,
	coseEllipticCurveP256,
	parseAttestationObject,
	parseClientDataJSON
} from "@oslojs/webauthn";
import {
	createSecurityKeyCredential,
	getUserSecurityKeyCredentials,
	verifyWebAuthnChallenge
} from "@/lib/server/webauthn";
import { ECDSAPublicKey, p256 } from "@oslojs/crypto/ecdsa";
import { RSAPublicKey } from "@oslojs/crypto/rsa";
import { SqliteError } from "better-sqlite3";
import { globalPOSTRateLimit } from "@/lib/server/request";

import type {
	AttestationStatement,
	AuthenticatorData,
	ClientData,
	COSEEC2PublicKey,
	COSERSAPublicKey
} from "@oslojs/webauthn";
import type { WebAuthnUserCredential } from "@/lib/server/webauthn";

export async function registerSecurityKeyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
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

	const name = formData.get("name");
	const encodedAttestationObject = formData.get("attestation_object");
	const encodedClientDataJSON = formData.get("client_data_json");
	if (
		typeof name !== "string" ||
		typeof encodedAttestationObject !== "string" ||
		typeof encodedClientDataJSON !== "string"
	) {
		return {
			message: "Invalid or missing fields"
		};
	}

	let attestationObjectBytes: Uint8Array, clientDataJSON: Uint8Array;
	try {
		attestationObjectBytes = decodeBase64(encodedAttestationObject);
		clientDataJSON = decodeBase64(encodedClientDataJSON);
	} catch {
		return {
			message: "Invalid or missing fields"
		};
	}

	let attestationStatement: AttestationStatement;
	let authenticatorData: AuthenticatorData;
	try {
		const attestationObject = parseAttestationObject(attestationObjectBytes);
		attestationStatement = attestationObject.attestationStatement;
		authenticatorData = attestationObject.authenticatorData;
	} catch {
		return {
			message: "Invalid data"
		};
	}
	if (attestationStatement.format !== AttestationStatementFormat.None) {
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
	if (!authenticatorData.userPresent) {
		return {
			message: "Invalid data"
		};
	}
	if (authenticatorData.credential === null) {
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
	if (clientData.type !== ClientDataType.Create) {
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

	let credential: WebAuthnUserCredential;
	if (authenticatorData.credential.publicKey.algorithm() === coseAlgorithmES256) {
		let cosePublicKey: COSEEC2PublicKey;
		try {
			cosePublicKey = authenticatorData.credential.publicKey.ec2();
		} catch {
			return {
				message: "Invalid data"
			};
		}
		if (cosePublicKey.curve !== coseEllipticCurveP256) {
			return {
				message: "Unsupported algorithm"
			};
		}
		const encodedPublicKey = new ECDSAPublicKey(p256, cosePublicKey.x, cosePublicKey.y).encodeSEC1Uncompressed();
		credential = {
			id: authenticatorData.credential.id,
			userId: user.id,
			algorithmId: coseAlgorithmES256,
			name,
			publicKey: encodedPublicKey
		};
	} else if (authenticatorData.credential.publicKey.algorithm() === coseAlgorithmRS256) {
		let cosePublicKey: COSERSAPublicKey;
		try {
			cosePublicKey = authenticatorData.credential.publicKey.rsa();
		} catch {
			return {
				message: "Invalid data"
			};
		}
		const encodedPublicKey = new RSAPublicKey(cosePublicKey.n, cosePublicKey.e).encodePKCS1();
		credential = {
			id: authenticatorData.credential.id,
			userId: user.id,
			algorithmId: coseAlgorithmRS256,
			name,
			publicKey: encodedPublicKey
		};
	} else {
		return {
			message: "Unsupported algorithm"
		};
	}

	// We don't have to worry about race conditions since queries are synchronous
	const credentials = getUserSecurityKeyCredentials(user.id);
	if (credentials.length >= 5) {
		return {
			message: "Too many credentials"
		};
	}

	try {
		createSecurityKeyCredential(credential);
	} catch (e) {
		if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
			return {
				message: "Invalid data"
			};
		}
		return {
			message: "Internal error"
		};
	}

	if (!session.twoFactorVerified) {
		setSessionAs2FAVerified(session.id);
	}

	if (!user.registered2FA) {
		return redirect("/recovery-code");
	}
	return redirect("/");
}

interface ActionResult {
	message: string;
}
