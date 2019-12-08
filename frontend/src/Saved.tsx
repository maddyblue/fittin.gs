import React from 'react';
import { savedPrefix, flexChildrenClass } from './common';
import { FitsTable, FitSummary } from './Fits';

export default function Saved() {
	const saved: Array<FitSummary> = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k) {
			continue;
		}
		const val = localStorage.getItem(k);
		if (!val) {
			continue;
		}
		if (k.startsWith(savedPrefix)) {
			saved.push(JSON.parse(val));
		}
	}

	return (
		<div className="flex flex-wrap">
			<div className={flexChildrenClass}>
				<FitsTable data={saved} />
			</div>
		</div>
	);
}
