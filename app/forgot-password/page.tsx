import { ForgotPasswordForm } from "./components";
import Link from "next/link";

import { globalGETRateLimit } from "@/lib/server/request";

export default async function Page() {
	const canPerformRequest = await globalGETRateLimit();
	if (!canPerformRequest) {
		return "Too many requests";
	}

	return (
		<>
			<h1>Forgot your password?</h1>
			<ForgotPasswordForm />
			<Link href="/login">Sign in</Link>
		</>
	);
}
