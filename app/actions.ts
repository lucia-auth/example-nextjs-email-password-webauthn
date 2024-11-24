"use server";

import { deleteSessionTokenCookie, getCurrentSession, invalidateSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { globalPOSTRateLimit } from "@/lib/server/request";

export async function logoutAction(): Promise<ActionResult> {
	const canPerformRequest = await globalPOSTRateLimit();
	if (!canPerformRequest) {
		return {
			message: "Too many requests"
		};
	}

	const { session } = await getCurrentSession();
	if (session === null) {
		return {
			message: "Not authenticated"
		};
	}
	invalidateSession(session.id);
	await deleteSessionTokenCookie();
	return redirect("/login");
}

interface ActionResult {
	message: string;
}
