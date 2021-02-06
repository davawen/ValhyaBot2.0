import * as dotenv from "dotenv";
dotenv.config();

const config =
{
	TOKEN: process.env.TOKEN,
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