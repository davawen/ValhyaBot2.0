import { v4 as uuidv4 } from "uuid";
import { Channel, Guild, VoiceChannel } from "discord.js";
import { createAudioPlayer, AudioPlayer, VoiceConnection, joinVoiceChannel, createAudioResource, AudioPlayerStatus, AudioResource, VoiceConnectionStatus } from "@discordjs/voice"
import { Server } from "http";
import ytdl from "ytdl-core";

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
		this.thumbnail = options.thumbnail ?? "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/White_Square.svg/1200px-White_Square.svg.png";
	}
}

// TODO: Find a better name for this
export type ServerQueue = Map<string, Queue>;

interface QueueConstructorOptions
{
	guild: Guild,
	channel: Channel,
	/** Internal pointer to parent */
	serverQueue: ServerQueue
}

export class Queue
{
	/** The server of the queue */
	guild: Guild;
	serverQueue: ServerQueue;
	
	songs: Song[];
	volume: number;
	paused: boolean;
	playing: boolean;
	
	current?: Song;
	currentRessource?: AudioResource;

	connection: VoiceConnection;
	audioPlayer: AudioPlayer;
	
	constructor(options: QueueConstructorOptions)
	{
		this.guild = options.guild;
		this.serverQueue = options.serverQueue;
		
		this.songs = [];
		this.volume = 1;
		this.paused = false;
		this.playing = false;

		this.current = null;
		this.currentRessource = null;
		
		// Init connection and audio player
		
		this.connection = joinVoiceChannel(
			{
				channelId: options.channel.id,
				guildId: this.guild.id,
				adapterCreator: this.guild.voiceAdapterCreator
			}
		);
		
		this.connection.on(VoiceConnectionStatus.Ready, 
			() =>
			{
				this.play();
			}
		);
		
		setInterval(() => { console.log(this.connection.state.status) }, 1000);
		
		this.audioPlayer = createAudioPlayer();

		// Define state machine for audio player
		this.audioPlayer.on(AudioPlayerStatus.Idle,
			(oldState) =>
			{
				if(oldState.status == AudioPlayerStatus.Playing) // Finished playing a song
				{
					this.playing = false;
					
					this.current = null;
					this.currentRessource = null;
					
					this.play();
				}
			}
		);
		
		this.audioPlayer.on(AudioPlayerStatus.Playing,
			() =>
			{
				console.log("Started playing!");
			}
		);
	}
	
	disconnect()
	{
		this.connection.destroy();
		
		this.audioPlayer.stop();
		
		this.serverQueue.delete(this.guild.id);
	}
	
	play()
	{
		// if(this.connection === null) return; This shouldn't EVER happen or something has gone seriously wrong

		if(this.songs.length <= 0)
		{
			//Wait a minute before disconnecting, in case client wants to add another music
			setTimeout(
				() =>
				{
					if(this.songs.length <= 0) this.disconnect();
				}
				, 60000);
			return;
		}
		
		this.playing = true;
		
		this.current = this.songs.shift();
		this.currentRessource = createAudioResource(ytdl(this.current.url),
			{
				inlineVolume: true
			}
		);
		
		this.currentRessource.volume.setVolumeLogarithmic(this.volume);
		
		this.audioPlayer.play(this.currentRessource);
		
		this.connection.subscribe(this.audioPlayer);
	}
		
	pause()
	{
		// if(!this.dispatcher) return;
		
		if(!this.paused) this.audioPlayer.pause();
		else this.audioPlayer.unpause();
		
		this.paused = !this.paused;
	}
	
	setVolume(value: number)
	{
		if(this.playing) this.currentRessource.volume.setVolumeLogarithmic(this.volume);
		
		this.volume = value;
	}
	
	skip()
	{
		
	}
	
	clear()
	{
		
	}
}