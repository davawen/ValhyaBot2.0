import { Client, Message, MessageEmbed, TextChannel, VoiceChannel } from "discord.js";
import * as ytdl from 'ytdl-core';

import {query as q, Collection} from 'faunadb';

import { Command } from './include/command';
import { ServerQueue, Queue, Song } from './include/song';
import { Streamer } from "./include/streamer";

import { config, commands, faunaClient, serverQueue, streamers } from "./main";
import { request, YoutubeSearchResponse, sleep, YoutubePlaylistItemListResponse, TwitchUserResponse, FaunaStreamerDocument } from './api'

//#region General
export const help = new Command(
	{
		run: (client, message, parsedMessage) =>
		{
			const embed = new MessageEmbed().setColor("#2F4F4F").setTitle("*Valhyabot 2.0*").setThumbnail(client.user.avatarURL());
			
			embed.addField(
				"Explications:",
				"Les commandes peuvent avoir un nombre indéterminé d'arguments, représenté par un *<...>*.\n"+
				"Les commandes peuvent avoir plusieurs versions, représentées par plusieurs lignes.\n"+
				"Un # indique que la commande require d'être administrateur pour être exécutée.\n"+
				"Si un argument possède des espaces, ajoutez des guillemets autour de lui !\n"+
				"*!t commande \"Ceci est un seul argument\"*\n"+
				"*!t commande Et ce sont plusieurs arguments*"
			);
			
			commands.forEach(
				c =>
				{
					let usage = "";
					
					//Only add a space if <help> is present, otherwise markdown won't work
					c.help.forEach((help) => usage += `*!t ${c.name}${help !== "" ? " ": ""}${help}*\n`);
					
					//Add a # if the command needs admin rights
					embed.addField(`**${c.admin ? "# " : ""}${c.name}**`, `${c.description}\n${usage}`, false);
				}
			);
			
			message.channel.send(embed);
		},
		name: "help",
		description: "Envoie la liste de commandes"
	}
);

export const poll = new Command(
	{
		run: async (client, message, parsedMessage) =>
		{
			const regionalIndicators = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲", "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿"];
			
			const embed = new MessageEmbed().setColor("#2F4F4F")
											.setTitle(parsedMessage.shift());
														
			
			parsedMessage.forEach(
				(s, index) =>
				{
					embed.addField(s, regionalIndicators[index]);
				}
			);
			
			const newMessage = await message.channel.send(embed);
			
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
		description: "Envoie un sondage et y ajoute des réactions",
		help: ["<Question>", "<Question> <Réponse 1> <Réponse 2> <...>" ]
	}
);
//#endregion

//#region Music

// TODO : set volume, skip 

async function play(id: string, serverQueue: ServerQueue, channel?: VoiceChannel)
{
	const queue = serverQueue.get(id);
	
	if(channel)
	{
		queue.voiceChannel = channel;
		queue.connection = await channel.join();
	}
	
	if(!queue.voiceChannel || !queue.connection) return;
	
	if(queue.songs.length <= 0)
	{
		//Wait a minute before disconnecting, in case client wants to add another music
		
		setTimeout(
			() =>
			{
				if(queue.songs.length <= 0) queue.disconnect(serverQueue);
			}
		, 60000);
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

export const p = new Command(
	{
		run: async (client, message, parsedMessage) =>
		{
			if(!message.member.voice.channel) return message.channel.send("Vous devez être dans un salon vocal pour cette commande !");
			
			const permissions = message.member.voice.channel.permissionsFor(client.user);
			if(!permissions.has('CONNECT') || !permissions.has('SPEAK')) return message.channel.send("Je ne peux pas rejoindre ou parler dans le salon vocal !");
		
			
			message.suppressEmbeds(); //Remove youtube embeds there might be
			
			let videoUrl = parsedMessage[0];
			
			let urls = []; //Add support for playlists
			
			if(!ytdl.validateURL(videoUrl))
			{
				videoUrl = parsedMessage.join(" ");
				
				let video = await request<YoutubeSearchResponse>(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(videoUrl)}&key=${config.GOOGLE_ID}`);
				
				if(video.items.length == 0) return message.channel.send(`Je n'ai pas pu trouver une vidéo avec ce titre !`);
				
				urls[0] = video.items[0].id.videoId;
			}
			else if(/(&list=)/.test(videoUrl)) //Check if the url is a playlist
			{
				//Google only accepts the playlist id with nothing else, so we extract it
				let playlistId = videoUrl.split("?")[1].split("&list=")[1].split("&")[0];
				
				//Request list of videos
				let videos = await request<YoutubePlaylistItemListResponse>(
					`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails%2Cid&maxResults=${parseInt(parsedMessage[1])}&playlistId=${playlistId}&key=${config.GOOGLE_ID}`
				);
				
				videos.items.forEach(
					(item) =>
					{
						urls.push(item.contentDetails.videoId);
					}
				);
			}
			else
			{
				urls[0] = videoUrl;
			}
			
			urls.forEach(
				async (url) =>
				{
					let _songInfo = await ytdl.getInfo(url);

					let song = new Song(
						{
							title    : _songInfo.videoDetails.title,
							url      : _songInfo.videoDetails.video_url,
							length   : parseFloat(_songInfo.videoDetails.lengthSeconds),
							thumbnail: _songInfo.videoDetails.thumbnails[3].url
						}
					);
					
					let queue = serverQueue.get(message.guild.id);
					
					if(!queue)
					{
						serverQueue.set(message.guild.id, new Queue(message.guild));
						
						queue = serverQueue.get(message.guild.id);
						
						queue.songs.push(song);
					}
					else
					{
						queue.songs.push(song);
					}
					
					if(!queue.connection)
					{
						play(queue.guild.id, serverQueue, message.member.voice.channel);
					}
					
					message.channel.send(`Ajouté *${song.title}* à la liste !`);
				}
			);
			
		},
		name: "p",
		description: "Ajoute une vidéo à la liste de lecture à travers une url de vidéo ou de playlist, ou une recherche",
		help: ["<Url>", "<Url de playlist> <Nombre d'éléments voulus>", "<Recherche>"]
	}
);

export const stop = new Command(
	{
		run: (client, message, parsedMessage) =>
		{
			const queue = serverQueue.get(message.guild.id);
			
			if(queue) queue.disconnect(serverQueue);
			else message.channel.send("Je ne suis pas dans un salon vocal !");
		},
		name: "stop",
		description: "Déconnecte le bot du salon vocal et supprime la liste de lecture"
	}
);

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

export const volume = new Command(
	{
		run: (client, message, parsedMessage) =>
		{
			const queue = serverQueue.get(message.guild.id);
			
			if(queue)
			{
				const vol = Math.min(parseFloat(parsedMessage[0]), 100);
				
				queue.dispatcher.setVolumeLogarithmic(vol/100);
				
				message.channel.send(`Volume mis à ${vol}/100`);
			}
			else message.channel.send("Je ne suis pas dans un salon vocal !");
		},
		name: "volume",
		description: "Change le volume de la musique",
		help: ["<0-100>"]
	}
);

export const skip = new Command(
	{
		run: (client, message, parsedMessage) =>
		{
			const queue = serverQueue.get(message.guild.id);

			if(queue) queue.dispatcher.end();
			else message.channel.send("Je ne suis pas dans un salon vocal !");
		},
		name: "skip",
		description: "Passe la musique actuelle"
	}
);

/** Convert seconds into hours:minutes:seconds string */
function secondsToISO(seconds: number): string
{
	return new Date(seconds * 1000).toISOString().substr(11, 8);
}

export const list = new Command(
	{
		run: (client, message, parsedMessage) =>
		{
			const queue = serverQueue.get(message.guild.id);
			
			if(queue)
			{
				const time = secondsToISO(Math.floor(queue.dispatcher.streamTime/1000));
				
				const embed = new MessageEmbed()
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
		description: "Affiche la liste de lecture"
	}
);

//#endregion

//#region Twitch

export const addStreamer = new Command(
	{
		run: async (client, message, parsedMessage) =>
		{
			if(message.channel == undefined) return; //¯\_(ツ)_/¯ Something to do with recently created channels
			
			const query = await request<TwitchUserResponse>(
				{
					hostname: "api.twitch.tv",
					path: encodeURI(`/helix/users?login=${parsedMessage[0]}`),
					headers: 
					{
						"client-id": config.TWITCH_ID,
						Authorization: `Bearer ${config.TWITCH_OAUTH}`
					}
				}
			);
			
			if(query.data.length == 0) return message.channel.send(`${parsedMessage[0]} n'existe pas !`)
			
			let streamer = query.data[0];
			
			if(!streamers.has(streamer.login))
			{
				streamers.set(streamer.login, new Streamer(
					{
						channels: message.channel as TextChannel,
						id: streamer.id,
						name: streamer.login,
						displayName: streamer.display_name
					}
				));
				
				//Subscribe to twitch API
				request(
					{
						hostname: "api.twitch.tv",
						path: encodeURI(
							'/helix/webhooks/hub' +
							'?hub.callback=https://valhyabot-2.herokuapp.com/twitch' +
							'&hub.mode=subscribe' +
							`&hub.topic=https://api.twitch.tv/helix/streams?user_id=${streamer.id}` +
							'&hub.lease_seconds=864000'
						),
						headers:
						{
							"client-id": config.TWITCH_ID,
							Authorization: `Bearer ${config.TWITCH_OAUTH}`,
							'Content-Type': 'application/x-www-form-urlencoded'
						},
						method: "POST"
					}
				);
				
				//Create FaunaDB document
				faunaClient.query(
					q.Create(
						Collection('streamers'),
						{
							data: 
							{
								channels: [message.channel.id],
								id: streamer.id,
								name: streamer.login,
								displayName: streamer.display_name
							}
						}
					)
				);
			}
			else
			{
				//Append new channel to the set
				streamers.get(streamer.login).channels.add(message.channel as TextChannel);
				
				//Append new channel to FaunaDB document
				const oldDocument: FaunaStreamerDocument = await faunaClient.query(q.Get(q.Match(q.Index('streamersById'), streamer.id)));
				
				faunaClient.query(
					q.Update(
						q.Select('ref', oldDocument),
						{
							data:
							{
								channels: [...oldDocument.data.channels, streamer.id]
							}
						}
					)
				);
			}
			
			message.channel.send(`Le streamer ${streamer.display_name} à été ajouté à la liste`);
		},
		name: "addStreamer",
		description: "Ajoute un streamer à la liste de vérification dans ce salon",
		admin: true,
		help: ["<Nom du streamer>"]
	}
);

export const deleteStreamer = new Command(
	{
		run: (client, message, parsedMessage) =>
		{
			parsedMessage.forEach(
				async streamerName =>
				{
					if(streamers.has(streamerName))
					{
						const streamer = streamers.get(streamerName);
						const channels = streamer.channels;
						
						//Have to use this to avoid skipping channels and to make only one call to faunadb
						const channelsToRemove = Array.from(channels).filter(channel => channel.guild.id === message.guild.id);
						
						const oldDocument: FaunaStreamerDocument = await faunaClient.query(q.Get(q.Match(q.Index('streamersById'), streamer.id)));
						
						channelsToRemove.forEach(
							channelToRemove =>
							{
								channels.delete(channelToRemove);
								
								oldDocument.data.channels.splice(oldDocument.data.channels.indexOf(channelToRemove.id), 1);
								
								message.channel.send(`Supprimé ${streamerName} du salon ${channelToRemove.name} !`);
							}
						);
						
						faunaClient.query(
							q.Update(
								q.Select('ref', oldDocument),
								{
									data:
									{
										channels: oldDocument.data.channels
									}
								}
							)
						);
						
						if(channels.size == 0) //If streamer is no longer subscribed anywhere, unsubscribe from webhook and remove document
						{
							request(
								{
									hostname: "api.twitch.tv",
									path: encodeURI(
										'/helix/webhooks/hub' +
										'?hub.callback=https://valhyabot-2.herokuapp.com/twitch' +
										'&hub.mode=unsubscribe' +
										`&hub.topic=https://api.twitch.tv/helix/streams?user_id=${streamer.id}` +
										'&hub.lease_seconds=864000'
									),
									headers:
									{
										"client-id": config.TWITCH_ID,
										Authorization: `Bearer ${config.TWITCH_OAUTH}`,
										'Content-Type': 'application/x-www-form-urlencoded'
									},
									method: "POST"
								}
							);
							
							faunaClient.query(
								q.Delete( q.Select('ref', oldDocument) )
							);
						}
					}
				}
			);
		},
		name: "deleteStreamer",
		description: "Supprime le ou les streamers dans la liste de vérification de ce serveur",
		admin: true,
		help: ["<Nom1> <Nom2> <...>"]
	}
);

export const listStreamer = new Command(
	{
		run: (client, message, parsedMessage) =>
		{
			const embed = new MessageEmbed().setTitle('Listes des streamers').setColor('#2F4F4F');
			
			streamers.forEach(
				(streamer) =>
				{
					//Find if a channel in this server has the streamer
					console.log(streamer)
					
					const channels = Array.from(streamer.channels.values()).filter((channel) => channel.guild.id === message.guild.id);
					
					if(channels.length > 0)
					{
						let string = "";
						
						channels.forEach(c => string += `**# ${c.name}**, `);
						
						embed.addField(streamer.name, string.slice(0, string.length - 2), true);
					}
				}
			);
			
			if(embed.fields.length == 0)
			{
				return message.channel.send(`Aucun streamer n'est vérifié dans ce serveur!`);
			}
			
			message.channel.send(embed);
		},
		name: "listStreamer",
		description: "Liste tous les streamers dans la liste de vérification de ce serveur"
	}
);

//#endregion