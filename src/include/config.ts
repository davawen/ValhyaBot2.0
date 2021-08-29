import * as dotenv from "dotenv";
dotenv.config();

export const config =
{
	TOKEN: process.env.TOKEN,
	TWITCH_ID: process.env.TWITCH_ID,
	TWITCH_OAUTH: process.env.TWITCH_OAUTH,
	TWITCH_SECRET: process.env.TWITCH_SECRET,
	FAUNA_SECRET: process.env.FAUNA_SECRET,
	FAUNA_KEY: process.env.FAUNA_KEY,
	GOOGLE_ID: process.env.GOOGLE_ID,
	FIREBASE_KEY: process.env.FIREBASE_KEY
};

export const firebaseConfig =
{
	apiKey: config.FIREBASE_KEY,
	authDomain: "valhyabot-291020.firebaseapp.com",
	projectId: "valhyabot-291020",
	storageBucket: "valhyabot-291020.appspot.com",
	messagingSenderId: "398003084709",
	appId: "1:398003084709:web:57602236dab27056401c4c"
};