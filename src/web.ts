import * as express from 'express';

import { streamers } from './main';
import { request, TwitchStreamWebhook } from './api';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export const recieveWebhooks = () =>
{
	app.get('/twitch',
		(req, res) =>
		{
			if(req.query['hub.challenge'])
			{
				res.type('text/plain');
				res.write(req.query['hub.challenge']);
				res.status(200).send();
			}
		}
	)
	
	app.post('/twitch',
		(req, res) =>
		{
			try
			{
				res.status(200).send(200);
				
				let data: TwitchStreamWebhook[] = req.body.data;
				
				if(data.length <= 0) return; //Stream offline
				
				let stream: TwitchStreamWebhook = data[0];
				let streamer = streamers.get(stream.user_login);
				
				//console.log(stream);
				
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
			console.log(`Listening on port ${port} !\n`);
		}	
	);
}