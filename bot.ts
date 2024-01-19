import { Bot, Context, session, SessionFlavor, MemorySessionStorage, GrammyError, HttpError, InputFile } from 'grammy'
import { OpenAI, toFile } from 'openai'
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

  if (!(await isAllowedUser(ctx, username))) {
    return
  }

  const intervalId = typingAction(ctx)
  let mp3
  try {
    mp3 = await openai.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL as string,
      voice: 'echo',
      input: tts,
    })
  } catch (err) {
    console.error('Error during request to OpenAI:', err)
  }

  clearInterval(intervalId)

  if (mp3) {
    const buffer = Buffer.from(await mp3.arrayBuffer())
    await ctx.replyWithAudio(new InputFile(buffer))
  } else {
    await ctx.reply(process.env.MESSAGE_ERROR as string)
  }
})

bot.command('image', async (ctx) => {
  const username = ctx.message!.from.username as string
  const imageDescription = ctx.match as string

  console.log('user: ' + username)
  console.log('image: ' + imageDescription)

  if (!(await isAllowedUser(ctx, username))) {
    return
  }

  const intervalId = typingAction(ctx)
  let response
  try {
    response = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL as string,
      prompt: imageDescription,
      n: 1,
      size: '1024x1024',
    })
  } catch (err) {
    console.error('Error during request to OpenAI:', err)
  }

  clearInterval(intervalId)

  if (response) {
    await ctx.replyWithPhoto(response.data[0].url!)
  } else {
    await ctx.reply(process.env.MESSAGE_ERROR as string)
  }
})

bot.on('message:voice', async (ctx) => {
  const username = ctx.msg.from.username as string
  const voice = ctx.msg.voice

  const duration = voice.duration // in seconds
  await ctx.reply(`Your voice message is ${duration} seconds long.`)

  const file = await ctx.getFile()

  if (!(await isAllowedUser(ctx, username))) {
    return
  }

  const transcript = await openai.audio.transcriptions.create({
    file: await toFile(new Blob()),
    model: 'whisper-1',
  })
  console.log(transcript)
})

bot.on('message', async (ctx) => {
  const username = ctx.msg.from.username as string
  const text = ctx.msg.text as string

  console.log('user: ' + username)
  console.log('question: ' + text)
  if (!(await isAllowedUser(ctx, username))) {
    return
  }
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
})

bot.catch((err) => {
  const ctx = err.ctx
  console.error(`Error while handling update ${ctx.update.update_id}:`)
  const e = err.error
  if (e instanceof GrammyError) {
    console.error('Error in request:', e.description)
  } else if (e instanceof HttpError) {
    console.error('Could not contact Telegram:', e)
  } else {
    console.error('Unknown error:', e)
  }
})

function typingAction(ctx: any) {
  return setInterval(async () => {
    try {
      await bot.api.sendChatAction(ctx.chat.id, 'typing')
    } catch (err) {
      console.error('Error during sendChatAction:', err)
    }
  }, 3000)
}

async function isAllowedUser(ctx: MyContext, username: string) {
  if (ALLOWED_USERS.split(',').indexOf(username) > -1) {
    return true
  } else {
    await ctx.reply(process.env.MESSAGE_UNKNOWN_USER as string)
    return false
  }
}

bot.start()
