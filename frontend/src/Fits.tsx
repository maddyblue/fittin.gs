import React, { useState, Fragment, useEffect } from 'react';
import { Link, useLocation, useHistory } from 'react-router-dom';
import SortedTable from './SortedTable';
import {
	Ref,
	Icon,
	ISK,
	setTitle,
	Fetch,
	flexChildrenClass,
	ItemCharge,
} from './common';

export default function Fits() {
	const [data, setData] = useState<FitsData | null>(null);
	const location = useLocation();
	const history = useHistory();
	setTitle();

	useEffect(() => {
		Fetch<FitsData>('Fits' + location.search, data => {
			setTitle();
			setData(data);
		});
	}, [location]);

	if (!data) {
		return <Fragment>loading...</Fragment>;
	}

	const addParam = function(name: string, val: string) {
		// Using location.search doesn't appear to update on URL
		// change. I suspect this is due to something I misunderstand
		// about hooks or some misuse of react router's useLocation,
		// but for now just use the real search path.
		const urlBase = window.location.search || '?';
		const param = name + '=' + val;
		let url = location.pathname + urlBase;
		if (urlBase.indexOf(param) === -1) {
			if (url[url.length - 1] !== '?') {
				url += '&';
			}
			url += param;
		}
		return url;
	};

	return (
		<div className="flex flex-column">
			{Object.keys(data.Filter).length ? (
				<div className={flexChildrenClass}>
					{Object.entries(data.Filter).map(([type, items]) =>
						items.map(item => (
							<div key={item.ID} className="ma1">
								filter by {type}: {item.Name}
								<button
									className="mh2 ba b--secondary bg-dp08 pointer"
									onClick={() => {
										const old = new URLSearchParams(location.search);
										const next = new URLSearchParams();
										for (let pair of old.entries()) {
											if (pair[0] === type && pair[1] === item.ID.toString()) {
												continue;
											}
											next.append(pair[0], pair[1]);
										}
										history.push(location.pathname + '?' + next.toString());
									}}
								>
									x
								</button>
								<Ref ID={item.ID} />
							</div>
						))
					)}
				</div>
			) : null}
			<div className={flexChildrenClass}>
				<SortedTable
					name="fits"
					sort="Cost"
					headers={[
						{
							name: 'Name',
							header: 'ship',
							cell: (_: any, row: any) => (
								<Link to={addParam('ship', row.Ship)}>
									<Icon id={row.Ship} alt={row.Name} overrideSize={32} />
									{row.Name}
								</Link>
							),
						},
						{
							name: 'Cost',
							header: 'fit',
							desc: true,
							cell: (v: any, row: any) => (
								<Link to={'/fit/' + row.Killmail}>
									{v > 0 ? <ISK isk={v} /> : 'unknown value'}
								</Link>
							),
						},
						{
							name: 'Hi',
							header: 'high slots',
							cell: (v: any) => <SlotSummary items={v} addParam={addParam} />,
							desc: true,
							cmp: slotCmp,
						},
						{
							name: 'Med',
							header: 'med slots',
							cell: (v: any) => <SlotSummary items={v} addParam={addParam} />,
							desc: true,
							cmp: slotCmp,
						},
						{
							name: 'Lo',
							header: 'low slots',
							cell: (v: any) => <SlotSummary items={v} addParam={addParam} />,
							desc: true,
							cmp: slotCmp,
						},
					]}
					data={data.Fits || []}
					tableClass="collapse"
					tdClass="ph2"
				/>
			</div>
		</div>
	);
}

function SlotSummary(props: {
	items: ItemCharge[];
	addParam: (name: string, val: string) => string;
}) {
	if (!props.items) {
		return null;
	}
	const counts: { [name: string]: number } = {};
	const ids: { [name: string]: number } = {};
	props.items.forEach(v => {
		if (!counts[v.Name]) {
			counts[v.Name] = 0;
			ids[v.Name] = v.ID;
		}
		counts[v.Name] += 1;
	});
	const arr = Object.entries(counts);
	arr.sort((a, b) => {
		const n = b[1] - a[1];
		if (n !== 0) {
			return n;
		}
		return a[0].localeCompare(b[0]);
	});
	return (
		<Fragment>
			{arr.map(([name, count]) => (
				<span key={name} title={name}>
					<Link
						to={props.addParam('item', ids[name].toString())}
						style={{ color: 'var(--emph-high)', textDecoration: 'none' }}
					>
						{count}x
						<Icon id={ids[name]} alt={name} overrideSize={32} />
					</Link>
				</span>
			))}
		</Fragment>
	);
}

interface FitsData {
	Filter: {
		item: ItemCharge[];
		ship: ItemCharge[];
	};
	Fits: {
		Killmail: number;
		Ship: number;
		Name: string;
		Cost: number;
		Hi: ItemCharge[];
	}[];
}

function slotCmp(a: any, b: any): number {
	return (a || []).length - (b || []).length;
}
