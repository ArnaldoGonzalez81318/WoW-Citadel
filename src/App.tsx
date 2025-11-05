import AppShell from "@/components/layout/AppShell"
import SearchExperience from "@/features/search/components/SearchExperience"
import { SearchProvider } from "@/features/search/context/SearchContext"

const App = (): JSX.Element => (
	<SearchProvider>
		<AppShell>
			<SearchExperience />
		</AppShell>
	</SearchProvider>
)

export default App
