import { Bot, Context, session, SessionFlavor, MemorySessionStorage, GrammyError, HttpError } from 'grammy'
import { Configuration, OpenAIApi } from 'openai'
import 'dotenv/config'

const ALLOWED_USERS = process.env.ALLOWED_USERS as string
const MAX_MESSAGES_IN_HISTORY = Number(process.env.MAX_MESSAGES_IN_HISTORY)

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface SessionData {
  messages: Array<Message>
}

type MyContext = Context & SessionFlavor<SessionData>

const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN as string)

function createInitialSessionData(): SessionData {
  return { messages: [{ role: 'system', content: process.env.OPENAI_BOT_ROLE as string }] }
}

bot.use(
  session({
    initial: createInitialSessionData,
    storage: new MemorySessionStorage(Number(process.env.MESSAGE_HISTORY_RETENTION_TIME)),
  })
)

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})

const openai = new OpenAIApi(configuration)

bot.command('start', (ctx) => {
  ctx.reply(process.env.MESSAGE_START as string)
})

bot.on('message', async (ctx) => {
  const username = ctx.message.from.username as string
  const text = ctx.message.text as string

  console.log('user: ' + username)
  console.log('text: ' + text)

  if (ALLOWED_USERS.split(',').indexOf(username) > -1) {
    ctx.session.messages.push({ role: 'user', content: text })

    const response = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL as string,
      messages: ctx.session.messages,
    })

    const reply = response.data.choices[0].message?.content as string
    ctx.session.messages.push({ role: 'assistant', content: reply })

    if (ctx.session.messages.length > MAX_MESSAGES_IN_HISTORY) {
      ctx.session.messages.shift()
      ctx.session.messages.shift()
    }

    console.log('reply: ' + reply)

    await ctx.reply(reply)
  } else {
    await ctx.reply(process.env.MESSAGE_UNKNOWN_USER as string)
  }
})

bot.catch((err) => {
  const e = err.error
  if (e instanceof GrammyError) {
    console.error(e.description)
  } else if (e instanceof HttpError) {
    console.error('Could not contact Telegram:', e)
  } else {
    console.error('Unknown error:', e)
  }
})

bot.start()
