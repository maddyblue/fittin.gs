import React, { useState, useEffect } from 'react';

function setTitle(name?: string) {
	if (name) {
		name += ' - ';
	} else {
		name = '';
	}
	document.title = name + 'fittin.gs';
}

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

interface ImgProps {
	id: number;
	alt: string;
	overrideSize?: number;
}

function Render(props: ImgProps & { size: number }) {
	return <Img type="render" {...props} />;
}

function Icon(props: ImgProps) {
	return <Img type="icon" size={32} overrideSize={24} {...props} />;
}

function Img(props: ImgProps & { type: string; size: number }) {
	return (
		<img
			className="v-mid mr2"
			src={
				'https://images.evetech.net/types/' +
				props.id +
				'/' +
				props.type +
				'?size=' +
				props.size
			}
			alt={props.alt}
			height={props.overrideSize || props.size}
			width={props.overrideSize || props.size}
		/>
	);
}

function ISK(props: { isk: number }) {
	const Misk = (props.isk / 1e6).toFixed(2);
	return <span>{Misk}M</span>;
}

function Ref(props: { ID: number }) {
	return <a href={'https://everef.net/type/' + props.ID}>everef</a>;
}

const flexChildrenClass = 'bg-dp01 pa1 ma1';

export interface ItemCharge {
	ID: number;
	Name: string;
	Charge?: {
		ID: number;
		Name: string;
	};
	Group?: number;
}

export const savedPrefix = 'saved-';

export {
	createCookie,
	Fetch,
	flexChildrenClass,
	Icon,
	ISK,
	readCookie,
	Ref,
	Render,
	setTitle,
	useKey,
};
