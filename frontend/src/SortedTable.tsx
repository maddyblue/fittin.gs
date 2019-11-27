import React, { Component, ReactNode } from 'react';
import { createCookie, readCookie } from './common';

const tableSortings: { [name: string]: SortedTable[] } = {};
const sortTableCookie = 'sort-table-';
function setTableSort(name: string, sort: string, dir: boolean) {
	const val = sort + ',' + (dir === true).toString();
	createCookie(sortTableCookie + name, val);
	const sortings = tableSortings[name];
	const st = {
		sort: sort,
		sortDir: dir,
	};
	sortings.forEach(v => {
		v.setState(st);
	});
}
function registerTableSort(that: SortedTable) {
	const name = that.props.name;
	if (!tableSortings[name]) {
		tableSortings[name] = [];
	}
	tableSortings[name].push(that);
}
function unregisterTableSort(that: SortedTable) {
	const name = that.props.name;
	tableSortings[name] = tableSortings[name].filter(v => v !== that);
}

type Cmp = (a: any, b: any) => number;

type Header = {
	name: string;
	header?: any;
	cell?: Cell;
	desc?: boolean;
	title?: string;
	cmp?: Cmp;
};

type Cell = (cell: any, row?: object) => ReactNode;

type Headers = Header[];

type Props = {
	name: string;
	headers: Headers;
	sort: string;
	data: Array<any>;
	notable?: boolean;
};

type State = {
	sort: string;
	sortDir: boolean;
	lookup: Lookup;
};

type Lookup = {
	[name: string]: {
		name: string;
		header: string;
		cell: Cell;
		desc: boolean;
		title?: string;
		cmp: Cmp;
	};
};

class SortedTable extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		const lookup = this.lookup(props.headers);
		let sort = props.sort;
		if (!this.props.name || !lookup[props.sort]) {
			debugger;
		}
		let dir = lookup[props.sort].desc === true;
		const cookie = readCookie(sortTableCookie + this.props.name);
		registerTableSort(this);
		if (cookie) {
			const sp = cookie.split(',', 2);
			if (sp.length === 2 && lookup[sp[0]]) {
				sort = sp[0];
				dir = sp[1] === 'true';
			}
		}
		this.state = {
			lookup: lookup,
			sort: sort,
			sortDir: dir,
		};
	}
	componentWillUnmount() {
		unregisterTableSort(this);
	}
	componentDidUpdate(nextProps: Props, nextState: State, nextContext: any) {
		nextState.lookup = this.lookup(nextProps.headers);
	}
	lookup(headers: Headers): Lookup {
		const lookup: Lookup = {};
		headers.forEach(h => {
			if (!h.cell) {
				h.cell = v => v;
			}
			if (!h.header) {
				h.header = h.name;
			}
			lookup[h.name] = {
				name: h.name,
				header: h.header || h.name,
				cell: h.cell || (v => v),
				desc: h.desc === true,
				title: h.title,
				cmp: h.cmp || defaultCmp,
			};
		});
		return lookup;
	}
	sort = (sort: string) => {
		if (this.state.lookup[sort].cmp === null) {
			return;
		}
		let dir;
		if (this.state.sort === sort) {
			dir = !this.state.sortDir;
		} else {
			dir = this.state.lookup[sort].desc === true;
		}
		setTableSort(this.props.name, sort, dir);
	};
	sortClass = (col: string) => {
		if (col !== this.state.sort) {
			return '';
		}
		const dir = this.state.sortDir ? 'desc' : 'asc';
		return 'sort-' + dir;
	};
	render() {
		const data = this.props.data;
		data.sort(
			(a: any, b: any): number =>
				this.state.lookup[this.state.sort].cmp(
					a[this.state.sort],
					b[this.state.sort]
				)
		);
		if (this.state.sortDir) {
			data.reverse();
		}
		const body = data.map((row, i) => (
			<tr key={i}>
				{this.props.headers.map(h => (
					<td key={h.name}>
						{this.state.lookup[h.name].cell(row[h.name], row)}
					</td>
				))}
			</tr>
		));
		const inner = [
			<thead key="thead">
				<tr>
					{this.props.headers.map(h => {
						let { name, title, header } = h;
						return (
							<th
								key={name}
								onClick={() => this.sort(name)}
								className={this.sortClass(name)}
								title={title}
							>
								{header}
							</th>
						);
					})}
				</tr>
			</thead>,
			<tbody key="tbody">{body}</tbody>,
		];
		if (this.props.notable) {
			return inner;
		}
		return <table className="sorted">{inner}</table>;
	}
}

const defaultCmp: Cmp = (a, b): number => {
	if (a === undefined) {
		return -1;
	}
	if (b === undefined) {
		return 1;
	}
	switch (typeof a) {
		case 'number':
			return a - b;
		case 'boolean':
			return (a ? 1 : 0) - (b ? 1 : 0);
		case 'string':
			return a.localeCompare(b);
		default:
			if (a instanceof Date) {
				if (a > b) return 1;
				if (a < b) return -1;
				return 0;
			}
	}
	debugger;
	return 0;
};

export default SortedTable;
