import { useEffect, useState } from "react";
import { Player, Character } from "../ts/interfaces/Player.interface";

const useAutocomplete = (
	data: Player | null,
	inputSearchRef: HTMLInputElement | null
) => {
	const [searchedValue, setSearchedValue] = useState("");
	const [suggestions, setSuggestions] = useState<Character[]>([]);
	const [selectedSuggestion, setSelectedSuggestion] = useState("");
	const [activeSuggestion, setActiveSuggestion] = useState(0);

	useEffect(() => {
		if (inputSearchRef) {
			inputSearchRef.focus();
		}
	}, [inputSearchRef]);

	const handleChange = (
		event: React.ChangeEvent<HTMLInputElement>
	): void => {
		const inputValue = event.target.value;
		setSearchedValue(inputValue);

		if (inputValue.trim() !== "") {
			const filteredSuggestions = data?.wow_accounts
				.flatMap((account) => account.characters)
				.filter((itemData) => {
					const value = inputValue.toUpperCase();
					const name = itemData.name.toUpperCase();

					return value && name.startsWith(value) && name !== value;
				});

			setSuggestions(filteredSuggestions || []);
		} else {
			setSuggestions([]);
			setSelectedSuggestion("");
			setActiveSuggestion(0);
		}
	};

	const handleKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>
	): void => {
		if (event.key === "ArrowDown" && activeSuggestion < suggestions.length) {
			setActiveSuggestion((prev) => prev + 1);
		} else if (event.key === "ArrowUp" && activeSuggestion > 1) {
			setActiveSuggestion((prev) => prev - 1);
		} else if (event.key === "Enter") {
			setSearchedValue(
				suggestions[activeSuggestion - 1]?.name || ""
			);
			setSelectedSuggestion(
				suggestions[activeSuggestion - 1]?.name || ""
			);
			setSuggestions([]);
			setActiveSuggestion(0);
		}
	};

	const handleClick = (value: string) => {
		setSearchedValue(value);
		setSuggestions([]);
		setSelectedSuggestion(value);
		setActiveSuggestion(0);
		// do something else
	};

	return {
		searchedValue,
		suggestions,
		selectedSuggestion,
		activeSuggestion,
		handleChange,
		handleKeyDown,
		handleClick,
	};
};

export default useAutocomplete;