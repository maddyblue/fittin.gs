import React, { useState, useEffect, Fragment, useRef } from 'react';
import './App.css';
import 'tachyons/css/tachyons.min.css';
import { Fetch, useKey } from './common';
import SortedTable from './SortedTable';
import {
	BrowserRouter as Router,
	Switch,
	Route,
	Link,
	useParams,
	useLocation,
	useHistory,
} from 'react-router-dom';

interface ItemCharge {
	ID: number;
	Name: string;
	Charge?: {
		ID: number;
		Name: string;
	};
}

interface FitData {
	Killmail: number;
	Zkb: {
		locationID: number;
		hash: string;
		fittedValue: number;
		totalValue: number;
		points: number;
		npc: boolean;
		solo: boolean;
		awox: boolean;
		href: string;
	};
	Ship: ItemCharge;
	Hi: ItemCharge[];
	Med: ItemCharge[];
	Low: ItemCharge[];
	Rig: ItemCharge[];
	Sub: ItemCharge[];
	Charges: ItemCharge[];
}

function Fit() {
	const { id } = useParams();
	const [data, setData] = useState<FitData | null>(null);

	useEffect(() => {
		Fetch<FitData>('Fit?id=' + id, data => {
			const all = new Array<ItemCharge>().concat(
				data.Low,
				data.Med,
				data.Hi,
				data.Rig
			);
			const seen: { [name: string]: boolean } = {};
			data.Charges = [];
			all.forEach(v => {
				if (!v.Charge || seen[v.Charge.Name]) {
					return;
				}
				seen[v.Charge.Name] = true;
				data.Charges.push(v.Charge);
			});
			setData(data);
		});
	}, [id]);

	if (!data) {
		return <Fragment>loading...</Fragment>;
	}
	return (
		<div className="flex">
			<div>
				<h2>
					<Link to={'/?ship=' + data.Ship.ID}>{data.Ship.Name}</Link>&nbsp;
				</h2>
				<Render id={data.Ship.ID} size={256} alt={data.Ship.Name} />
				<pre style={{ background: 'var(--dp04)', padding: '.2rem' }}>
					{TextFit(data)}
				</pre>
				{data.Zkb.fittedValue ? (
					<div>
						Fitted value: <ISK isk={data.Zkb.fittedValue} />
					</div>
				) : null}
				<div className="list">
					<a href={'https://zkillboard.com/kill/' + data.Killmail}>
						zkillboard
					</a>
					<a href={'https://everef.net/type/' + data.Ship.ID}>everef</a>
				</div>
			</div>
			<div>
				<div>
					<h3>high slots</h3>
					<Slots items={data.Hi} />
				</div>
				<div>
					<h3>medium slots</h3>
					<Slots items={data.Med} />
				</div>
				<div>
					<h3>low slots</h3>
					<Slots items={data.Low} />
				</div>
				<div>
					<h3>rigs</h3>
					<Slots items={data.Rig} />
				</div>
				<div>
					<h3>charges</h3>
					<Slots items={data.Charges} />
				</div>
			</div>
		</div>
	);
}

function TextFit(data: FitData) {
	const fit = ['[' + data.Ship.Name + ']'];
	[data.Low, data.Med, data.Hi, data.Rig].forEach((slot, idx) => {
		if (idx > 0) {
			fit.push('');
		}
		slot.forEach(v => {
			if (!v.Name) {
				return;
			}
			let n = v.Name;
			if (v.Charge) {
				n += ', ' + v.Charge.Name;
			}
			fit.push(n);
		});
	});
	return fit.join('\n');
}

function Slots(props: { items: ItemCharge[] }) {
	if (!props.items) {
		return null;
	}
	return (
		<Fragment>
			{props.items
				.filter(v => v.Name)
				.map((v, idx) => {
					return (
						<div key={idx}>
							<Icon id={v.ID} alt={v.Name} />{' '}
							<Link to={'/?item=' + v.ID}>{v.Name}</Link>
						</div>
					);
				})}
		</Fragment>
	);
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
			style={{ verticalAlign: 'middle', marginRight: '.2rem' }}
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

function Fits() {
	const [data, setData] = useState<FitsData | null>(null);
	const location = useLocation();
	const history = useHistory();

	useEffect(() => {
		Fetch<FitsData>('Fits' + location.search, setData);
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
		<div>
			{Object.entries(data.Filter).map(([type, items]) =>
				items.map(item => (
					<div key={item.ID}>
						filter by {type}: {item.Name}
						<button
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
					</div>
				))
			)}
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
						// Sort by number of hi slot modules.
						cmp: (a: any, b: any) => a.length - b.length,
					},
				]}
				data={data.Fits || []}
			/>
		</div>
	);
}

function SlotSummary(props: {
	items: ItemCharge[];
	addParam: (name: string, val: string) => string;
}) {
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
				<span key={name} title={name} style={{ marginRight: '.2rem' }}>
					{count}x
					<Link to={props.addParam('item', ids[name].toString())}>
						<Icon id={ids[name]} alt={name} overrideSize={32} />
					</Link>
				</span>
			))}
		</Fragment>
	);
}

function ISK(props: { isk: number }) {
	const Misk = Number.parseFloat((props.isk / 1e6).toFixed(2));
	return <span>{Misk.toLocaleString()}M</span>;
}

interface SearchState {
	search: string;
	results?: SearchResults;
}

interface SearchResults {
	Search: string;
	Results: SearchResult[] | null;
}

interface SearchResult {
	Type: string;
	Name: string;
	ID: number;
}

function Search() {
	const search = new URLSearchParams(window.location.search);
	const q = search.get('q') || '';

	const [data, setData] = useState<SearchState>({ search: q });
	const location = useLocation();
	const history = useHistory();
	const inputRef = useRef<HTMLInputElement>(null);
	const enterPress = useKey('enter');

	useEffect(() => {
		if (inputRef && inputRef.current) {
			inputRef.current.focus();
		}
		Fetch<SearchResults>('Search?term=' + encodeURIComponent(q), res => {
			if (res && res.Results) {
				res.Results.sort((a, b) => {
					if (a.Type === b.Type) {
						return a.Name.localeCompare(b.Name);
					}
					if (a.Type === 'ship') {
						return -1;
					}
					if (b.Type === 'ship') {
						return 1;
					}
					debugger; // should be unreachable
					return 0;
				});
			}
			setData({ search: q, results: res });
		});
	}, [location, q]);

	useEffect(() => {
		if (enterPress && data.results && data.results.Results) {
			const r = data.results.Results[0];
			history.push('/?' + r.Type + '=' + r.ID.toString());
		}
	}, [enterPress, data.results, history]);

	return (
		<div>
			<input
				ref={inputRef}
				type="text"
				value={q}
				onChange={ev => {
					const v = ev.target.value;
					if (v === undefined) {
						return;
					}
					history.replace('/search?q=' + encodeURIComponent(v));
				}}
			/>
			{data.results && data.results.Results
				? data.results.Results.map(v => (
						<div key={v.ID}>
							<Link to={'/?' + v.Type + '=' + v.ID.toString()}>
								<Icon id={v.ID} alt={v.Name} /> {v.Name}
							</Link>{' '}
							({v.Type})
						</div>
				  ))
				: null}
		</div>
	);
}

export default function App() {
	return (
		<Router>
			<div className="sans-serif">
				<nav>
					<ul>
						<li>
							<Link to="/">fits</Link>
						</li>
						<li>
							<Link to="/search">search</Link>
						</li>
					</ul>
				</nav>

				<Switch>
					<Route path="/fit/:id" children={<Fit />} />
					<Route path="/search" children={<Search />} />
					<Route path="/" children={<Fits />} />
				</Switch>
			</div>
		</Router>
	);
}
