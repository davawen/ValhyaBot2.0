import * as express from 'express';

const app = express();
const port = 3000;

app.get('/hello',
	(req, res) =>
	{
		res.send("Hello world");
		
		console.log("Hello!");
	}
);

app.listen(port, 
	() =>
	{
		console.log(`Listening on localhost:${port}`);
	}	
);