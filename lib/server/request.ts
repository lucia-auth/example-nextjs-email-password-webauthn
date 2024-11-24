import { headers } from "next/headers";
import { RefillingTokenBucket } from "./rate-limit";

export const globalBucket = new RefillingTokenBucket<string>(100, 1);

export async function globalGETRateLimit(): Promise<boolean> {
	// Note: Assumes X-Forwarded-For will always be defined.
	const headersList = await headers();
	const clientIP = headersList.get("X-Forwarded-For");
	if (clientIP === null) {
		return true;
	}
	return globalBucket.consume(clientIP, 1);
}

export async function globalPOSTRateLimit(): Promise<boolean> {
	// Note: Assumes X-Forwarded-For will always be defined.
	const headersList = await headers();
	const clientIP = headersList.get("X-Forwarded-For");
	if (clientIP === null) {
		return true;
	}
	return globalBucket.consume(clientIP, 3);
}
