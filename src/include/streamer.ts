import { Client, Message, TextChannel } from 'discord.js'
import { collection, getDoc, doc, updateDoc, DocumentReference } from 'firebase/firestore/lite'

import { db } from '../main';
import { request, sleep, TwitchChannelResponse, DatabaseStreamer } from '../api';

import { config } from './config'

interface StreamerConstructorOptions
{
	name: string;
	displayName: string;
	id: string;
	dbId: DocumentReference<DatabaseStreamer>;
	channels: TextChannel | TextChannel[];
	date?: number;
}

export class Streamer
{
	private _name: string;
	private _displayName: string;
	private _id: string;
	/**Database reference to document */
	private _dbId: DocumentReference<DatabaseStreamer>;
	/**Unix date at which the subscribtion started */
	private _date: number;
	private _renewSubscribtionTimeout?: NodeJS.Timeout;
	
	channels: Set<TextChannel>;
	
	constructor(options: StreamerConstructorOptions)
	{
		this._name = options.name;
		this._displayName = options.displayName;
		this._id = options.id;
		this._dbId = options.dbId;
		this._date = options.date || Date.now();
		this._renewSubscribtionTimeout = null;
		
		if(Array.isArray(options.channels))
		{
			this.channels = new Set(options.channels);
		}
		else
		{
			this.channels = new Set([options.channels]);
		}
	}
	
	get name()        { return this._name;        }
	get displayName() { return this._displayName; }
	get id()          { return this._id;          }
	get dbId()        { return this._dbId;        }
	get date()        { return this._date;        }
	
	renewSubscription()
	{
		this._renewSubscribtionTimeout = setTimeout(
			() =>
			{
				this._date = Date.now();
				
				updateDoc(this._dbId, 
					{
						date: this._date
					}
				);
				
				this.subscribe(true);
			},
			this._date + 864000000 - Date.now()
		);
	}
	
	subscribe(subscribe: boolean): void
	{
		request(
			{
				hostname: "api.twitch.tv",
				path: encodeURI(
					'/helix/webhooks/hub' +
					'?hub.callback=https://valhyabot2-web.herokuapp.com/twitch' +
					`&hub.mode=${subscribe ? "subscribe" : "unsubscribe"}` +
					`&hub.topic=https://api.twitch.tv/helix/streams?user_id=${this._id}` +
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
		
		if(subscribe)
		{
			this.renewSubscription();
		}
		else
		{
			if(this._renewSubscribtionTimeout != null) clearTimeout(this._renewSubscribtionTimeout);
			
			this._renewSubscribtionTimeout = null;
		}
	}
}