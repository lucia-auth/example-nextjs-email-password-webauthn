"use client";

import { useActionState } from "react";
import { verifyPasswordReset2FAWithTOTPAction } from "./actions";

const initialPasswordResetTOTPState = {
	message: ""
};

export function PasswordResetTOTPForm() {
	const [state, action] = useActionState(verifyPasswordReset2FAWithTOTPAction, initialPasswordResetTOTPState);
	return (
		<form action={action}>
			<label htmlFor="form-totp.code">Code</label>
			<input id="form-totp.code" name="code" required />
			<br />
			<button>Verify</button>
			<p>{state.message}</p>
		</form>
	);
}
