import { useState, useEffect } from 'react';

function createCookie(name: string, value: string) {
	localStorage.setItem(name, value);
}

function readCookie(name: string) {
	return localStorage.getItem(name);
}

const baseURL =
	process.env.NODE_ENV === 'production'
		? 'https://fittings-5anqu7dwna-uc.a.run.app/api/'
		: '/api/';

async function Fetch<T>(
	path: string,
	success: (data: T) => void,
	onErr?: (error: any) => void
) {
	const url = baseURL + path;
	if (!onErr) {
		onErr = console.error;
	}
	try {
		const resp = await fetch(url);
		const data = await resp.json();
		success(data);
	} catch (error) {
		onErr(error);
	}
}

// https://dev.to/spaciecat/keyboard-input-with-react-hooks-3dkm
function useKey(key: string) {
	// Keep track of key state
	const [pressed, setPressed] = useState(false);

	// Bind and unbind events
	useEffect(() => {
		// Does an event match the key we're watching?
		const match = (event: KeyboardEvent) =>
			key.toLowerCase() === event.key.toLowerCase();

		// Event handlers
		const onDown = (event: KeyboardEvent) => {
			if (match(event)) setPressed(true);
		};

		const onUp = (event: KeyboardEvent) => {
			if (match(event)) setPressed(false);
		};
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		return () => {
			window.removeEventListener('keydown', onDown);
			window.removeEventListener('keyup', onUp);
		};
	}, [key]);

	return pressed;
}

export { createCookie, readCookie, Fetch, useKey };
