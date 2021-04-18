
interface SongConstructorOptions
{
	title: string,
	url: string,
	length: number,
	thumbnail?: string;
}

export class Song
{
	title: string;
	url: string;
	/** Length in seconds */
	length: number;
	thumbnail: string;

	constructor(options: SongConstructorOptions)
	{
		this.title     = options.title;
		this.url       = options.url;
		this.length    = options.length;
		this.thumbnail = options.thumbnail || "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/White_Square.svg/1200px-White_Square.svg.png";
	}
}

import { Guild, VoiceChannel, VoiceConnection, StreamDispatcher } from "discord.js";

export type ServerQueue = Map<string, Queue>;

export class Queue
{
	/** The server of the queue */
	guild: Guild;

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