"use client";

import { createChallenge } from "@/lib/client/webauthn";
import { decodeBase64, encodeBase64 } from "@oslojs/encoding";
import { useState } from "react";
import { useFormState } from "react-dom";
import { registerSecurityKeyAction } from "./actions";

import type { User } from "@/lib/server/user";

const initialRegisterSecurityKeyState = {
	message: ""
};

export function RegisterSecurityKey(props: {
	encodedCredentialUserId: string;
	user: User;
	encodedCredentialIds: string[];
}) {
	const [encodedAttestationObject, setEncodedAttestationObject] = useState<string | null>(null);
	const [encodedClientDataJSON, setEncodedClientDataJSON] = useState<string | null>(null);
	const [formState, action] = useFormState(registerSecurityKeyAction, initialRegisterSecurityKeyState);
	return (
		<>
			<button
				disabled={encodedAttestationObject !== null && encodedClientDataJSON !== null}
				onClick={async () => {
					const challenge = await createChallenge();

					const credential = await navigator.credentials.create({
						publicKey: {
							challenge,
							user: {
								displayName: props.user.username,
								id: decodeBase64(props.encodedCredentialUserId),
								name: props.user.email
							},
							rp: {
								name: "Next.js WebAuthn example"
							},
							pubKeyCredParams: [
								{
									alg: -7,
									type: "public-key"
								},
								{
									alg: -257,
									type: "public-key"
								}
							],
							attestation: "none",
							authenticatorSelection: {
								userVerification: "discouraged",
								residentKey: "discouraged",
								requireResidentKey: false,
								authenticatorAttachment: "cross-platform"
							},
							excludeCredentials: props.encodedCredentialIds.map((encoded) => {
								return {
									id: decodeBase64(encoded),
									type: "public-key"
								};
							})
						}
					});

					if (!(credential instanceof PublicKeyCredential)) {
						throw new Error("Failed to create public key");
					}
					if (!(credential.response instanceof AuthenticatorAttestationResponse)) {
						throw new Error("Unexpected error");
					}

					setEncodedAttestationObject(encodeBase64(new Uint8Array(credential.response.attestationObject)));
					setEncodedClientDataJSON(encodeBase64(new Uint8Array(credential.response.clientDataJSON)));
				}}
			>
				Create credential
			</button>
			<form action={action}>
				<label htmlFor="form-register-credential.name">Credential name</label>
				<input id="form-register-credential.name" name="name" />
				<input type="hidden" name="attestation_object" value={encodedAttestationObject ?? ""} readOnly />
				<input type="hidden" name="client_data_json" value={encodedClientDataJSON ?? ""} readOnly />
				<button disabled={encodedAttestationObject === null && encodedClientDataJSON === null}>Continue</button>
				<p>{formState.message}</p>
			</form>
		</>
	);
}
