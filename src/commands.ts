import { Client, Message, MessageEmbed } from "discord.js"
import { Command } from "./main"

export const help: Command =
{
	"run": (client, message, parsedMessage, args: [Command[]]) =>
	{
		let embed = new MessageEmbed();
		embed.setColor("#2F4F4F");
		embed.setTitle("*Valhyabot 2.0*");
		
		args[0].forEach(
			c =>
			{
				embed.addField(`**${c.name}:**`, `${c.description}\nUtilisation: >v ${c.name} ${c.help}`, false);
			}
		);
		
		message.channel.send(embed);
	},
	"name": "help",
	"description": "Envoit la liste de commandes",
	"help": "",
	"args": ["commands"]
}

export const poll: Command = 
{
	"run": async (client, message, parsedMessage) =>
	{
		let regionalIndicators = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲", "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿"];
		
		let embed = new MessageEmbed();
		embed.setColor("#2F4F4F");
		embed.setTitle(parsedMessage.shift());
		
		parsedMessage.forEach(
			(s, index) =>
			{
				embed.addField(s, regionalIndicators[index]);
			}
		);
		
		let newMessage = await message.channel.send(embed);
		
		if(parsedMessage.length == 0)
		{
			newMessage.react("✅");
			newMessage.react("❌");
		}
		else
		{
			parsedMessage.forEach( (s, index) => newMessage.react(regionalIndicators[index]) );
		}
	},
	"name": "poll",
	"description": "Envoit un sondage (ajoutez des guillemets pour les espaces!)",
	"help": "\"<Question>\" | \"<Question>\" \"<Réponse 1>\" \"<Réponse 2>\" <...>",
	"args": null
}