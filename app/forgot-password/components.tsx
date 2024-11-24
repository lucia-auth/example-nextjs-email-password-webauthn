"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "./actions";

const initialForgotPasswordState = {
	message: ""
};

export function ForgotPasswordForm() {
	const [state, action] = useActionState(forgotPasswordAction, initialForgotPasswordState);
	return (
		<form action={action}>
			<label htmlFor="form-forgot.email">Email</label>
			<input type="email" id="form-forgot.email" name="email" required />
			<br />
			<button>Send</button>
			<p>{state.message}</p>
		</form>
	);
}
