import React, { Fragment, useState, useEffect } from 'react';
import {
	Render,
	Ref,
	ISK,
	Icon,
	ItemCharge,
	setTitle,
	Fetch,
	flexChildrenClass,
} from './common';
import { Link, useParams } from 'react-router-dom';

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

export default function Fit() {
	const { id } = useParams();
	const [data, setData] = useState<FitData | null>(null);

	useEffect(() => {
		setTitle();
		Fetch<FitData>('Fit?id=' + id, data => {
			const all = new Array<ItemCharge>().concat(data.Low, data.Med, data.Hi);
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
			setTitle(data.Ship.Name);
		});
	}, [id]);

	if (!data) {
		return <Fragment>loading...</Fragment>;
	}
	return (
		<div className="flex flex-wrap">
			<div className={flexChildrenClass}>
				<h2>
					<Link to={'/?ship=' + data.Ship.ID}>{data.Ship.Name}</Link>
				</h2>
				<Render id={data.Ship.ID} size={256} alt={data.Ship.Name} />
				<pre className="bg-dp04 pa1 f6">{TextFit(data)}</pre>
				{data.Zkb.fittedValue ? (
					<div>
						Fitted value: <ISK isk={data.Zkb.fittedValue} />
					</div>
				) : null}
				<div className="list">
					<a href={'https://zkillboard.com/kill/' + data.Killmail}>
						zkillboard
					</a>
					<Ref ID={data.Ship.ID} />
				</div>
			</div>
			<div className={flexChildrenClass}>
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
				{data.Sub[0].Name ? (
					<div>
						<h3>subsystems</h3>
						<Slots items={data.Sub} />
					</div>
				) : null}
				<div>
					<h3>charges</h3>
					<Slots items={data.Charges} />
				</div>
			</div>
		</div>
	);
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
							<Link to={'/?item=' + v.ID}>
								<Icon id={v.ID} alt={v.Name} /> {v.Name}
							</Link>
						</div>
					);
				})}
		</Fragment>
	);
}

function TextFit(data: FitData) {
	const fit = ['[' + data.Ship.Name + ']'];
	[data.Low, data.Med, data.Hi, data.Rig, data.Sub].forEach((slot, idx) => {
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
