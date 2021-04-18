import { Client, Message, TextChannel } from 'discord.js'

import { config } from '../main';
import { request, sleep, TwitchChannelResponse } from '../api';

interface StreamerConstructorOptions
{
	name: string;
	displayName: string;
	id: string;
	channel: TextChannel;
}

export class Streamer
{
	private _name: string;
	private _displayName: string;
	private _id: string;
	
	channels: Set<TextChannel>;
	is_live: boolean;
	
	constructor(options: StreamerConstructorOptions)
	{
		this._name = options.name;
		this._displayName = options.displayName;
		this._id = options.id;
		this.channels = new Set([options.channel]);
		
		this.is_live = false; //Don't send a message everytime the bot starts up
	}
	
	get name() { return this._name; };
	get displayName() { return this._displayName; };
	get id() { return this._id; };
}

export async function pingStreamers(client: Client, streamers: Map<string, Streamer>)
{
	while(true) //Run continuously
	{
		streamers.forEach(
			async (streamer) =>
			{
				try
				{
					let query = await request<TwitchChannelResponse>(
						{
							hostname: "api.twitch.tv",
							path: encodeURI(`/helix/channels?broadcaster_id=${streamer.id}`),
							headers:
							{
								"client-id": config.TWITCH_ID,
								Authorization: `Bearer ${config.TWITCH_OAUTH}`
							}
						}
					);
					console.log(query);
					
					let streamerFromQuery = query.data[0];
					
					if(!streamer.is_live && streamerFromQuery.game_id !== '0')
					{
						streamer.channels.forEach(
							channel =>
							{
								channel.send("@everyone" + ` ${streamer.displayName} est en ligne !\nhttps://www.twitch.tv/${streamer.name}`);
							}
						);
						
						streamer.is_live = true;
					}
					else if(streamer.is_live && streamerFromQuery.game_id === '0')
					{
						let date = new Date();
						
						streamer.channels.forEach(
							channel =>
							{
								channel.send(`${streamer.displayName} a finit son live à ${date.getHours()}:${date.getMinutes()}.`);
							}
						);
						
						streamer.is_live = false;
					}
				}
				catch(err)
				{
					console.log(`Error while pinging streamer ${streamer.name},\n${err}`);
				}
			}
		);
		
		await sleep(10000); //Ping twitch every 60 seconds (can't get webhooks to work)
	}
}