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

import { Client, ClientOptions, Message, Guild, VoiceConnection, StreamDispatcher, VoiceChannel } from "discord.js";

//#region Interfaces/Classes

export type CommandArgument = "commands" | "serverQueue";

export interface Command
{
	run: (client: Client, message: Message, parsedMessage: string[], args?: any[]) => void,
	name: string,
	description: string,
	help: string,
	args?: CommandArgument[];
};

export class Song
{
	title: string;
	url: string;
	/** Length in seconds */
	length: number;
	thumbnail: string;
	
	constructor(title :string, url: string, length: number, thumbnail: string)
	{
		this.title = title;
		this.url = url;
		this.length = length;
		this.thumbnail = thumbnail;
	}
}

export type ServerQueue = Map<string, Queue>;

export class Queue
{
	guild: Guild; //The server the guild is in
	
	voiceChannel: VoiceChannel;
	connection: VoiceConnection;
	dispatcher: StreamDispatcher;
	
	songs: Song[];
	current: Song;
	volume: number;
	paused: boolean;
	
	constructor(guild: Guild)
	{
		this.guild = guild;
		
		this.voiceChannel = null;
		this.connection = null;
		
		this.songs = [];
		this.current = null;
		this.volume = 1;
		this.paused = false;
	}
	
	disconnect(serverQueue: ServerQueue)
	{
		this.voiceChannel.leave();
		this.connection = null;
		
		this.dispatcher.destroy();
		
		serverQueue.delete(this.guild.id);
	}
	
	// pause()
	// {
	// 	if(!this.dispatcher) return;
		
	// 	if(!this.paused) this.dispatcher.pause();
	// 	else this.dispatcher.resume();
		
	// 	this.paused = !this.paused;
		
	// 	console.log(this.dispatcher.paused);
	// }
}

//#endregion

import * as _c from "./commands";
let commands = Object.values(_c);

let serverQueue: ServerQueue = new Map();

let client = new Client();

client.on("message",
	(message) =>
	{
		if(message.author.bot) return;
		if(!message.content.startsWith("!t")) return;
		
		//Split based on space
		let splitedMessage = message.content.split(" ");

		//Rejoin when there are quotes
		let parsedMessage = [];
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
		
		let _cName = parsedMessage.shift();
		
		let command = commands.find(c => c.name === _cName );
		
		if(command != undefined)
		{
			if(!command.args) command.run(client, message, parsedMessage);
			else
			{
				let additionalArgs = [];
				command.args.forEach(
					a =>
					{
						switch(a)
						{
							case "commands":
								additionalArgs.push(commands);
								break;
							case "serverQueue":
								additionalArgs.push(serverQueue);
								break;
						} 
					}
				);
				
				command.run(client, message, parsedMessage, additionalArgs);
			}
		}
	}
);

client.on("ready",
	() => 
	{
		console.log(`Logged in as ${client.user.username}!`);
	}
);

client.login(config.TOKEN).catch(console.log);