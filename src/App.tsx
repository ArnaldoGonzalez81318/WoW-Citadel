import { Routes, Route } from "react-router-dom"
import AppShell from "@/components/layout/AppShell"
import { SearchProvider } from "@/features/search/context/SearchContext"
import AchievementsPage from "@/features/achievements/components/AchievementsPage"
import ConnectedRealmsPage from "@/features/connectedRealms/components/ConnectedRealmsPage"
import HomePage from "@/pages/HomePage"
import CategoryPage from "@/pages/CategoryPage"
import NotFoundPage from "@/pages/NotFoundPage"

const App = (): JSX.Element => (
	<SearchProvider>
		<AppShell>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/category-*" element={<CategoryPage />} />
				<Route path="/achievements" element={<AchievementsPage />} />
				<Route path="/connected-realms" element={<ConnectedRealmsPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</AppShell>
	</SearchProvider>
)

export default App
