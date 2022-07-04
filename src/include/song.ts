import { Channel, Guild } from "discord.js";
import {
	createAudioPlayer,
	AudioPlayer,
	VoiceConnection,
	joinVoiceChannel,
	createAudioResource,
	AudioPlayerStatus,
	AudioResource,
	VoiceConnectionStatus
} from "@discordjs/voice";
import { stream } from "play-dl";

interface SongConstructorOptions {
	title: string;
	url: string;
	length: number;
	thumbnail?: string;
}

export class Song {
	title: string;
	url: string;
	/** Length in seconds */
	length: number;
	thumbnail: string;

	constructor(options: SongConstructorOptions) {
		this.title = options.title;
		this.url = options.url;
		this.length = options.length;
		this.thumbnail =
			options.thumbnail ??
			"https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/White_Square.svg/1200px-White_Square.svg.png";
	}
}

// TODO: Find a better name for this
export type ServerQueue = Map<string, Queue>;

interface QueueConstructorOptions {
	guild: Guild;
	channel: Channel;
	/** Internal pointer to parent */
	serverQueue: ServerQueue;
}

export class Queue {
	/** The server of the queue */
	guild: Guild;
	serverQueue: ServerQueue;

	/// List of songs to be played
	songs: Song[];
	paused: boolean;
	/// Wether the queue is currently playing a song
	playing: boolean;

	current?: Song;
	/// Data stream of the currently playing song
	currentRessource?: AudioResource;

	connection: VoiceConnection;
	audioPlayer: AudioPlayer;

	constructor(options: QueueConstructorOptions) {
		this.guild = options.guild;
		this.serverQueue = options.serverQueue;

		this.songs = [];
		// this.volume = 1;
		this.paused = false;
		this.playing = false;

		this.current = undefined;
		this.currentRessource = undefined;

		this.connection = joinVoiceChannel({
			channelId: options.channel.id,
			guildId: this.guild.id,
			adapterCreator: this.guild.voiceAdapterCreator as any // TODO: Not quiet sure what's the error here?? Need to check later
		});

		// Init connection and audio player
		this.audioPlayer = createAudioPlayer();

		// Define state machine for audio player
		this.audioPlayer.on(AudioPlayerStatus.Idle, oldState => {
			if (oldState.status == AudioPlayerStatus.Playing) {
				// Finished playing a song
				this.playing = false;

				this.current = undefined;
				this.currentRessource = undefined;

				this.play();
			}
		});

		this.audioPlayer.on("error", e => {
			console.error(e);

			if (
				this.connection.state.status ===
				VoiceConnectionStatus.Disconnected
			) {
				this.connection.rejoin();
			}

			if (
				this.currentRessource !== undefined &&
				!this.currentRessource.ended
			) {
				this.audioPlayer.play(this.currentRessource);
			}
		});

		// this.audioPlayer.on(AudioPlayerStatus.Playing,
		// 	() =>
		// 	{
		// 		console.log("Started playing!");
		// 	}
		// );

		this.connection.subscribe(this.audioPlayer);
	}

	disconnect() {
		this.connection.destroy();

		this.audioPlayer.stop();

		this.serverQueue.delete(this.guild.id);
	}

	/**
	 * Plays the first song present in queue, or sets a callback to leave voice connection after a minute if no music is present in queue
	 */
	async play() {
		if (this.songs.length <= 0) {
			//Wait a minute before disconnecting, in case client wants to add another music
			setTimeout(() => {
				if (!this.playing) this.disconnect();
			}, 60000);
			return;
		}

		this.playing = true;

		this.current = this.songs.shift()!;

		let source = await stream(this.current.url);
		this.currentRessource = createAudioResource(source.stream, {
			inputType: source.type
		});

		// this.currentRessource.volume.setVolumeLogarithmic(this.volume);
		while (this.connection.state.status !== VoiceConnectionStatus.Ready) {} // Wait for voice connection

		this.audioPlayer.play(this.currentRessource); // Catching error in constructor, asynchronous call
	}

	pause() {
		// if(!this.dispatcher) return;

		if (!this.paused) this.audioPlayer.pause();
		else this.audioPlayer.unpause();

		this.paused = !this.paused;
	}

	// setVolume(value: number)
	// {
	// 	if(this.playing) this.currentRessource.volume.setVolumeLogarithmic(this.volume);

	// 	this.volume = value;
	// }

	skip() {
		this.audioPlayer.stop();
	}

	clear() {
		this.songs = [];
		this.audioPlayer.stop();
	}
}
