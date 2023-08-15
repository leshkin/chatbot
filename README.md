# Telegram chatbot based on OpenAI API (ChatGPT)

## Before launching the chatbot

Create a bot in [Telegram](https://core.telegram.org/bots#how-do-i-create-a-bot) and an account in [OpenAI](https://platform.openai.com/signup)

## Usage

1. Rename `.env.example` to `.env` and specify environment variables.
2. Install dependencies

```
npm i
```

3. Start chatbot locally

```
npm run dev
```

## Deployment

1. Install Docker on the server
2. Create and push Docker images to Docker Hub
3. Rename `docker-compose.example.yml` to `docker-compose.yml` and specify an image name.
4. Copy `docker-compose.yml` and `.env` to a folder on the server
5. Start container

```
docker compose up -d
```
