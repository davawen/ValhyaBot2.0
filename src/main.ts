import * as dotenv from "dotenv";
dotenv.config();

const config =
{
	TOKEN: process.env.TOKEN,
	PREFIX: process.env.PREFIX,
	TWITCH_ID: process.env.TWITCH_ID,
	FAUNA_SECRET: process.env.FAUNA_SECRET,
	FAUNA_KEY: process.env.FAUNA_KEY
};

import { Client, ClientOptions, Message } from "discord.js";

//#region Interfaces/Classes

type CommandArgument = "commands";

interface Command
{
	run: (client: Client, message: Message, parsedMessage: string[], args?: any[]) => void,
	name: string,
	description: string,
	help: string,
	args?: CommandArgument[];
};

export { Command };

//#endregion

import * as _c from "./commands";
let commands = Object.values(_c);

let client = new Client();

client.on("message",
	(message) =>
	{
		if(message.author.bot) return;
		if(!message.content.startsWith(">v")) return;
		
		//Split based on space
		let splitedMessage = message.content.split(" ");
		
		//Rejoin when there are quotes
		let parsedMessage = [];
		let value = "";
		for(let i = 0; i < splitedMessage.length; i++)
		{
			if(splitedMessage[i].startsWith("\"")) //If starts with quote, add to memory
			{
				value += splitedMessage[i].slice(1) + " "; //Remove quote at start
			}
			else if(splitedMessage[i].endsWith("\"")) //If ends with quote, add memory to splitedMessage
			{
				parsedMessage.push(value + splitedMessage[i].slice(0, splitedMessage[i].length-1)); //Remove quote at end
				value = "";
			}
			else //In between or standalone word
			{
				if(value === "") parsedMessage.push(splitedMessage[i]);
				else value += splitedMessage[i] + " ";
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