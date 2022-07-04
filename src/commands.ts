import { MessageEmbed, VoiceChannel } from "discord.js";
import { URL } from "url";
import * as play from "play-dl";

import { Command } from "./include/command";
import { Queue, Song } from "./include/song";

import { config } from "./include/config";
import { serverQueue } from "./main";
import { YoutubeSearchResponse, YoutubePlaylistItemListResponse } from "./api";

export const commands: Command[] = [
	//#region General
	new Command({
		name: "help",
		description: "Envoie la liste de commandes",
		run: (client, message, _parsedMessage) => {
			const embed = new MessageEmbed()
				.setColor("#2F4F4F")
				.setTitle("*Valhyabot 2.0*")
				.setThumbnail(`${client.user?.avatarURL()}`);

			embed.addField(
				"Explications:",
				"Les commandes peuvent avoir un nombre indéterminé d'arguments, représenté par un *<...>*.\n" +
					"Les commandes peuvent avoir plusieurs versions, représentées par plusieurs lignes.\n" +
					"Un # indique que la commande require d'être administrateur pour être exécutée.\n" +
					"Si un argument possède des espaces, ajoutez des guillemets autour de lui !\n" +
					'*!t commande "Ceci est un seul argument"*\n' +
					"*!t commande Et ce sont plusieurs arguments*"
			);

			commands.forEach(c => {
				let usage = "";

				//Only add a space if <help> is present, otherwise markdown won't work
				c.help.forEach(
					help =>
						(usage += `*!t ${c.name}${
							help !== "" ? " " : ""
						}${help}*\n`)
				);

				//Add a # if the command needs admin rights
				embed.addField(
					`**${c.admin ? "# " : ""}${c.name}**`,
					`${c.description}\n${usage}`,
					false
				);
			});

			message.channel.send({ embeds: [embed] });
		}
	}),
	new Command({
		name: "poll",
		description: "Envoie un sondage et y ajoute des réactions",
		help: ["<Question>", "<Question> <Réponse 1> <Réponse 2> <...>"],
		run: async (_client, message, parsedMessage) => {
			if (parsedMessage.length == 0)
				return message.channel.send("Aucune question donnée.");

			const regionalIndicators = [
				"🇦",
				"🇧",
				"🇨",
				"🇩",
				"🇪",
				"🇫",
				"🇬",
				"🇭",
				"🇮",
				"🇯",
				"🇰",
				"🇱",
				"🇲",
				"🇳",
				"🇴",
				"🇵",
				"🇶",
				"🇷",
				"🇸",
				"🇹",
				"🇺",
				"🇻",
				"🇼",
				"🇽",
				"🇾",
				"🇿"
			];

			const embed = new MessageEmbed()
				.setColor("#2F4F4F")
				.setTitle(parsedMessage.shift() as string);

			parsedMessage.forEach((s, index) => {
				embed.addField(s, regionalIndicators[index]);
			});

			const newMessage = await message.channel.send({ embeds: [embed] });

			if (parsedMessage.length == 0) {
				newMessage.react("✅");
				newMessage.react("❌");
			} else {
				parsedMessage.forEach((_s, index) =>
					newMessage.react(regionalIndicators[index])
				);
			}
		}
	}),

	//#endregion
	//#region Music

	new Command({
		name: "p",
		description:
			"Ajoute une vidéo à la liste de lecture à travers une url de vidéo ou de playlist, ou une recherche",
		help: [
			"<Url>",
			"<Url de playlist> <Nombre d'éléments voulus>",
			"<Recherche>"
		],
		run: async (client, message, parsedMessage) => {
			if (
				!message.member?.voice.channel ||
				!message.member.voice.channel.isVoice()
			)
				return message.channel.send(
					"Vous devez être dans un salon vocal pour cette commande !"
				);
			if (message.guild === null) return; // Private message

			let userVoiceChannel = message.member.voice.channel as VoiceChannel;

			const permissions = userVoiceChannel.permissionsFor(client.user!);
			if (
				permissions === null ||
				!permissions.has("CONNECT") ||
				!permissions.has("SPEAK")
			)
				return message.channel.send(
					"Je ne peux pas rejoindre ou parler dans le salon vocal !"
				);

			// May return a Promise Rejection
			try {
				if (message.embeds.length > 0) message.suppressEmbeds(); //Remove youtube embeds there might be
			} catch (err) {}

			let urls: string[] = []; //Add support for playlists

			// If not a valid youtube URL, treat it as a search
			const validated = play.yt_validate(parsedMessage[0]);
			if (parsedMessage[0].startsWith("https") && validated === "video") {
				urls.push(parsedMessage[0]);
			} else if (validated === "search") {
				const videoQuery = parsedMessage.join(" ");

				try {
					const video: YoutubeSearchResponse = await fetch(
						`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(
							videoQuery
						)}&key=${config.GOOGLE_ID}`
					).then(res => res.json());

					if (video.items.length == 0)
						return message.channel.send(
							`Je n'ai pas pu trouver une vidéo avec ce titre !`
						);

					urls.push(video.items[0].id.videoId);
				} catch (err) {
					console.error("youtube search query failed with: " + err);
					return message.channel.send(
						"Une erreur est arrivée pendant la recherche."
					);
				}
			} else if (validated === "playlist") {
				const videoUrl = new URL(parsedMessage[0]);
				try {
					// Google only needs the playlist id
					let playlistId = videoUrl.searchParams.get("list");

					//Request list of videos
					let videos: YoutubePlaylistItemListResponse = await fetch(
						`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails%2Cid&maxResults=${parseInt(
							parsedMessage[1]
						)}&playlistId=${playlistId}&key=${config.GOOGLE_ID}`
					).then(res => res.json());

					videos.items.forEach(item =>
						urls.push(item.contentDetails.videoId)
					);
				} catch (err) {
					console.error("youtube playlist query failed with: " + err);
					return message.channel.send(
						"Une erreur est arrivée pendant la demande de playlist"
					);
				}
			}

			let queue = serverQueue.get(message.guild.id);
			if (!queue) {
				queue = new Queue({
					guild: message.guild,
					channel: userVoiceChannel,
					serverQueue: serverQueue
				});

				serverQueue.set(message.guild.id, queue);
			}

			// For..of loop for 'synchronous' async execution
			for (const url of urls) {
				try {
					const songInfo = await play.video_info(url);

					const song = new Song({
						title: songInfo.video_details.title ?? "undefined",
						url: songInfo.video_details.url,
						length: songInfo.video_details.durationInSec,
						thumbnail: songInfo.video_details.thumbnails[3].url
					});

					queue.songs.push(song);

					message.channel.send(`Ajouté *${song.title}* à la liste !`);
				} catch (err) {
					console.error(`adding song to queue failed with: ${err}`);
					message.channel.send(
						`Une erreur est arrivée pendant l'ajout d'une musique à la liste de lecture.`
					);
				}
			}

			// Jump start queue
			if (!queue.playing) queue.play();
		}
	}),
	new Command({
		name: "stop",
		description:
			"Déconnecte le bot du salon vocal et supprime la liste de lecture",
		run: (_client, message, _parsedMessage) => {
			if (message.guild === null) return;
			const queue = serverQueue.get(message.guild.id);

			if (queue) queue.disconnect();
			else message.channel.send("Je ne suis pas dans un salon vocal !");
		}
	}),
	// new Command(
	// 	{
	// 		name: "volume",
	// 		description: "Change le volume de la musique",
	// 		help: ["<0-100>"],
	// 		run: (client, message, parsedMessage) =>
	// 		{
	// 			const queue = serverQueue.get(message.guild.id);

	// 			if(queue)
	// 			{
	// 				const vol = Math.min(parseFloat(parsedMessage[0]), 100);

	// 				queue.setVolume(vol / 100);

	// 				message.channel.send(`Volume mis à ${vol}/100`);
	// 			}
	// 			else message.channel.send("Je ne suis pas dans un salon vocal !");
	// 		}
	// 	}
	// ),
	new Command({
		name: "pause",
		description: "Met la musique actuelle en pause.",
		run: (_client, message, _parsedMessage) => {
			if (message.guild === null) return;
			const queue = serverQueue.get(message.guild.id);

			if (queue) queue.pause();
			else message.channel.send("Je ne suis pas dans un salon vocal !");
		}
	}),
	new Command({
		name: "skip",
		description: "Passe la musique actuelle",
		run: (_client, message, _parsedMessage) => {
			if (message.guild === null) return;
			const queue = serverQueue.get(message.guild.id);

			if (queue) queue.skip();
			else message.channel.send("Je ne suis pas dans un salon vocal !");
		}
	}),
	new Command({
		name: "list",
		description: "Affiche la liste de lecture",
		run: (_client, message, _parsedMessage) => {
			if (message.guild === null) return;
			const queue = serverQueue.get(message.guild.id);

			if (queue !== undefined && queue.playing) {
				const time = secondsToISO(
					Math.floor(queue.currentRessource!.playbackDuration / 1000)
				);

				const embed = new MessageEmbed()
					.setTitle("Listes des musiques")
					.setColor("#2F4F4F")
					.setThumbnail(queue.current!.thumbnail)
					.addField(
						`Joue actuellement : **${queue.current!.title}**`,
						` \`${time}/${secondsToISO(queue.current!.length)}\``
					);

				queue.songs.forEach(s =>
					embed.addField(s.title, `\`${secondsToISO(s.length)}\``)
				);

				message.channel.send({ embeds: [embed] });
			} else message.channel.send("Aucune musique en cours !");
		}
	})
	//#endregion
];

//#region Utility

/** Convert seconds into hours:minutes:seconds string */
function secondsToISO(seconds: number): string {
	return new Date(seconds * 1000).toISOString().substring(11, 11 + 8);
}

//#endregion
