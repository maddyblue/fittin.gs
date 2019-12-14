import React from 'react';
import './App.css';
import 'tachyons/css/tachyons.min.css';
import {
	BrowserRouter as Router,
	Switch,
	Route,
	NavLink,
} from 'react-router-dom';
import GAListener from './tracker';
import Search from './Search';
import About from './About';
import Fit from './Fit';
import Fits from './Fits';
import Saved from './Saved';

export default function App() {
	const trackingId =
		process.env.NODE_ENV === 'production' ? 'UA-154150569-1' : undefined;

	return (
		<Router>
			<GAListener trackingId={trackingId}>
				<div className="sans-serif">
					<nav className="pa3 bg-dp04">
						<ul className="list ma0 pa0">
							<li className="ma2">
								<NavLink to="/" exact>
									fittin.gs
								</NavLink>
							</li>
							<li className="ma2">
								<NavLink to="/search">search</NavLink>
							</li>
							<li className="ma2">
								<NavLink to="/saved">saved</NavLink>
							</li>
							<li className="ma2">
								<NavLink to="/about">about</NavLink>
							</li>
						</ul>
					</nav>
					<div className="ma1">
						<ErrorBoundary>
							<Switch>
								<Route path="/fit/:id" children={<Fit />} />
								<Route path="/search" children={<Search />} />
								<Route path="/about" children={<About />} />
								<Route path="/saved" children={<Saved />} />
								<Route path="/" children={<Fits />} />
							</Switch>
						</ErrorBoundary>
					</div>
				</div>
			</GAListener>
		</Router>
	);
}

class ErrorBoundary extends React.Component<any, { hasError: boolean }> {
	constructor(props: any) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: any) {
		// Update state so the next render will show the fallback UI.
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			// You can render any custom fallback UI
			return <h1>Something went wrong.</h1>;
		}

		return this.props.children;
	}
}
