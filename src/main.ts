import { Client, TextChannel, Intents } from 'discord.js';

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDoc, getDocs, QuerySnapshot, CollectionReference } from 'firebase/firestore/lite';

import { DatabaseStreamer } from "./api";

import { ServerQueue } from './include/song';
import { Streamer } from './include/streamer';
import { config, firebaseConfig } from './include/config'


//Setup global values needed bt commands
export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const streamerCollection = collection(db, "streamers") as CollectionReference<DatabaseStreamer>;

export const serverQueue: ServerQueue = new Map();

export const streamers: Map<string, Streamer> = new Map();

import { commands } from "./commands";

//#region Discord based events
const client = new Client( {
	intents: [
		Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES
	]
} );

client.on("messageCreate",
	(message) =>
	{
		if(message.author.bot) return;
		if(!message.content.startsWith("!t"))
		{
			if(message.content.startsWith("gnight")) message.channel.send("https://c.tenor.com/43cc01Cj1JkAAAAd/knight-dance.gif");
			
			return;
		}
		
		//Split message arguments with spaces and quotes
		// command a "b c" -> ['command', 'a', 'b c']
		// Then remove quotes from either end (only works with regex for some reason)
		let parsedMessage = message.content.match(/[\""].+?[\""]|[^ ]+/g)
			.map(v => v.replace(/"/g, ""));
		
		// Remove "!t"
		parsedMessage.shift();
		
		const commandName = parsedMessage.shift();
		
		const command = commands.find(c => c.name === commandName );
		
		if(command == undefined) return;
		
		try
		{
			if(command.admin)
			{
				if(!message.member.permissions.has('ADMINISTRATOR'))
				{
					message.channel.send("Vous devez avoir les permissions administrateurs pour utiliser cette commande !");
					return;
				}
			}
			
			command.run(client, message, parsedMessage);
		}
		catch(err)
		{
			message.channel.send(`Une erreur à été rencontrée avec la commande: ${err}`);
			console.log(`Error encountered while running command ${command.name},\nat ${new Date()},\nsent by ${message.author.username}, with arguments ${parsedMessage},\nError message : ${err}`);
		}
	}
);

client.on("ready",
	async () => 
	{
		console.log(`Logged in as ${client.user.username}!`);
		
		//Get already present streamers from database
		const dbStreamers = await getDocs(streamerCollection);
		
		dbStreamers.docs.forEach(
			(dbStreamer) =>
			{
				let channels: TextChannel[] = [];
				
				const dbStreamerData = dbStreamer.data();
				
				dbStreamerData.channels.forEach(async channelID => channels.push((await client.channels.fetch(channelID)) as TextChannel));
				
				let newStreamer = new Streamer(
					{
						name: dbStreamerData.name,
						displayName: dbStreamerData.displayName,
						channels: channels,
						id: dbStreamerData.id,
						dbId: dbStreamer.ref,
						date: dbStreamerData.date
					}
				);
				
				streamers.set(dbStreamerData.name, newStreamer);
				
				newStreamer.renewSubscription();
			}
		);
	}
);

// console.log(config);

client.login(config.TOKEN).catch(console.log);

//#endregion