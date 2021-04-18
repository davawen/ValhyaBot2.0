import { Client, Message, TextChannel } from 'discord.js'

import { config } from '../main';
import { request, sleep, TwitchChannelResponse } from '../api';

interface StreamerConstructorOptions
{
	name: string;
	displayName: string;
	id: string;
	channels: TextChannel | TextChannel[];
}

export class Streamer
{
	private _name: string;
	private _displayName: string;
	private _id: string;
	
	channels: Set<TextChannel>;
	
	constructor(options: StreamerConstructorOptions)
	{
		this._name = options.name;
		this._displayName = options.displayName;
		this._id = options.id;
		
		if(Array.isArray(options.channels))
		{
			this.channels = new Set(options.channels);
		}
		else
		{
			this.channels = new Set([options.channels]);
		}
	}
	
	get name() { return this._name; };
	get displayName() { return this._displayName; };
	get id() { return this._id; };
}