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
	
	constructor(options: StreamerConstructorOptions)
	{
		this._name = options.name;
		this._displayName = options.displayName;
		this._id = options.id;
		this.channels = new Set([options.channel]);
	}
	
	get name() { return this._name; };
	get displayName() { return this._displayName; };
	get id() { return this._id; };
}