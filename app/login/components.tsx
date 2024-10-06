"use client";

import { useState } from "react";
import { loginAction, loginWithPasskeyAction } from "./actions";
import { useFormState } from "react-dom";
import { encodeBase64 } from "@oslojs/encoding";
import { createChallenge } from "@/lib/client/webauthn";

const initialState = {
	message: ""
};

export function LoginForm() {
	const [state, action] = useFormState(loginAction, initialState);

	return (
		<form action={action}>
			<label htmlFor="form-login.email">Email</label>
			<input type="email" id="form-login.email" name="email" autoComplete="username" required />
			<br />
			<label htmlFor="form-login.password">Password</label>
			<input type="password" id="form-login.password" name="password" autoComplete="current-password" required />
			<br />
			<button>Continue</button>
			<p>{state.message}</p>
		</form>
	);
}

export function PasskeyLoginButton() {
	const [message, setMessage] = useState("");
	return (
		<>
			<button
				onClick={async () => {
					const challenge = await createChallenge();

					const credential = await navigator.credentials.get({
						publicKey: {
							challenge,
							userVerification: "required"
						}
					});

					if (!(credential instanceof PublicKeyCredential)) {
						throw new Error("Failed to create public key");
					}
					if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
						throw new Error("Unexpected error");
					}

					const result = await loginWithPasskeyAction({
						credential_id: encodeBase64(new Uint8Array(credential.rawId)),
						signature: encodeBase64(new Uint8Array(credential.response.signature)),
						authenticator_data: encodeBase64(new Uint8Array(credential.response.authenticatorData)),
						client_data_json: encodeBase64(new Uint8Array(credential.response.clientDataJSON))
					});
					setMessage(result.message);
				}}
			>
				Sign in with passkey
			</button>
			<p>{message}</p>
		</>
	);
}
