import { Location, LocationListener, UnregisterCallback } from 'history';
import { useEffect } from 'react';
import ReactGA from 'react-ga';
import { useHistory } from 'react-router';

const sendPageView: LocationListener = (location: Location): void => {
	ReactGA.set({ page: location.pathname });
	ReactGA.pageview(location.pathname);
	console.debug('GA|Pageview Sent: ', location.pathname);
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
