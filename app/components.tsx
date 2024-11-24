"use client";

import { logoutAction } from "./actions";
import { useActionState } from "react";

const initialState = {
	message: ""
};

export function LogoutButton() {
	const [, action] = useActionState(logoutAction, initialState);
	return (
		<form action={action}>
			<button>Sign out</button>
		</form>
	);
}
