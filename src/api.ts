import * as https from "https";
import { config } from './main';

export function request(options: string | https.RequestOptions): Promise<any>
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

export async function sleep(time: number): Promise<boolean>
{
	return new Promise(resolve => setTimeout(resolve, time));
}

export interface YoutubeSearchResponse
{
	kind: string;
	etag: string;
	nextPageToken: string;
	regionCode: string;
	pageInfo:
	{
		totalResults: number;
		resultsPerPage: number;
	};
	items:
	{
		kind: string;
		etag: string;
		id: {
			kind: string;
			videoId: string;
		};
		snippet: {
			publishedAt: string;
			channelId: string;
			title: string;
			description: string;
			thumbnails: {
				default: {
					url: string;
					width: number;
					height: number;
				};
				medium: {
					url: string;
					width: number;
					height: number;
				};
				high: {
					url: string;
					width: number;
					height: number;
				};
			};
			channelTitle: string;
			liveBroadcastContent: string;
			publishTime: string;
		};
	}[];
}