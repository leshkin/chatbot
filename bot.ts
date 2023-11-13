import { Bot, Context, session, SessionFlavor, MemorySessionStorage, GrammyError, HttpError, InputFile } from 'grammy'
import { OpenAI } from 'openai'
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

const openai = new OpenAI()

bot.command('start', (ctx) => {
  ctx.reply(process.env.MESSAGE_START as string)
})

bot.command('help', (ctx) => {
  ctx.reply(process.env.MESSAGE_START as string)
})

bot.command('tts', async (ctx) => {
  const username = ctx.message!.from.username as string
  const tts = ctx.match as string

  console.log('user: ' + username)
  console.log('tts: ' + tts)

  if (isAllowedUser(username)) {
    const intervalId = typingAction(ctx)
    const mp3 = await openai.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL as string,
      voice: 'echo',
      input: tts,
    })
    clearInterval(intervalId)

    const buffer = Buffer.from(await mp3.arrayBuffer())
    await ctx.replyWithAudio(new InputFile(buffer))
  } else {
    await ctx.reply(process.env.MESSAGE_UNKNOWN_USER as string)
  }
})

bot.on('message', async (ctx) => {
  const username = ctx.msg.from.username as string
  const text = ctx.msg.text as string

  console.log('user: ' + username)
  console.log('question: ' + text)

  if (isAllowedUser(username)) {
    ctx.session.messages.push({ role: 'user', content: text })

    const intervalId = typingAction(ctx)
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL as string,
      messages: ctx.session.messages,
    })
    clearInterval(intervalId)

    const reply = completion.choices[0].message.content as string
    ctx.session.messages.push({ role: 'assistant', content: reply })

    if (ctx.session.messages.length > MAX_MESSAGES_IN_HISTORY) {
      ctx.session.messages.shift()
      ctx.session.messages.shift()
    }

    console.log('answer: ' + reply)

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

function isAllowedUser(username: string) {
  return ALLOWED_USERS.split(',').indexOf(username) > -1
}

function typingAction(ctx: any) {
  const typingAction = () => bot.api.sendChatAction(ctx.chat.id, 'typing')
  return setInterval(typingAction, 3000)
}

bot.start()
