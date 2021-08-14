# Only install ffmpeg on server
heroku-postbuild: npm i ffmpeg-static && tsc && rm -v -rf src
web: node dist/main.js