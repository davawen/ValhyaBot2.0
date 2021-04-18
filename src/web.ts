import * as express from 'express';

import { streamers } from './main';
import { TwitchStreamWebhook } from './api';

const app = express();
const port = process.env.port || 3000;

export const recieveWebhooks = () =>
{
	app.get('/twitch',
		(req, res) =>
		{
			try
			{
				if(req.body.length <= 0) return; //Stream offline
				
				let stream: TwitchStreamWebhook = req.body[0];
				let streamer = streamers.get(stream.user_login);
				
				console.log(stream);
				
				streamer.channels.forEach(
					channel =>
					{
						channel.send("@everyone" + ` ${streamer.displayName} est en ligne !\nhttps://www.twitch.tv/${streamer.name}`)
					}
				);
			}
			catch(err)
			{
				console.log(`Error while recieving webhook.\n${err}`);
			}
		}
	);

	app.listen(port, 
		() =>
		{
			console.log(`Listening on localhost:${port}`);
		}	
	);
}