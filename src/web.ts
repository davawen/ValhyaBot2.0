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
			console.log(req.body);
			
			if(req.body['hub.challenge'])
			{
				res.type('text/plain');
				res.status(200).send(req.body['hub.challenge']);
			}
		}
	)
	
	app.post('/twitch',
		(req, res) =>
		{
			console.log(req.body);
			
			try
			{
				res.status(200).send('Sucess ! :)');
				
				if(req.body.length <= 0) return; //Stream offline
				
				let stream: TwitchStreamWebhook = req.body[0];
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
			console.log(`Listening on localhost:${port}`);
		}	
	);
}