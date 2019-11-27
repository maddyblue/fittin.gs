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

async function Fetch<T>(path: string, success: (data: T) => void, onErr?: (error: any) => void) {
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

export { createCookie, readCookie, Fetch };
