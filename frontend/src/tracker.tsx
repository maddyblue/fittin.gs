import { Location, LocationListener, UnregisterCallback } from 'history';
import { useEffect } from 'react';
import ReactGA from 'react-ga';
import { useHistory } from 'react-router';

const sendPageView: LocationListener = (location: Location): void => {
	const loc = location.pathname + location.search;
	ReactGA.set({ page: loc });
	ReactGA.pageview(loc);
	console.debug('pageview:', loc);
};

interface Props {
	children: JSX.Element;
	trackingId?: string;
}
const GAListener = ({ children, trackingId }: Props): JSX.Element => {
	const history = useHistory();
	useEffect((): UnregisterCallback | void => {
		if (trackingId) {
			ReactGA.initialize(trackingId);
			sendPageView(history.location, 'REPLACE');
			return history.listen(sendPageView);
		}
	}, [history, trackingId]);

	return children;
};

export default GAListener;
