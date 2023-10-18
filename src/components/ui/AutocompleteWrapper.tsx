import { useEffect, useState } from "react";
import axios from "axios";
import { Col, Container, Row, Text } from "@nextui-org/react";
import { Autocomplete } from ".";
import { Player } from "../../ts/interfaces/Player.interface";
import classes from "./ui.module.css";

const AutocompleteWrapper = () => {
	const [data, setData] = useState<Player | null>(null);

	useEffect(() => {
		const clientId = import.meta.env.VITE_REACT_APP_CLIENT_ID;
		const clientSecret = import.meta.env.VITE_REACT_APP_CLIENT_SECRET;
		const accessToken = import.meta.env.VITE_REACT_APP_ACCESS_TOKEN;

		axios
			.get(`${import.meta.env.VITE_REACT_APP_API_URI}/profile/user/wow`, {
				params: {
					namespace: "profile-us",
					locale: "en_US",
					access_token: accessToken,
				},
			})
			.then(({ data }) => {
				console.log("Data:", data);
				setData(data);
			})
			.catch((error) => {
				console.error("Error fetching data:", error);
			});
	}, []);

	return (
		<Container>
			<Row>
				<Col>
					<Text
						h1
						css={{
							textAlign: "center",
							textGradient: "45deg, $blue600 -20%, $pink600 50%",
						}}
					>
						Character Search
					</Text>
				</Col>
			</Row>
			<Row>
				<Col className={classes.autocompleteContainer}>
					<Autocomplete
						data={data}
					/>
				</Col>
			</Row>
		</Container>
	);
};

export default AutocompleteWrapper;