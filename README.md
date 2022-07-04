# Takino, yet another discord bot

Mostly made for fun or something

Only in french for now.

## Capabilities

### Audio playing

-   The `p` command allows you to play a youtube video while you are in a voice channel
    -   `!t p <Youtube Url>`
    -   `!t p <Youtube Playlist> <Number of elements>`
    -   `!t p <Search Query>`
-   The `stop` command to stop the execution of the music queue
    -   `!t stop`
-   The `volume` command will change the output volume of the music
    -   `!t volume <0-100>`
-   The `skip` command will skip the current music and go to the next one (shocking I know!)
    -   `!t skip`
-   The `list` command shows the music queue along with the durations and thumbnail of the musics
    -   `!t list`

### Other

-   `help` lists all commands and their arguments
    -   `!t help`
-   `poll` sends a poll with the given answers or yes/no reactions
    -   `!t poll <Question>`
    -   `!t poll <Question> <Answer 1> <Answer 2> <...>`

## Building

To build the project, just clone the repo, cd into it and install the dependencies.

```
git clone https://github.com/davawen/ValhyaBot2.0.git
cd ValhyaBot2.0
npm i
tsc
```
