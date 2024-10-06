"use client";

import { createChallenge } from "@/lib/client/webauthn";
import { decodeBase64, encodeBase64 } from "@oslojs/encoding";
import { verify2FAWithSecurityKeyAction } from "./actions";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Verify2FAWithSecurityKeyButton(props: { encodedCredentialIds: string[] }) {
	const router = useRouter();
	const [message, setMessage] = useState("");
	return (
		<div>
			<button
				onClick={async () => {
					const challenge = await createChallenge();

					const credential = await navigator.credentials.get({
						publicKey: {
							challenge,
							userVerification: "discouraged",
							allowCredentials: props.encodedCredentialIds.map((encoded) => {
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
					if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
						throw new Error("Unexpected error");
					}

					const result = await verify2FAWithSecurityKeyAction({
						credential_id: encodeBase64(new Uint8Array(credential.rawId)),
						signature: encodeBase64(new Uint8Array(credential.response.signature)),
						authenticator_data: encodeBase64(new Uint8Array(credential.response.authenticatorData)),
						client_data_json: encodeBase64(new Uint8Array(credential.response.clientDataJSON))
					});
					if (result.error !== null) {
						setMessage(result.error);
					} else {
						router.push("/reset-password");
					}
				}}
			>
				Authenticate
			</button>
			<p>{message}</p>
		</div>
	);
}
