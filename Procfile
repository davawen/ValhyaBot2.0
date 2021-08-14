# Only install ffmpeg on server
heroku-postbuild: npm i ffmpeg-static && tsc && mv src/assets dist/ && rm -v -rf src
web: node dist/main.js