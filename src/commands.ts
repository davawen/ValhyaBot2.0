import { Client, Message, MessageEmbed, VoiceChannel } from "discord.js"
import { config, Command, Queue, Song, ServerQueue } from "./main"
import { request, YoutubeSearchResponse } from './api'

import * as fs from 'fs';

//#region General
export const help: Command =
{
	run: (client, message, parsedMessage, args: [Command[]]) =>
	{
		let embed = new MessageEmbed();
		embed.setColor("#2F4F4F");
		embed.setTitle("*Valhyabot 2.0*");
		
		args[0].forEach(
			c =>
			{
				embed.addField(`**${c.name}:**`, `${c.description}\nUtilisation: !t ${c.name} ${c.help}`, false);
			}
		);
		
		message.channel.send(embed);
	},
	name: "help",
	description: "Envoit la liste de commandes",
	help: "",
	args: ["commands"]
}

export const poll: Command = 
{
	run: async (client, message, parsedMessage) =>
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
	name: "poll",
	description: "Envoit un sondage (ajoutez des guillemets pour les espaces!)",
	help: "\"<Question>\" | \"<Question>\" \"<Réponse 1>\" \"<Réponse 2>\" <...>",
	args: null
}
//#endregion

//#region Music
import * as ytdl from 'ytdl-core'

// TODO : set volume, skip 

async function play(id: string, serverQueue: ServerQueue, channel?: VoiceChannel)
{
	let queue = serverQueue.get(id);
	
	if(channel)
	{
		queue.voiceChannel = channel;
		queue.connection = await channel.join();
	}
	
	if(!queue.voiceChannel || !queue.connection) return;
	
	if(queue.songs.length <= 0)
	{
		queue.disconnect(serverQueue);
		return;
	}
	
	queue.current = queue.songs.shift();
	
	queue.dispatcher = queue.connection
		.play(ytdl(queue.current.url))
		.on("finish",
			() =>
			{
				play(id, serverQueue);
			}
		)
		.on("error", console.log);
}

export const p: Command = 
{
	run: async (client, message, parsedMessage, args: [ServerQueue]) =>
	{
		if(!message.member.voice.channel) return message.channel.send("Vous devez être dans un salon vocal pour cette commande !");
		
		const permissions = message.member.voice.channel.permissionsFor(client.user);
		if(!permissions.has('CONNECT') || !permissions.has('SPEAK')) return message.channel.send("Je ne peux pas rejoindre ou parler dans le salon vocal !");
		
		let url = parsedMessage.join(" ");
		
		if(!ytdl.validateURL(url))
		{
			let video: YoutubeSearchResponse = await request(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(url)}&key=${config.GOOGLE_ID}`);
			
			url = video.items[0].id.videoId;
		}
		
		
		let _songInfo = await ytdl.getInfo(url);

		let song = new Song(_songInfo.videoDetails.title, _songInfo.videoDetails.video_url, parseFloat(_songInfo.videoDetails.lengthSeconds), _songInfo.videoDetails.thumbnails[3].url);
		
		message.suppressEmbeds();
		
		let serverQueue = args[0];
		
		let queue = serverQueue.get(message.guild.id);
		
		if(!queue)
		{
			serverQueue.set(message.guild.id, new Queue(message.guild));
			
			queue = serverQueue.get(message.guild.id);
			
			queue.songs.push(song);
			
			play(queue.guild.id, serverQueue, message.member.voice.channel);
		}
		else
		{
			queue.songs.push(song);
		}
		
		message.channel.send(`Ajouté *${song.title}* à la liste !`);
	},
	name: "p",
	description: "Joue une musique donné, à travers une url ou une recherche.",
	help: "<url> | <recherche>",
	args: ["serverQueue"]
}

export const stop: Command = 
{
	run: (client, message, parsedMessage, args: [ServerQueue]) =>
	{
		let serverQueue = args[0];
		
		let queue = serverQueue.get(message.guild.id);
		
		if(queue) queue.disconnect(serverQueue);
		else message.channel.send("Je ne suis pas dans un salon vocal !");
	},
	name: "stop",
	description: "Déconnecte le bot du salon vocal.",
	help: "",
	args: ["serverQueue"]
}

// TODO: Make a working pause command
// export const pause: Command = 
// {
// 	run: (client, message, parsedMessage, args: [ServerQueue]) =>
// 	{
// 		let serverQueue = args[0];

// 		let queue = serverQueue.get(message.guild.id);
		
// 		if(queue) queue.pause();
// 		else message.channel.send("Je ne suis pas dans un salon vocal !");
// 	},
// 	name: "pause",
// 	description: "Met la musique actuelle en pause.",
// 	help: "",
// 	args: ["serverQueue"]
// }

export const volume: Command = 
{
	run: (client, message, parsedMessage, args: [ServerQueue]) =>
	{
		let serverQueue = args[0];

		let queue = serverQueue.get(message.guild.id);
		
		if(queue)
		{
			let _vol = Math.min(parseFloat(parsedMessage[0]), 100);
			
			queue.dispatcher.setVolumeLogarithmic(_vol/100);
			
			message.channel.send(`Volume mis à ${_vol}/100`);
		}
		else message.channel.send("Je ne suis pas dans un salon vocal !");
	},
	name: "volume",
	description: "Change le volume de la musique",
	help: "<volume 0-100>",
	args: ["serverQueue"]
}

export const skip: Command =
{
	run: (client, message, parsedMessage, args: [ServerQueue]) =>
	{
		let serverQueue = args[0];

		let queue = serverQueue.get(message.guild.id);

		if(queue) queue.dispatcher.end();
		else message.channel.send("Je ne suis pas dans un salon vocal !");
	},
	name: "skip",
	description: "Passe la musique vers la suivante",
	help: "",
	args: ["serverQueue"]
}

/** Convert seconds into hours:minutes:seconds string */
function secondsToISO(seconds: number): string
{
	return new Date(seconds * 1000).toISOString().substr(11, 8)
}

export const list: Command = 
{
	run: (client, message, parsedMessage, args: [ServerQueue]) =>
	{
		let serverQueue = args[0];

		let queue = serverQueue.get(message.guild.id);

		if(queue)
		{
			let time = secondsToISO(Math.floor(queue.dispatcher.streamTime/1000));
			
			let embed = new MessageEmbed()
				.setTitle('Listes des musiques')
				.setColor('#2F4F4F')
				.setThumbnail(queue.current.thumbnail)
				.addField(`Joue actuellement : **${queue.current.title}**`, ` \`${time}/${secondsToISO(queue.current.length)}\``);
				
			queue.songs.forEach(s => embed.addField(s.title, `\`${secondsToISO(s.length)}\``));
			
			message.channel.send(embed);
		}
		else message.channel.send("Aucune musique en cours !");
	},
	name: "list",
	description: "Donne la liste des musiques qui vont jouer.",
	help: "",
	args: ["serverQueue"]
}

//#endregion

//#region Bad apple!!

export const badApple: Command = 
{
	run: async (client, message, parsedMessage: string[]) =>
	{
		let frames: string[] = [];
		
		let amount = parseInt(parsedMessage[0]);
		
		let percent = await message.channel.send("0 %");
		
		console.log("Start for loop");
		
		for(let i = 0; i < amount; i++)
		{
			let pixels = fs.readFileSync(__dirname + `/assets/FramesCompressed/out-${i+1}.txt`, "ascii");
			
			let mes = "\`";
			
			let l = pixels.length;
			
			for(let j = 0; j <= l; j++)
			{
				mes += pixels[j] === "0" ? "⬛" : (pixels[j] === "1" ? "⬜" : "🔳");
				
				if(j % 51 == 50) mes += "\n";
				
				// let pixels = line.split("_");
				
				// let value = pixels[0] === "0" ? "⬛" : (pixels[0] === "1" ? "⬜" : "🔳");
				// let amount = parseInt(pixels[1]);
				
				// for(let i = 0; i < amount; i++)
				// {
				// 	mes += value;
					
				// 	if(index % 51 == 50) mes += "\n";
					
				// 	index++;
				// }				
			}
			
			await percent.edit(`${i/amount*100} %`);
			
			frames.push(mes + "\`");
		}

		console.log("End for loop");
		
		await percent.edit("100 %\nReady !\nStarting in 5 seconds...");
		
		await new Promise((resolve) => setTimeout(resolve, 5000));
		
		frames.forEach(
			(frame) =>
			{
				message.channel.send(frame);
			}
		);
	},
	name: "badApple",
	description: "Envoit bad apple",
	help: "<nombre d'images>",
	args: []
}

//#endregion