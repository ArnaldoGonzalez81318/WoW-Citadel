import { useEffect, useRef } from "react";
import { Card, Col, Input, Row, Text, User } from "@nextui-org/react";
import { Player, Character } from "../../ts/interfaces/Player.interface";
import useAutocomplete from "../../hooks/useAutocomplete";
import classes from "./ui.module.css";

interface Props {
	data: Player | null;
}

const Autocomplete = ({ data }: Props) => {
	const inputSearchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (inputSearchRef.current) {
			inputSearchRef.current.focus();
		} else {
			console.error("Input search ref is null");
		}
	}, []);

	const {
		activeSuggestion,
		handleClick,
		handleKeyDown,
		searchedValue,
		selectedSuggestion,
		suggestions,
	} = useAutocomplete(data, inputSearchRef.current);

	return (
		<div className={classes.autocomplete}>
			<Input
				bordered
				labelPlaceholder="Search your character"
				size="xl"
				value={searchedValue}
				onChange={() => { }}
				onKeyDown={handleKeyDown}
				ref={inputSearchRef}
				color="secondary"
			/>

			<Card css={{ marginTop: "0.5rem" }}>
				<Card.Body css={{ padding: "0" }}>
					{!suggestions.length && searchedValue.length && !selectedSuggestion.length ? (
						<Row className={classes.itemList}>
							<Col>
								<Text>Woops! It seems that we couldn't find any character with that name</Text>
							</Col>
						</Row>
					) : (
						<>
							{suggestions.map(({ name }: Character, index: number) => (
								<Row
									key={index}
									className={`${classes.itemList} ${activeSuggestion === index ? classes.itemListActive : ""
										}`}
									onClick={() => handleClick(name)}
								>
									<Col>
										<User
											name={name}
											size="large"
											css={{ borderRadius: "50%" }}
										/>
									</Col>
								</Row>
							))}
						</>
					)}
				</Card.Body>
			</Card>

			<Text size="$xs">Player selected: {selectedSuggestion}</Text>
		</div>
	);
};

export default Autocomplete;