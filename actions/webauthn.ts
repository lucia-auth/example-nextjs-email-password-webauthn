"use server";

import { RefillingTokenBucket } from "@/lib/server/rate-limit";
import { createWebAuthnChallenge } from "@/lib/server/webauthn";
import { encodeBase64 } from "@oslojs/encoding";
import { headers } from "next/headers";

const webauthnChallengeRateLimitBucket = new RefillingTokenBucket<string>(30, 10);

export async function createWebAuthnChallengeAction(): Promise<string> {
	console.log("create");
	const clientIP = headers().get("X-Forwarded-For");
	if (clientIP !== null && !webauthnChallengeRateLimitBucket.consume(clientIP, 1)) {
		throw new Error("Too many requests");
	}
	const challenge = createWebAuthnChallenge();
	return encodeBase64(challenge);
}
