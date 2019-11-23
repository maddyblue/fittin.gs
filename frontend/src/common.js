function createCookie(name: string, value: string) {
	localStorage.setItem(name, value);
}

function readCookie(name: string) {
	return localStorage.getItem(name);
}

const baseURL =
	process.env.NODE_ENV === 'production' ? 'https://TODO_PROD/' : '/api/';

async function Fetch(path: string, success: any => void, onErr?: any => void) {
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
