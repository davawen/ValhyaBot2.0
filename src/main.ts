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
	GOOGLE_ID: process.env.GOOGLE_ID
};



import { Client, TextChannel, Intents } from "discord.js";
import { Client as FaunadbClient, query as q, Documents, Collection} from 'faunadb';

import { recieveWebhooks } from './web/web';
import { FaunaStreamerCollectionResponse } from "./api";

import { ServerQueue } from './include/song';
import { Streamer } from './include/streamer';


//Setup global values needed bt commands
export const faunaClient = new FaunadbClient({ secret: config.FAUNA_SECRET });


export const serverQueue: ServerQueue = new Map();

export const streamers: Map<string, Streamer> = new Map();

import { commands } from "./commands";
// export const commands = Object.values(__c); //Transform command object into array

//#region Discord based events
const client = new Client( {
	intents: [
		Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILDS
	]
} );

client.on("messageCreate",
	(message) =>
	{
		if(message.author.bot) return;
		if(!message.content.startsWith("!t")) return;
		
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
					message.channel.send("Vous devez avoir les permissions administrateurs pour utiliser cette commande !")
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
		const faunaStreamers: FaunaStreamerCollectionResponse = await faunaClient.query(
			q.Map(
				q.Paginate(Documents(Collection('streamers'))),
				q.Lambda(x => q.Get(x))
			)
		);
		
		faunaStreamers.data.forEach(
			faunaStreamer =>
			{
				let channels: TextChannel[] = [];
				
				faunaStreamer.data.channels.forEach(channelID => channels.push(client.channels.cache.get(channelID) as TextChannel));
				
				let newStreamer = new Streamer(
					{
						name: faunaStreamer.data.name,
						displayName: faunaStreamer.data.displayName,
						channels: channels,
						id: faunaStreamer.data.id,
						date: faunaStreamer.data.date
					}
				);
				
				streamers.set(faunaStreamer.data.name, newStreamer);
				
				newStreamer.renewSubscription();
			}
		);
		
		//Check for webhooks
		recieveWebhooks();
	}
);

client.login(config.TOKEN).catch(console.log);

//#endregion
