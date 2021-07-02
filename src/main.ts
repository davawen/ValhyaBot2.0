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



import { Client, TextChannel } from "discord.js";
import { Client as FaunadbClient, query as q, Documents, Collection} from 'faunadb';

import { recieveWebhooks } from './web';
import { FaunaStreamerCollectionResponse } from "./api";

import { ServerQueue } from './include/song';
import { Streamer } from './include/streamer';



//Setup global values needed bt commands
export const faunaClient = new FaunadbClient({ secret: config.FAUNA_SECRET });


export const serverQueue: ServerQueue = new Map();

export const streamers: Map<string, Streamer> = new Map();

import * as __c from "./commands";
export const commands = Object.values(__c); //Transform command object into array

//#region Discord based events
const client = new Client();

client.on("message",
	(message) =>
	{
		if(message.author.bot) return;
		if(!message.content.startsWith("!t")) return;
		
		//Split based on space
		let splitedMessage = message.content.split(" ");

		//Rejoin when there are quotes
		const parsedMessage = [];
		let value = "";
		for(let i = 0; i < splitedMessage.length; i++)
		{
			let _str = splitedMessage[i];
			
			let _startWithQuote = _str.startsWith("\"");
			let _endWithQuote = _str.endsWith("\"");
			
			if(_startWithQuote && _endWithQuote)
			{
				parsedMessage.push(_str.slice(1, _str.length-1));
			}
			else if(_startWithQuote)
			{
				value += _str.slice(1) + " ";
			}
			else if(_endWithQuote)
			{
				parsedMessage.push(value + _str.slice(0, _str.length - 1)); //Remove quote at end
				value = "";
			}
			else
			{
				if(value === "") parsedMessage.push(_str);
				else value += _str + " ";
			}
		}
		
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
					return message.channel.send("Vous devez avoir les permissions administrateurs pour utiliser cette commande !");
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
