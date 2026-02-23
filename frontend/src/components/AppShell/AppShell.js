import Header from '../Header/Header';
import Navigation from '../Navigation/Navigation';
import AnnouncementBar from '../AnnouncementBar/AnnouncementBar';

export default function AppShell({children}) {
	return (
		<>
			<Header />
			<Navigation />
			{/* <AnnouncementBar /> */}
			{children}
		</>
	);
}
