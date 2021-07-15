import { Client, Message } from 'discord.js';

export type CommandArgument = "commands" | "serverQueue" | "streamers";

interface CommandConstructorOptions
{
	/**Function called when the command is invoked*/
	run: (client: Client, message: Message, parsedMessage: string[]) => void;
	/**Name of the command, as will be typed by the user*/
	name: string;
	/**Description of the command, which will be show in the help command*/
	description: string;
	/**Array describing the usage of the command, each string will be a different version of the command*/
	help?: string[];
	/**Wether the command requires admin permissions to be run, false by default*/
	admin?: boolean;
};

export class Command
{
	run: (client: Client, message: Message, parsedMessage: string[]) => void;
	name: string;
	description: string;
	help: string[];
	admin: boolean;
	
	constructor(options: CommandConstructorOptions)
	{
		this.run = options.run;
		this.name = options.name;
		this.description = options.description;
		this.help = options.help || [""];
		this.admin = options.admin || false;
	}
}