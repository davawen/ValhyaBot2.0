import * as dotenv from "dotenv";
dotenv.config();

import * as https from "https";

const config =
{
	TWITCH_ID: process.env.TWITCH_ID,
	TWITCH_OAUTH: process.env.TWITCH_OAUTH,
	FAUNA_SECRET: process.env.FAUNA_SECRET,
	FAUNA_KEY: process.env.FAUNA_KEY
};

function request(options: https.RequestOptions): Promise<any>
{
	return new Promise(
		(resolve, reject) =>
		{
			https.get(options, 
				res =>
				{
					res.setEncoding("utf-8");
					
					let rawData = "";
					res.on('data', chunk => rawData += chunk);
					res.on('end',
						() =>
						{
							resolve(JSON.parse(rawData));
						}
					);
					
					res.on('error', reject);
				}
			).on('error', reject);
		}
	);
}

// let options: https.RequestOptions =
// {
// 	hostname: 'api.twitch.tv',
// 	path: `/helix/users?login=Valhyan`,
// 	headers:
// 	{
// 		'client-id': config.TWITCH_ID,
// 		'Authorization': `Bearer ${config.TWITCH_OAUTH}`
// 	}
// }