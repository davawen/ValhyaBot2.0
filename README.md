# Takino, yet another discord bot
Mostly made for fun or something I guess

Currently, everything is in french but I guess I can add localization features down the line.
## Capabilities
### Audio playing
- The `p` command allows you to play a youtube video while you are in a voice channel
  - `!t p <Youtube Url>`
  - `!t p <Youtube Playlist> <Number of elements>`
  - `!t p <Search Query>`
- The `stop` command to stop the execution of the music queue
  - `!t stop`
- The `volume` command will change the output volume of the music
  - `!t volume <0-100>`
- The `skip` command will skip the current music and go to the next one (shocking I know!)
  - `!t skip`
- The `list` command shows the music queue along with the durations and thumbnail of the musics
  - `!t list`
### Twitch Warnings
- `addStreamer` will send notifications to the channel the command was sent in when the given streamer goes online (requires admin permission)
  - `!t addStreamer <Name>`
- `deleteStreamer` will remove notifications from the given streamers  (requires admin permission)
  - `!t deleteStreamer <Name 1> <Name 2> <...>`
- `listStreamer` lists all streamer notifications set in this server
  - `!t listStreamer`
### Other
- `help` lists all commands and their arguments
  - `!t help`
- `poll` sends a poll with the given answers or yes/no reactions
  - `!t poll <Question>`
  - `!t poll <Question> <Answer 1> <Answer 2> <...>`
## Building
If for whatever reason you want to build this or contribute to this, this is a standard node/typescript project.

Just clone the repo, cd into it and install the dependencies.
```
git clone https://github.com/davawen/ValhyaBot2.0.git
cd ValhyaBot2.0
npm i
tsc
```