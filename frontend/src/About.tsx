import React from 'react';
import { setTitle, flexChildrenClass } from './common';

export default function About() {
	setTitle('about');

	return (
		<div className="flex flex-column">
			<div className={flexChildrenClass}>
				<div>
					<a href="/">fittin.gs</a> is a site to quickly find Eve fittings. Data
					is scraped from <a href="https://zkillboard.com/">zkillboard</a>.
				</div>
				<div className="mt2">
					Submit feature requests or bug reports on{' '}
					<a href="https://github.com/mjibson/fittin.gs">GitHub</a>.
				</div>
				<div className="mt2">
					If you find this site useful, send ISK in game to{' '}
					<span style={{ color: 'var(--emph-medium)' }}>Jean Iridus</span>.
				</div>
			</div>
		</div>
	);
}
