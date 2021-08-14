import { Client, Message, MessageEmbed, TextChannel, VoiceChannel } from "discord.js";
import * as ytdl from 'ytdl-core';

import {query as q, Collection} from 'faunadb';

import { Command } from './include/command';
import { ServerQueue, Queue, Song } from './include/song';
import { Streamer } from "./include/streamer";

import { config, faunaClient, serverQueue, streamers } from "./main";
import { request, YoutubeSearchResponse, sleep, YoutubePlaylistItemListResponse, TwitchUserResponse, FaunaStreamerDocument } from './api'


export const commands: Command[] = 
[
	
	//#region General
	new Command(
		{
			name: "help",
			description: "Envoie la liste de commandes",
			run: (client, message, parsedMessage) =>
			{
				const embed = new MessageEmbed().setColor("#2F4F4F").setTitle("*Valhyabot 2.0*").setThumbnail(client.user.avatarURL());

				embed.addField(
					"Explications:",
					"Les commandes peuvent avoir un nombre indéterminé d'arguments, représenté par un *<...>*.\n" +
					"Les commandes peuvent avoir plusieurs versions, représentées par plusieurs lignes.\n" +
					"Un # indique que la commande require d'être administrateur pour être exécutée.\n" +
					"Si un argument possède des espaces, ajoutez des guillemets autour de lui !\n" +
					"*!t commande \"Ceci est un seul argument\"*\n" +
					"*!t commande Et ce sont plusieurs arguments*"
				);

				commands.forEach(
					c =>
					{
						let usage = "";

						//Only add a space if <help> is present, otherwise markdown won't work
						c.help.forEach((help) => usage += `*!t ${c.name}${help !== "" ? " " : ""}${help}*\n`);

						//Add a # if the command needs admin rights
						embed.addField(`**${c.admin ? "# " : ""}${c.name}**`, `${c.description}\n${usage}`, false);
					}
				);

				message.channel.send({embeds: [embed]});
			}
		}
	),
	new Command(
		{
			name: "poll",
			description: "Envoie un sondage et y ajoute des réactions",
			help: ["<Question>", "<Question> <Réponse 1> <Réponse 2> <...>"],	
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

				const newMessage = await message.channel.send({ embeds: [embed] });

				if(parsedMessage.length == 0)
				{
					newMessage.react("✅");
					newMessage.react("❌");
				}
				else
				{
					parsedMessage.forEach((s, index) => newMessage.react(regionalIndicators[index]));
				}
			}
		}
	),
	
	//#endregion
	//#region Music
	
	new Command(
		{
			name: "p",
			description: "Ajoute une vidéo à la liste de lecture à travers une url de vidéo ou de playlist, ou une recherche",
			help: ["<Url>", "<Url de playlist> <Nombre d'éléments voulus>", "<Recherche>"],
			run: async (client, message, parsedMessage) =>
			{
				if(!message.member.voice.channel || !message.member.voice.channel.isVoice()) return message.channel.send("Vous devez être dans un salon vocal pour cette commande !");
				
				let userVoiceChannel = message.member.voice.channel as VoiceChannel;
				
				const permissions = userVoiceChannel.permissionsFor(client.user);
				if(!permissions.has('CONNECT') || !permissions.has('SPEAK')) return message.channel.send("Je ne peux pas rejoindre ou parler dans le salon vocal !");
				
				// May return a Promise Rejection 
				try
				{
					if(message.embeds.length > 0)
						message.suppressEmbeds(); //Remove youtube embeds there might be
				}
				catch(err){}
				
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
								title: _songInfo.videoDetails.title,
								url: _songInfo.videoDetails.video_url,
								length: parseFloat(_songInfo.videoDetails.lengthSeconds),
								thumbnail: _songInfo.videoDetails.thumbnails[3].url
							}
						);

						let queue = serverQueue.get(message.guild.id);

						if(!queue)
						{
							queue = new Queue(
								{
									guild: message.guild,
									channel: userVoiceChannel,
									serverQueue: serverQueue
								}
							);
							
							serverQueue.set(message.guild.id, queue);
							
							queue.songs.push(song);
						}
						else
						{
							queue.songs.push(song);
						}

						queue.play();
						
						message.channel.send(`Ajouté *${song.title}* à la liste !`);
					}
				);
			}
		}
	),
	new Command(
		{
			name: "stop",
			description: "Déconnecte le bot du salon vocal et supprime la liste de lecture",
			run: (client, message, parsedMessage) =>
			{
				const queue = serverQueue.get(message.guild.id);

				if(queue) queue.disconnect();
				else message.channel.send("Je ne suis pas dans un salon vocal !");
			}
		}
	),
	new Command(
		{
			name: "volume",
			description: "Change le volume de la musique",
			help: ["<0-100>"],
			run: (client, message, parsedMessage) =>
			{
				const queue = serverQueue.get(message.guild.id);

				if(queue)
				{
					const vol = Math.min(parseFloat(parsedMessage[0]), 100);
					
					queue.setVolume(vol / 100);

					message.channel.send(`Volume mis à ${vol}/100`);
				}
				else message.channel.send("Je ne suis pas dans un salon vocal !");
			}
		}
	),
	// -TODO: Make a working pause command
	new Command(
		{
			name: "pause",
			description: "Met la musique actuelle en pause.",
			run: (client, message, parsedMessage) =>
			{
				let queue = serverQueue.get(message.guild.id);
				
				if(queue) queue.pause();
				else message.channel.send("Je ne suis pas dans un salon vocal !");
			}
		}
	),
	new Command(
		{
			name: "skip",
			description: "Passe la musique actuelle",
			run: (client, message, parsedMessage) =>
			{
				const queue = serverQueue.get(message.guild.id);

				if(queue) queue.skip();
				else message.channel.send("Je ne suis pas dans un salon vocal !");
			}
		}
	),
	new Command(
		{
			name: "list",
			description: "Affiche la liste de lecture",
			run: (client, message, parsedMessage) =>
			{
				const queue = serverQueue.get(message.guild.id);

				if(queue)
				{
					// const time = secondsToISO(Math.floor(queue.connection. / 1000));
					const time = "00:00:00";

					const embed = new MessageEmbed()
						.setTitle('Listes des musiques')
						.setColor('#2F4F4F')
						.setThumbnail(queue.current.thumbnail)
						.addField(`Joue actuellement : **${queue.current.title}**`, ` \`${time}/${secondsToISO(queue.current.length)}\``);

					queue.songs.forEach(s => embed.addField(s.title, `\`${secondsToISO(s.length)}\``));

					message.channel.send({embeds: [embed]});
				}
				else message.channel.send("Aucune musique en cours !");
			}
		}
	),
	//#endregion
	//#region Twitch
	new Command(
		{
			name: "addStreamer",
			description: "Envoie une notification dans ce salon lorsque le streamer part en live",
			admin: true,
			help: ["<Nom du streamer>"],
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

				if(query.data.length == 0) return message.channel.send(`${parsedMessage[0]} n'existe pas !`);

				let streamer = query.data[0];

				if(!streamers.has(streamer.login))
				{
					let newStreamer = new Streamer(
						{
							channels: message.channel as TextChannel,
							id: streamer.id,
							name: streamer.login,
							displayName: streamer.display_name
						}
					);

					streamers.set(streamer.login, newStreamer);

					//Subscribe to twitch API
					newStreamer.subscribe(true);

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
									displayName: streamer.display_name,
									date: newStreamer.date
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
			}
		}
	),
	new Command(
		{
			name: "deleteStreamer",
			description: "Supprime le ou les streamers des notifications de ce serveur",
			admin: true,
			help: ["<Nom1> <Nom2> <...>"],
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


							if(channels.size == 0) //If streamer is no longer anywhere, unsubscribe from webhook and remove document
							{
								streamer.subscribe(false);

								faunaClient.query(
									q.Delete(q.Select('ref', oldDocument))
								);
							}
							else //Else, update fauna doccument
							{
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
							}
						}
					}
				);
			}
		}
	),
	new Command(
		{
			name: "listStreamer",
			description: "Liste tous les streamers initialisés dans de ce serveur",
			run: (client, message, parsedMessage) =>
			{
				const embed = new MessageEmbed().setTitle('Listes des streamers').setColor('#2F4F4F');
				
				streamers.forEach(
					(streamer) =>
					{
						//Find if a channel in this server has the streamer
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

				message.channel.send({ embeds: [embed]});
			}
		}
	)
];

//#region Utility

/** Convert seconds into hours:minutes:seconds string */
function secondsToISO(seconds: number): string
{
	return new Date(seconds * 1000).toISOString().substr(11, 8);
}

//#endregion