import { Context, Schema, h } from 'koishi'
export const inject = ['database']

export const name = 'fei-bagong'

export interface Config {
    workCommand: string
    unworkCommand: string
    goWorkCommand: string
    goUnworkCommand: string
    workText: string
    unworkText: string
    bagongText: string
    superBagongMode: boolean
}

export const Config: Schema<Config> = Schema.object({
    workCommand: Schema.string().default('上班').description('上班指令名'),
    unworkCommand: Schema.string().default('下班').description('下班指令名'),
    goWorkCommand: Schema.string().default('去上班').description('指定某个/某些群上班的指令名'),
    goUnworkCommand: Schema.string().default('去下班').description('指定某个/某些群下班的指令名'),
    workText: Schema.string().default('上班咯').description('上班文本'),
    unworkText: Schema.string().default('下班咯').description('下班文本'),
    bagongText: Schema.string().default('').description('罢工文本，为空时什么也不说'),
    superBagongMode: Schema.boolean().default(false).description('强力罢工~未开启时只屏蔽指令但不影响统计插件，开启后无视上下班指令外全部内容'),
})

export const usage =`
让你的机器人可以上班与下班~

0.3.0 新增了可以指定某个群上下班的功能 注意本功能对QQ官方机器人可能效果不佳（毕竟官方机器人又读不了群号又读不了群名惨兮兮，叹）`;

declare module 'koishi' {
  interface Tables {
      bagongData: BagongData
  }
}

export interface BagongData {
    platform: string
    channelId: string
    xiabanla: boolean
}

export function apply(ctx: Context, config: Config) {
    ctx.model.extend('bagongData', {
        platform: 'string',
        channelId: 'string',
        xiabanla: 'boolean'
    },{
        primary: ['platform','channelId']
    })
    //上班
    ctx.command(config.workCommand).action(async ({ args, session }) => {
        await ctx.database.upsert('bagongData', [{ platform: session.platform, channelId: session.event.channel.id, xiabanla: false }]);
        return config.workText;
    })
    //下班
    ctx.command(config.unworkCommand).action(async ({ args, session }) => {
        await ctx.database.upsert('bagongData', [{ platform: session.platform, channelId: session.event.channel.id, xiabanla: true }]);
        return config.unworkText;
    })
    //指定某个/某些群上班
    ctx.command(config.goWorkCommand).action(async ({ args, session }) => {
        if(args[0] === undefined) {
            return '指令格式：' + config.goWorkCommand + ' <群号> <群号> ...';
        }
        else {
            let returnMessage = '';
            const guildList = (await session.bot.getGuildList()).data;
            args.map(async guildId => {
                const guildIndex = guildList.map(data => data.id).findIndex(id => id === guildId)
                //~可以把index未找到的-1变为0
                if(~guildIndex) {
                    returnMessage += '\n在"' + guildList[guildIndex].name + '"' + config.workText;
                    session.bot.sendMessage(guildId, config.workText)
                    await ctx.database.upsert('bagongData', [{ platform: session.platform, channelId: guildId, xiabanla: false }]);
                }
                else 
                    returnMessage += '\n未找到' + guildId;
            })
            return returnMessage;
        }
    })
    //指定某个/某些群下班
    ctx.command(config.goUnworkCommand).action(async ({ args, session }) => {
        if(args[0] === undefined) {
            return '指令格式：' + config.goUnworkCommand + ' <群号> <群号> ...';
        }
        else {
            let returnMessage = '';
            const guildList = (await session.bot.getGuildList()).data;
            args.map(async guildId => {
                const guildIndex = guildList.map(data => data.id).findIndex(id => id === guildId)
                //~可以把index未找到的-1变为0
                if(~guildIndex) {
                    returnMessage += '\n在"' + guildList[guildIndex].name + '"' + config.unworkText;
                    session.bot.sendMessage(guildId, config.unworkText)
                    await ctx.database.upsert('bagongData', [{ platform: session.platform, channelId: guildId, xiabanla: true }]);
                }
                else 
                    returnMessage += '\n未找到' + guildId;
            })
            return returnMessage;
        }
    })

    if(config.superBagongMode) {
        ctx.middleware(async(session, next) => {
        const content = h.select(session.content,'text')[0]?.attrs.content.replace(/^\//,'').replace(RegExp('^' + ctx.root.config.prefix),'');
        const xiabanla = (await ctx.database.get('bagongData', { platform: session.platform, channelId:session.event.channel.id }))[0]?.xiabanla;
        if(!xiabanla || content.startsWith(config.workCommand) || content.startsWith(config.unworkCommand))
            return next();
        else 
            session.send(config.bagongText);
        },true)
    }
    else {
        ctx.on('command/before-execute', async ({ command, session }) => {
            const xiabanla = (await ctx.database.get('bagongData', { platform: session.platform, channelId:session.event.channel.id }))[0]?.xiabanla;
            if(!xiabanla || command.name === config.workCommand || command.name === config.unworkCommand)
                return;
            else
                return config.bagongText;
        })
    }

}
