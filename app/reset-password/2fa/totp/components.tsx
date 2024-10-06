"use client";

import { useFormState } from "react-dom";
import { verifyPasswordReset2FAWithTOTPAction } from "./actions";

const initialPasswordResetTOTPState = {
	message: ""
};

export function PasswordResetTOTPForm() {
	const [state, action] = useFormState(verifyPasswordReset2FAWithTOTPAction, initialPasswordResetTOTPState);
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
