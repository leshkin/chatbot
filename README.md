# Telegram chatbot based on OpenAI API (ChatGPT)

## Before launching the chatbot

Create a bot in [Telegram](https://core.telegram.org/bots#how-do-i-create-a-bot) and an account in [OpenAI](https://platform.openai.com/signup)

## Development

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
2. Copy `docker-compose.yml` and `.env` to a folder on the server
3. Start container

```
docker compose up -d
```
