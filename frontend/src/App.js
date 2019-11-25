import React, { useState, useEffect } from 'react';
import 'tachyons/css/tachyons.min.css';
import { Fetch } from './common';
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

function Fit() {
	const { id } = useParams();
	const [data, setData] = useState(null);

	useEffect(() => {
		Fetch('Fit?id=' + id, data => {
			const all = [].concat(data.Low, data.Med, data.Hi, data.Rig);
			const seen = {};
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
		return 'loading...';
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

function TextFit(data) {
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

function Slots(props) {
	if (!props.items) {
		return null;
	}
	return props.items
		.filter(v => v.Name)
		.map((v, idx) => {
			return (
				<div key={idx}>
					<Icon id={v.ID} alt={v.Name} />{' '}
					<Link to={'/?item=' + v.ID}>{v.Name}</Link>
				</div>
			);
		});
}

function Render(props) {
	return <Img type="render" {...props} />;
}

function Icon(props) {
	return <Img type="icon" size={32} overrideSize={24} {...props} />;
}

function Img(props) {
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

function Fits() {
	const [data, setData] = useState(null);
	const location = useLocation();
	const history = useHistory();

	useEffect(() => {
		Fetch('Fits' + location.search, setData);
	}, [location]);

	if (!data) {
		return 'loading...';
	}

	const addParam = function(name, val) {
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
						cell: (_, row) => (
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
						cell: (v, row) => (
							<Link to={'/fit/' + row.Killmail}>
								{v > 0 ? <ISK isk={v} /> : 'unknown value'}
							</Link>
						),
					},
					{
						name: 'Hi',
						header: 'high slots',
						cell: v => <SlotSummary items={v} addParam={addParam} />,
						desc: true,
						// Sort by number of hi slot modules.
						cmp: (a, b) => a.length - b.length,
					},
				]}
				data={data.Fits || []}
			/>
		</div>
	);
}

function SlotSummary(props) {
	const counts = {};
	const ids = {};
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
	return arr.map(([name, count]) => (
		<span key={name} title={name} style={{ marginRight: '.2rem' }}>
			{count}x
			<Link to={props.addParam('item', ids[name])}>
				<Icon id={ids[name]} alt={name} overrideSize={32} />
			</Link>
		</span>
	));
}

function ISK(props) {
	const Misk = Number.parseFloat((props.isk / 1e6).toFixed(2));
	return <span>{Misk.toLocaleString()}M</span>;
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
					</ul>
				</nav>

				<Switch>
					<Route path="/fit/:id" children={<Fit />} />
					<Route path="/" children={<Fits />} />
				</Switch>
			</div>
		</Router>
	);
}
