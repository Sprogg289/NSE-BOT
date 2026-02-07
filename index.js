require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField, 
    EmbedBuilder,
    Events,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Partials,
    AuditLogEvent 
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration, 
        GatewayIntentBits.GuildBans        
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction] 
});

// --- SECURE CONFIGURATION ---
// These values are now loaded from your Railway Variables or .env file
const CONFIG = {
    prefix: process.env.PREFIX || '!',
    staffRoleId: process.env.STAFF_ROLE_ID, 
    transcriptChannelId: process.env.TRANSCRIPT_CHANNEL_ID, 
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID, 
    onlineLogChannelId: process.env.ONLINE_LOG_CHANNEL_ID, 
    countingChannelId: process.env.COUNTING_CHANNEL_ID, 
    loggingChannelId: process.env.LOGGING_CHANNEL_ID, 
    driverRoleId: process.env.DRIVER_ROLE_ID, 
    seniorDriverRoleId: process.env.SENIOR_DRIVER_ROLE_ID, 
    setupColor: '#3498db', // Not secret, can stay hardcoded

    reactionRoles: [
        { emoji: '📣', roleId: process.env.ROLE_ANNOUNCEMENT_ID, name: '| Announcements Ping' },
        { emoji: '📕', roleId: process.env.ROLE_APPLICATION_ID, name: '| Application Ping' },
        { emoji: '🗓️', roleId: process.env.ROLE_EVENT_ID, name: '| Event Ping' },
        { emoji: '📍', roleId: process.env.ROLE_VTC_ID, name: '| VTC update Ping' },
        { emoji: '🌐', roleId: process.env.ROLE_DISCORD_ID, name: '| Discord Update Ping' },
    ],

    aboutMe: {
        title: '🚚 About NorthStar Logistics',
        description: 'NorthStar Logistics is a premier Virtual Trucking Company (VTC) dedicated to professionalism, community, and the open road.',
        thumbnail: 'https://cdn.discordapp.com/attachments/1077664866539683982/1446236802368409764/NSL_CLEAR_NO_TEXT.png',
        footer: 'NorthStar VTC • Reliability at every mile',
        fields: [
            { name: '🌐 Website', value: 'https://sprogg289.github.io/NorthStar-Express/', inline: true },
            { name: '📈 Requirements', value: '15+ Years Old', inline: true },
        ]
    },
    ticketEmbed: {
        authorName: 'NorthStar Support Center',
        title: '📩 NorthStar Support Center',
        description: 'Welcome to our official support portal.\n By selecting a category below, you can open a ticket. Our team is here to assist you with any inquiries or issues you may have. \n\n Please choose the appropriate category to get started:',
        color: '#3498db', 
        thumbnail: 'https://cdn.discordapp.com/attachments/1077664866539683982/1446236802368409764/NSL_CLEAR_NO_TEXT.png', 
        image: 'https://media.discordapp.net/attachments/1077664866539683982/1446830775612866722/New_Project_26.png', 
        footerText: 'NorthStar VTC • Reliability at every mile',
    },
    ticketMenu: {
        placeholder: '🔎 Choose a category to start...',
        supportLabel: 'General Support',
        reportLabel: 'Player Report',
        partnershipLabel: 'Partnership Request',
        inviteLabel: 'Invite Request', 
        contentManagementLabel: 'Management Team Request', 
    },
    closeButtonLabel: '🔒 Close & Archive Ticket',
    claimButtonLabel: '🙋‍♂️ Claim Ticket', 
};

// --- GLOBAL VARIABLES FOR COUNTING ---
let currentCount = 0;
let lastCounterId = null;
// 🟢 CHANGED: Use /tmp/ for Railway compatibility (prevents permission errors)
const COUNT_FILE = '/tmp/countData.json'; 

// --- HELPER FUNCTIONS ---
function getSafeColor(hex) {
    try {
        const reg = /^#([0-9a-f]{3}){1,2}$/i;
        if (reg.test(hex)) return hex;
        return '#2f3136'; 
    } catch (e) { return '#2f3136'; }
}

function loadCount() {
    try {
        if (fs.existsSync(COUNT_FILE)) {
            const data = JSON.parse(fs.readFileSync(COUNT_FILE, 'utf8'));
            currentCount = data.count || 0;
            lastCounterId = data.lastUser || null;
            console.log(`✅ Count loaded: ${currentCount}`);
        }
    } catch (e) {
        console.error("Error loading count:", e);
    }
}

function saveCount() {
    try {
        const data = { count: currentCount, lastUser: lastCounterId };
        fs.writeFileSync(COUNT_FILE, JSON.stringify(data, null, 4));
    } catch (e) {
        console.error("Error saving count:", e);
    }
}

// --- CLIENT READY ---
client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.tag} is online and fully updated!`);
    loadCount();

    if (CONFIG.onlineLogChannelId) {
        const channel = client.channels.cache.get(CONFIG.onlineLogChannelId);
        if (channel) await channel.send('✅ **System Online:** NorthStar Bot is ready for duty!');
    }

    if (CONFIG.countingChannelId) {
        const countChannel = client.channels.cache.get(CONFIG.countingChannelId);
        if (countChannel) {
            await countChannel.send(`🟢 **Bot Online!** We finished off at **${currentCount}**. Lets carry on from there. Next number **${currentCount + 1}**.`);
        }
    }
});

// --- WELCOME MESSAGE ---
client.on(Events.GuildMemberAdd, async (member) => {
    if (!CONFIG.welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);
    if (!channel) return; 

    const welcomeEmbed = new EmbedBuilder()
        .setTitle(`👋 Welcome to NorthStar VTC!`) 
        .setDescription(`Hello ${member}, we are thrilled to have you here! If you wish to join our driver team, please apply in the application channel.\n\nPlease make sure to read the rules...`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields({ name: '🆔 User Info', value: `${member.user.username}`, inline: true })
        .setImage('https://cdn.discordapp.com/attachments/1077664866539683982/1457809010119151812/Welcome_message.png')
        .setColor(getSafeColor(CONFIG.setupColor)) 
        .setFooter({ text: 'NorthStar Logistics • Reliability at every mile' }) 
        .setTimestamp();

    channel.send({ content: `Welcome ${member}!`, embeds: [welcomeEmbed] });
});

// --- LOGGING UTILITY ---
async function sendLog(guild, embed) {
    if (!CONFIG.loggingChannelId) return;
    const logChannel = guild.channels.cache.get(CONFIG.loggingChannelId);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// 1. Message Deleted
client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Deleted', iconURL: 'https://cdn-icons-png.flaticon.com/512/3221/3221897.png' })
        .setColor('#f1c40f') 
        .addFields(
            { name: 'Author', value: `${message.author.tag}`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Content', value: message.content || '[Image/Embed]' }
        )
        .setTimestamp();
    sendLog(message.guild, embed);
});

// 2. Message Edited
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Edited', iconURL: 'https://cdn-icons-png.flaticon.com/512/1159/1159633.png' })
        .setColor('#3498db') 
        .addFields(
            { name: 'Author', value: `${oldMessage.author.tag}`, inline: true },
            { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
            { name: 'Before', value: oldMessage.content.substring(0, 1024) || '[None]' },
            { name: 'After', value: newMessage.content.substring(0, 1024) || '[None]' }
        )
        .setTimestamp();
    sendLog(oldMessage.guild, embed);
});

// 3. Member Banned
client.on(Events.GuildBanAdd, async (ban) => {
    const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const log = fetchedLogs.entries.first();
    const executor = log ? log.executor.tag : 'Unknown';
    const reason = log ? log.reason : 'No reason provided';

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Member Banned', iconURL: 'https://cdn-icons-png.flaticon.com/512/1603/1603806.png' })
        .setColor('#e74c3c') 
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `${ban.user.tag}`, inline: true },
            { name: 'Banned By', value: executor, inline: true },
            { name: 'Reason', value: reason }
        )
        .setTimestamp();
    sendLog(ban.guild, embed);
});

// 4. Member Unbanned
client.on(Events.GuildBanRemove, async (ban) => {
    const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
    const log = fetchedLogs.entries.first();
    const executor = log ? log.executor.tag : 'Unknown';

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Member Unbanned', iconURL: 'https://cdn-icons-png.flaticon.com/512/1603/1603806.png' })
        .setColor('#2ecc71') 
        .addFields(
            { name: 'User', value: `${ban.user.tag}`, inline: true },
            { name: 'Unbanned By', value: executor, inline: true }
        )
        .setTimestamp();
    sendLog(ban.guild, embed);
});

// 5. Channel Created/Deleted
client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Channel Created', iconURL: 'https://cdn-icons-png.flaticon.com/512/992/992651.png' })
        .setColor('#2ecc71')
        .setDescription(`Channel: ${channel} (${channel.name})`)
        .setTimestamp();
    sendLog(channel.guild, embed);
});
client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Channel Deleted', iconURL: 'https://cdn-icons-png.flaticon.com/512/1214/1214428.png' })
        .setColor('#e74c3c')
        .setDescription(`Channel Name: **${channel.name}**`)
        .setTimestamp();
    sendLog(channel.guild, embed);
});

// 6. Member Changes (Nickname)
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (oldMember.nickname !== newMember.nickname) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Nickname Changed', iconURL: 'https://cdn-icons-png.flaticon.com/512/1250/1250689.png' })
            .setColor('#9b59b6') 
            .addFields(
                { name: 'User', value: `${newMember.user.tag}`, inline: true },
                { name: 'Old Name', value: oldMember.nickname || oldMember.user.username, inline: true },
                { name: 'New Name', value: newMember.nickname || newMember.user.username, inline: true }
            )
            .setTimestamp();
        sendLog(newMember.guild, embed);
    }
});

// 7. Kick Detection & Role Delete
client.on(Events.GuildMemberRemove, async (member) => {
    setTimeout(async () => {
        const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
        const kickLog = fetchedLogs.entries.first();
        
        if (kickLog && kickLog.target.id === member.id && (kickLog.createdTimestamp > (Date.now() - 10000))) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Member Kicked', iconURL: 'https://cdn-icons-png.flaticon.com/512/924/924922.png' })
                .setColor('#e67e22') 
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${member.user.tag}`, inline: true },
                    { name: 'Kicked By', value: `${kickLog.executor.tag}`, inline: true },
                    { name: 'Reason', value: kickLog.reason || 'No reason provided' }
                )
                .setTimestamp();
            sendLog(member.guild, embed);
        }
    }, 1000);
});

client.on(Events.GuildRoleDelete, async (role) => {
    const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
    const deletionLog = fetchedLogs.entries.first();
    const executor = (deletionLog && deletionLog.target.id === role.id) ? deletionLog.executor.tag : 'Unknown';

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Role Deleted', iconURL: 'https://cdn-icons-png.flaticon.com/512/6861/6861326.png' })
        .setColor('#2f3136')
        .addFields({ name: 'Role', value: role.name, inline: true }, { name: 'Deleted By', value: executor, inline: true })
        .setTimestamp();
    sendLog(role.guild, embed);
});

// --- MAIN COMMANDS ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // Counting Logic
    if (CONFIG.countingChannelId && message.channel.id === CONFIG.countingChannelId) {
        const userNumber = parseInt(message.content);
        if (isNaN(userNumber)) return message.delete().catch(() => {}); 
        if (userNumber === currentCount + 1) {
            if (lastCounterId === message.author.id) {
                message.react('❌');
                message.channel.send(`⛔ **${message.author}**, you cannot count twice in a row! Reset to 0.`);
                currentCount = 0; lastCounterId = null;
                saveCount();
                return;
            }
            currentCount++; lastCounterId = message.author.id; message.react('✅');
            saveCount();
        } else {
            message.react('❌');
            message.channel.send(`💀 **${message.author}** ruined the streak at **${currentCount}**! Reset to 0.`);
            currentCount = 0; lastCounterId = null;
            saveCount();
        }
        return;
    }

    if (!message.content.startsWith(CONFIG.prefix)) return;
    const args = message.content.slice(CONFIG.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const isStaff = message.member.permissions.has(PermissionsBitField.Flags.Administrator) || 
                    (CONFIG.staffRoleId && message.member.roles.cache.has(CONFIG.staffRoleId));

    // Simple ping command
    if (command === 'ping') return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
    if (command === 'uptime') return message.reply(`The bot been up for ${client.uptime / 1000 / 60 / 60 | 0} hours.`);

    // ==========================================
    // 🔢 SETUP COUNT
    // ==========================================
    if (command === 'setup-count' && isStaff) {
        if (CONFIG.countingChannelId) {
            const existingChannel = message.guild.channels.cache.get(CONFIG.countingChannelId);
            if (existingChannel) return message.reply(`⚠️ **Counting System is already active!**\nGo to: ${existingChannel}`);
        }

        const duplicateChannel = message.guild.channels.cache.find(c => c.name === '🔢-counting');
        if (duplicateChannel) return message.reply(`⚠️ **A counting channel already exists!**\nGo to: ${duplicateChannel}`);

        try {
            const countChannel = await message.guild.channels.create({
                name: '🔢-counting', type: ChannelType.GuildText,
                permissionOverwrites: [{ id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]
            });
            
            CONFIG.countingChannelId = countChannel.id; 
            currentCount = 0;
            saveCount(); 
            
            await message.channel.send(`✅ Channel created: ${countChannel}.\n**Important:** Add \`COUNTING_CHANNEL_ID=${countChannel.id}\` to your Railway variables.`);
            await countChannel.send("🏁 **Start Counting!** The first number is **1**.");
        } catch (e) { message.reply("❌ Error creating channel."); }
        return;
    }

    // ==========================================
    // ⚔️ MODERATION COMMANDS
    // ==========================================

    // !kick @User Reason
    if (command === 'kick') {
        if (!isStaff) return message.reply("❌ You do not have permission.");
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "No reason provided";
        if (!target) return message.reply("⚠️ Mention a user to kick.");
        if (!target.kickable) return message.reply("❌ I cannot kick this user (Check roles/permissions).");

        try {
            await target.kick(reason);
            message.channel.send(`👢 **${target.user.tag}** was kicked.\n**Reason:** ${reason}`);
        } catch (e) { message.reply("❌ Error kicking user."); }
    }

    // !ban @User Reason
    if (command === 'ban') {
        if (!isStaff) return message.reply("❌ You do not have permission.");
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "No reason provided";
        if (!target) return message.reply("⚠️ Mention a user to ban.");
        if (!target.bannable) return message.reply("❌ I cannot ban this user (Check roles/permissions).");

        try {
            await target.ban({ reason });
            message.channel.send(`🔨 **${target.user.tag}** was banned.\n**Reason:** ${reason}`);
        } catch (e) { message.reply("❌ Error banning user."); }
    }

    // !mute @User Sec Reason
    if (command === 'mute') {
        if (!isStaff) return message.reply("❌ You do not have permission.");
        const target = message.mentions.members.first();
        const seconds = parseInt(args[1]);
        const reason = args.slice(2).join(" ") || "No reason provided";

        if (!target) return message.reply("⚠️ Mention a user. Usage: `!mute @user 60 Spamming`");
        if (isNaN(seconds)) return message.reply("⚠️ Provide time in seconds.");

        try {
            await target.timeout(seconds * 1000, reason);
            message.channel.send(`🤐 **${target.user.tag}** has been muted for ${seconds} seconds.\n**Reason:** ${reason}`);
        } catch (e) { message.reply("❌ Error muting user."); }
    }

    // !warn @User Reason
    if (command === 'warn') {
        if (!isStaff) return message.reply("❌ You do not have permission.");
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "No reason provided";
        
        if (!target) return message.reply("⚠️ Mention a user to warn. Usage: `!warn @user Reason`");

        const dmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Official Warning')
            .setDescription('**You have been warned by one of NorthStar moderation team.**\n\nIf you think this is a mistake please create a ticket.')
            .addFields({ name: 'Reason', value: reason })
            .setColor('#e67e22')
            .setThumbnail(message.guild.iconURL())
            .setFooter({ text: 'NorthStar VTC Moderation Team' });

        let dmStatus = "✅ User notified via DM.";
        try {
            await target.send({ embeds: [dmEmbed] });
        } catch (e) {
            dmStatus = "❌ Could not DM user (DMs closed).";
        }

        const logEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Member Warned', iconURL: target.user.displayAvatarURL() })
            .setColor('#e67e22')
            .addFields(
                { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
                { name: 'Moderator', value: message.author.tag, inline: true },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();
        sendLog(message.guild, logEmbed);

        message.channel.send(`⚠️ **${target.user.tag}** has been warned.\n**Reason:** ${reason}\n${dmStatus}`);
    }

    // Staff Setup Commands
    if (command === 'setup-ticket' && isStaff) {
        const embed = new EmbedBuilder()
            .setTitle(CONFIG.ticketEmbed.title).setDescription(CONFIG.ticketEmbed.description)
            .setColor(getSafeColor(CONFIG.ticketEmbed.color)).setImage(CONFIG.ticketEmbed.image);
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId('ticket_select').setPlaceholder(CONFIG.ticketMenu.placeholder)
            .addOptions([
                { label: CONFIG.ticketMenu.supportLabel, value: 'support', emoji: '🛠️' },
                { label: CONFIG.ticketMenu.reportLabel, value: 'report', emoji: '⚠️' },
                { label: CONFIG.ticketMenu.partnershipLabel, value: 'partnership', emoji: '🤝' }, 
                { label: CONFIG.ticketMenu.inviteLabel, value: 'invite', emoji: '🗓️' },
                { label: CONFIG.ticketMenu.contentManagementLabel, value: 'contentManagement', emoji: '📋' }
            ]));
        return message.channel.send({ embeds: [embed], components: [menu] });
    }

    if (command === 'setup-reaction' && isStaff) {
        const reactionEmbed = new EmbedBuilder().setTitle('🎭 Selecte your Roles here!')
            .setDescription('Claim any roles by Reacting below:\n\n' + CONFIG.reactionRoles.map(r => `${r.emoji} : **${r.name}**`).join('\n'))
            .setColor(getSafeColor(CONFIG.setupColor));
        const sentMessage = await message.channel.send({ embeds: [reactionEmbed] });
        for (const role of CONFIG.reactionRoles) { await sentMessage.react(role.emoji); }
    }

    // Mini-games and Utility
    if (command === 'rps') {
        const choices = ['🪨', '📄', '✂️'];
        const userChoice = args[0];
        if (!userChoice || !['rock', 'paper', 'scissors', 'r', 'p', 's'].includes(userChoice.toLowerCase())) {
            return message.reply("⚠️ Usage: `!rps <rock|paper|scissors>`");
        }
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        let result;
        let userEmoji = '🪨';
        if (userChoice.startsWith('p')) userEmoji = '📄';
        if (userChoice.startsWith('s')) userEmoji = '✂️';

        if (userEmoji === botChoice) { result = "It's a Tie! 🤝"; } 
        else if ((userEmoji === '🪨' && botChoice === '✂️') || (userEmoji === '📄' && botChoice === '🪨') || (userEmoji === '✂️' && botChoice === '📄')) { result = "You Win! 🎉"; } 
        else { result = "I Win! 🤖"; }

        const embed = new EmbedBuilder()
            .setTitle('🪨 Rock, Paper, Scissors ✂️')
            .setDescription(`You: ${userEmoji}\nMe: ${botChoice}\n\n**${result}**`)
            .setColor(getSafeColor(CONFIG.setupColor));
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'guess') {
        const number = Math.floor(Math.random() * 10) + 1;
        const userGuess = parseInt(args[0]);
        if (!userGuess || isNaN(userGuess)) return message.reply("⚠️ Usage: `!guess <number 1-10>`");
        if (userGuess === number) message.reply(`🎉 **Correct!** The number was indeed **${number}**.`);
        else message.reply(`❌ **Wrong!** I was thinking of **${number}**. Try again!`);
    }

    if (command === 'duel') {
        const target = message.mentions.users.first();
        if (!target) return message.reply("⚠️ Mention someone to duel! Usage: `!duel @User`");
        if (target.id === message.author.id) return message.reply("❌ You cannot duel yourself.");
        if (target.bot) return message.reply("❌ You cannot duel a bot.");
        const winner = Math.random() > 0.5 ? message.author : target;
        const embed = new EmbedBuilder().setTitle('⚔️ The Duel Begins!').setDescription(`**${message.author.username}** 🆚 **${target.username}**\n\n...fighting...\n\n🏆 **Winner:** ${winner}`).setColor('#e74c3c');
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'slots') {
        const items = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
        const r1 = items[Math.floor(Math.random() * items.length)];
        const r2 = items[Math.floor(Math.random() * items.length)];
        const r3 = items[Math.floor(Math.random() * items.length)];
        const isWin = (r1 === r2 && r2 === r3);
        const embed = new EmbedBuilder().setTitle('🎰 Slot Machine').setDescription(`[ ${r1} | ${r2} | ${r3} ]\n\n${isWin ? '**JACKPOT! You won!** 💰' : 'You lost. Better luck next time.'}`).setColor(isWin ? '#f1c40f' : '#2f3136');
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'trivia') {
        const questions = [
            { q: "What is the capital of France?", a: ["paris"] },
            { q: "How many wheels does a standard semi-truck have?", a: ["18"] },
            { q: "What color is the sky on a clear day?", a: ["blue"] },
            { q: "What company is this bot for?", a: ["northstar", "northstar vtc", "nsl"] }
        ];
        const trivia = questions[Math.floor(Math.random() * questions.length)];
        await message.channel.send(`🧠 **Trivia Time!**\nQuestion: ${trivia.q}\n*(You have 10 seconds to answer)*`);
        const filter = response => response.author.id === message.author.id;
        try {
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 10000, errors: ['time'] });
            if (trivia.a.includes(collected.first().content.toLowerCase())) message.channel.send(`✅ **Correct!** Good job.`);
            else message.channel.send(`❌ **Wrong!** The answer was: ${trivia.a[0]}`);
        } catch (e) { message.channel.send(`⏰ **Time's up!** The answer was: ${trivia.a[0]}`); }
    }

    if (command === 'wyr') {
        const scenarios = [
            "Would you rather always have to say everything on your mind OR never be able to speak again?",
            "Would you rather have a truck that never runs out of fuel OR a truck that never needs repairs?",
            "Would you rather drive in snow forever OR drive in rain forever?",
            "Would you rather fight 100 duck-sized horses OR 1 horse-sized duck?"
        ];
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        const embed = new EmbedBuilder().setTitle('🤔 Would You Rather...').setDescription(scenario).setColor(getSafeColor(CONFIG.setupColor)).setFooter({ text: 'Reply with your choice!' });
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'math') {
        const num1 = Math.floor(Math.random() * 50) + 1;
        const num2 = Math.floor(Math.random() * 50) + 1;
        const ops = ['+', '-', '*'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let answer;
        if (op === '+') answer = num1 + num2;
        if (op === '-') answer = num1 - num2;
        if (op === '*') answer = num1 * num2;
        message.channel.send(`🧮 **Solve this:** \`${num1} ${op} ${num2}\` (10 seconds)`);
        const filter = response => response.author.id === message.author.id;
        try {
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 10000, errors: ['time'] });
            if (parseInt(collected.first().content) === answer) message.channel.send("✅ **Correct!** Math genius.");
            else message.channel.send(`❌ **Wrong.** The answer was ${answer}.`);
        } catch (e) { message.channel.send(`⏰ **Time's up!** The answer was ${answer}.`); }
    }

    if (command === 'search') {
        const locations = ['Car', 'Grass', 'Pockets', 'Sofa', 'Truck Cabin'];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const outcomes = [{ text: "found a shiny coin! 🪙", good: true }, { text: "found an old receipt.", good: false }, { text: "found a spider! 🕷️", good: false }, { text: "found a lost diamond ring! 💍", good: true }, { text: "found absolutely nothing.", good: false }];
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        message.reply(`🔍 You searched the **${location}** and ${outcome.text}`);
    }

    if (command === 'delivery') {
        const cities = ['London', 'Paris', 'Berlin', 'Amsterdam', 'Rome', 'Madrid', 'Prague'];
        const cargos = ['Medical Vaccines', 'Heavy Machinery', 'Electronics', 'Fresh Fruit', 'Furniture'];
        const start = cities[Math.floor(Math.random() * cities.length)];
        let end = cities[Math.floor(Math.random() * cities.length)];
        while (start === end) { end = cities[Math.floor(Math.random() * cities.length)]; } 
        const cargo = cargos[Math.floor(Math.random() * cargos.length)];
        const distance = Math.floor(Math.random() * 2000) + 100; // km
        const earned = distance * 2; 
        const embed = new EmbedBuilder().setTitle('🚚 Delivery Completed!').setColor(getSafeColor(CONFIG.setupColor)).addFields({ name: '📦 Cargo', value: cargo, inline: true }, { name: '📍 Route', value: `${start} ➡️ ${end}`, inline: true }, { name: '📏 Distance', value: `${distance} km`, inline: true }, { name: '💵 Earnings', value: `$${earned}`, inline: true }).setThumbnail('https://cdn-icons-png.flaticon.com/512/759/759089.png').setFooter({ text: 'NorthStar Logistics • Keep on trucking!' });
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'afk') {
        const currentName = message.member.displayName;
        const afkPrefix = "[AFK] ";
        try {
            if (currentName.startsWith(afkPrefix)) {
                await message.member.setNickname(currentName.replace(afkPrefix, ""));
                return message.reply("👋 Welcome back!");
            } else {
                await message.member.setNickname(afkPrefix + currentName);
                return message.reply(`💤 AFK mode active.`);
            }
        } catch (err) { return message.reply("❌ Error changing nickname."); }
    }
});

// --- INTERACTION HANDLING (TICKETS) ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const category = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`modal_${category}`).setTitle(`${category.toUpperCase()}`);
        const q1 = new TextInputBuilder().setCustomId('details').setLabel("Details").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(q1));
        return await interaction.showModal(modal);
    }
    
    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        try {
            const category = interaction.customId.split('_')[1];
            const channel = await interaction.guild.channels.create({
                name: `${category}-${interaction.user.username}`, type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
                    { id: CONFIG.staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel] }
                ],
            });
            const embed = new EmbedBuilder().setTitle(`New Ticket`).setDescription(`Welcome ${interaction.user}. Please explain your issue below.`).setColor('#3498db');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel(CONFIG.closeButtonLabel).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('claim_ticket').setLabel(CONFIG.claimButtonLabel).setStyle(ButtonStyle.Success)
            );
            await channel.send({ content: `${interaction.user} <@&${CONFIG.staffRoleId}>`, embeds: [embed], components: [row] });
            await interaction.editReply(`✅ Ticket created: ${channel}`);
        } catch (e) { await interaction.editReply("❌ Error creating ticket."); }
    }

    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(CONFIG.staffRoleId)) return interaction.reply({ content: "⚠️ Only staff!", flags: [MessageFlags.Ephemeral] });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel(CONFIG.closeButtonLabel).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claim_ticket').setLabel(`Claimed by ${interaction.user.username}`).setStyle(ButtonStyle.Success).setDisabled(true)
        );
        await interaction.message.edit({ components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply("🔒 Closing ticket...");
        try {
            const attachment = await discordTranscripts.createTranscript(interaction.channel);
            const logChannel = interaction.guild.channels.cache.get(CONFIG.transcriptChannelId);
            if (logChannel) logChannel.send({ content: `Transcript: ${interaction.channel.name}`, files: [attachment] });
        } catch (e) { console.error("Transcript error", e); }
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

// Use Environment Variable for Token
client.login(process.env.TOKEN);
