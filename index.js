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
    AuditLogEvent,
    REST,            // 🟢 ADDED: Required for Slash Commands
    Routes,          // 🟢 ADDED: Required for Slash Commands
    SlashCommandBuilder // 🟢 ADDED: Required for Slash Commands
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
const CONFIG = {
    prefix: process.env.PREFIX || '!',
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID, // 🟢 ADDED: Must be in Railway Variables
    staffRoleId: process.env.STAFF_ROLE_ID, 
    transcriptChannelId: process.env.TRANSCRIPT_CHANNEL_ID, 
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID, 
    onlineLogChannelId: process.env.ONLINE_LOG_CHANNEL_ID, 
    countingChannelId: process.env.COUNTING_CHANNEL_ID, 
    loggingChannelId: process.env.LOGGING_CHANNEL_ID, 
    driverRoleId: process.env.DRIVER_ROLE_ID, 
    seniorDriverRoleId: process.env.SENIOR_DRIVER_ROLE_ID, 
    setupColor: '#3498db',

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

// --- SLASH COMMANDS DEFINITION ---
const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('uptime').setDescription('Check how long the bot has been online'),
    new SlashCommandBuilder().setName('help').setDescription('Show all available commands'),
].map(command => command.toJSON());

// --- SLASH COMMAND REGISTRATION FUNCTION ---
async function registerSlashCommands() {
    if (!CONFIG.token || !CONFIG.clientId) {
        console.log("⚠️ Missing TOKEN or CLIENT_ID. Slash commands cannot be registered.");
        return;
    }
    const rest = new REST({ version: '10' }).setToken(CONFIG.token);
    try {
        console.log('⏳ Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(CONFIG.clientId), { body: commands });
        console.log('✅ / Commands synced successfully!');
    } catch (error) {
        console.error('❌ Error syncing / commands:', error);
    }
}

// --- GLOBAL VARIABLES FOR COUNTING ---
let currentCount = 0;
let lastCounterId = null;
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
    } catch (e) { console.error("Error loading count:", e); }
}

function saveCount() {
    try {
        const data = { count: currentCount, lastUser: lastCounterId };
        fs.writeFileSync(COUNT_FILE, JSON.stringify(data, null, 4));
    } catch (e) { console.error("Error saving count:", e); }
}

// --- CLIENT READY ---
client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.tag} is online and fully updated!`);
    loadCount();
    await registerSlashCommands(); // 🟢 Trigger command registration

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

// --- INTERACTION HANDLER (For Slash Commands) ---
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply(`🏓 Pong! Latency: ${client.ws.ping}ms`);
    }

    if (interaction.commandName === 'uptime') {
        const uptime = client.uptime / 1000 / 60 / 60 | 0;
        await interaction.reply(`The bot has been up for ${uptime} hours.`);
    }

    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder().setTitle('NorthStar Commands')
            .addFields(
                { name: '🛡️ Moderation', value: '`!warn`, `!kick`, `!ban`, `!mute`' },
                { name: '🛠️ Staff', value: '`!setup-ticket`, `!setup-reaction`, `!setup-count`' },
                { name: '👥 Community', value: '`/ping`, `!afk`, `/uptime`' },
                { name: '🎮 Mini games', value: '`!rps`, `!guess`, `!duel`, `!slots`, `!trivia`, `!wyr`, `!math`, `!search`, `!delivery`' }
            ).setColor(getSafeColor(CONFIG.setupColor));
        await interaction.reply({ embeds: [helpEmbed] });
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

// Log Event Listeners
client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Deleted', iconURL: 'https://cdn-icons-png.flaticon.com/512/3221/3221897.png' })
        .setColor('#f1c40f') 
        .addFields({ name: 'Author', value: `${message.author.tag}`, inline: true }, { name: 'Channel', value: `${message.channel}`, inline: true }, { name: 'Content', value: message.content || '[Image/Embed]' })
        .setTimestamp();
    sendLog(message.guild, embed);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Edited', iconURL: 'https://cdn-icons-png.flaticon.com/512/1159/1159633.png' })
        .setColor('#3498db') 
        .addFields({ name: 'Author', value: `${oldMessage.author.tag}`, inline: true }, { name: 'Channel', value: `${oldMessage.channel}`, inline: true }, { name: 'Before', value: oldMessage.content.substring(0, 1024) || '[None]' }, { name: 'After', value: newMessage.content.substring(0, 1024) || '[None]' })
        .setTimestamp();
    sendLog(oldMessage.guild, embed);
});

client.on(Events.GuildBanAdd, async (ban) => {
    const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const log = fetchedLogs.entries.first();
    const executor = log ? log.executor.tag : 'Unknown';
    const reason = log ? log.reason : 'No reason provided';
    const embed = new EmbedBuilder().setAuthor({ name: 'Member Banned', iconURL: 'https://cdn-icons-png.flaticon.com/512/1603/1603806.png' }).setColor('#e74c3c').setThumbnail(ban.user.displayAvatarURL()).addFields({ name: 'User', value: `${ban.user.tag}`, inline: true }, { name: 'Banned By', value: executor, inline: true }, { name: 'Reason', value: reason }).setTimestamp();
    sendLog(ban.guild, embed);
});

client.on(Events.GuildBanRemove, async (ban) => {
    const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
    const log = fetchedLogs.entries.first();
    const executor = log ? log.executor.tag : 'Unknown';
    const embed = new EmbedBuilder().setAuthor({ name: 'Member Unbanned', iconURL: 'https://cdn-icons-png.flaticon.com/512/1603/1603806.png' }).setColor('#2ecc71').addFields({ name: 'User', value: `${ban.user.tag}`, inline: true }, { name: 'Unbanned By', value: executor, inline: true }).setTimestamp();
    sendLog(ban.guild, embed);
});

client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder().setAuthor({ name: 'Channel Created', iconURL: 'https://cdn-icons-png.flaticon.com/512/992/992651.png' }).setColor('#2ecc71').setDescription(`Channel: ${channel} (${channel.name})`).setTimestamp();
    sendLog(channel.guild, embed);
});

client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder().setAuthor({ name: 'Channel Deleted', iconURL: 'https://cdn-icons-png.flaticon.com/512/1214/1214428.png' }).setColor('#e74c3c').setDescription(`Channel Name: **${channel.name}**`).setTimestamp();
    sendLog(channel.guild, embed);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (oldMember.nickname !== newMember.nickname) {
        const embed = new EmbedBuilder().setAuthor({ name: 'Nickname Changed', iconURL: 'https://cdn-icons-png.flaticon.com/512/1250/1250689.png' }).setColor('#9b59b6').addFields({ name: 'User', value: `${newMember.user.tag}`, inline: true }, { name: 'Old Name', value: oldMember.nickname || oldMember.user.username, inline: true }, { name: 'New Name', value: newMember.nickname || newMember.user.username, inline: true }).setTimestamp();
        sendLog(newMember.guild, embed);
    }
});

client.on(Events.GuildMemberRemove, async (member) => {
    setTimeout(async () => {
        const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
        const kickLog = fetchedLogs.entries.first();
        if (kickLog && kickLog.target.id === member.id && (kickLog.createdTimestamp > (Date.now() - 10000))) {
            const embed = new EmbedBuilder().setAuthor({ name: 'Member Kicked', iconURL: 'https://cdn-icons-png.flaticon.com/512/924/924922.png' }).setColor('#e67e22').setThumbnail(member.user.displayAvatarURL()).addFields({ name: 'User', value: `${member.user.tag}`, inline: true }, { name: 'Kicked By', value: `${kickLog.executor.tag}`, inline: true }, { name: 'Reason', value: kickLog.reason || 'No reason provided' }).setTimestamp();
            sendLog(member.guild, embed);
        }
    }, 1000);
});

client.on(Events.GuildRoleDelete, async (role) => {
    const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
    const deletionLog = fetchedLogs.entries.first();
    const executor = (deletionLog && deletionLog.target.id === role.id) ? deletionLog.executor.tag : 'Unknown';
    const embed = new EmbedBuilder().setAuthor({ name: 'Role Deleted', iconURL: 'https://cdn-icons-png.flaticon.com/512/6861/6861326.png' }).setColor('#2f3136').addFields({ name: 'Role', value: role.name, inline: true }, { name: 'Deleted By', value: executor, inline: true }).setTimestamp();
    sendLog(role.guild, embed);
});

// --- MAIN MESSAGE COMMANDS (!) ---
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

    if (command === 'ping') return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
    if (command === 'uptime') return message.reply(`The bot been up for ${client.uptime / 1000 / 60 / 60 | 0} hours.`);

    // Setup Counting
    if (command === 'setup-count' && isStaff) {
        try {
            const countChannel = await message.guild.channels.create({
                name: '🔢-counting', type: ChannelType.GuildText,
                permissionOverwrites: [{ id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]
            });
            CONFIG.countingChannelId = countChannel.id; 
            currentCount = 0;
            saveCount(); 
            await message.channel.send(`✅ Channel created: ${countChannel}.\n**Important:** Add \`COUNTING_CHANNEL_ID=${countChannel.id}\` to Railway.`);
            await countChannel.send("🏁 **Start Counting!** The first number is **1**.");
        } catch (e) { message.reply("❌ Error creating channel."); }
        return;
    }

    // Moderation Commands
    if (command === 'kick') {
        if (!isStaff) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target || !target.kickable) return message.reply("❌ Cannot kick.");
        await target.kick(args.slice(1).join(" "));
        message.channel.send(`👢 **${target.user.tag}** kicked.`);
    }

    if (command === 'ban') {
        if (!isStaff) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target || !target.bannable) return message.reply("❌ Cannot ban.");
        await target.ban({ reason: args.slice(1).join(" ") });
        message.channel.send(`🔨 **${target.user.tag}** banned.`);
    }

    if (command === 'warn') {
        if (!isStaff) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target) return message.reply("⚠️ Mention a user.");
        const reason = args.slice(1).join(" ") || "No reason";
        try { await target.send(`⚠️ You were warned in NorthStar for: ${reason}`); } catch (e) {}
        message.channel.send(`⚠️ **${target.user.tag}** warned.`);
    }

    // Reaction Roles & Tickets
    if (command === 'setup-ticket' && isStaff) {
        const embed = new EmbedBuilder().setTitle(CONFIG.ticketEmbed.title).setDescription(CONFIG.ticketEmbed.description).setColor(getSafeColor(CONFIG.ticketEmbed.color)).setImage(CONFIG.ticketEmbed.image);
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder(CONFIG.ticketMenu.placeholder).addOptions([{ label: CONFIG.ticketMenu.supportLabel, value: 'support', emoji: '🛠️' }, { label: CONFIG.ticketMenu.reportLabel, value: 'report', emoji: '⚠️' }, { label: CONFIG.ticketMenu.partnershipLabel, value: 'partnership', emoji: '🤝' }, { label: CONFIG.ticketMenu.inviteLabel, value: 'invite', emoji: '🗓️' }, { label: CONFIG.ticketMenu.contentManagementLabel, value: 'contentManagement', emoji: '📋' }]));
        return message.channel.send({ embeds: [embed], components: [menu] });
    }

    if (command === 'setup-reaction' && isStaff) {
        const reactionEmbed = new EmbedBuilder().setTitle('🎭 Roles').setDescription(CONFIG.reactionRoles.map(r => `${r.emoji} : **${r.name}**`).join('\n')).setColor(getSafeColor(CONFIG.setupColor));
        const sentMessage = await message.channel.send({ embeds: [reactionEmbed] });
        for (const role of CONFIG.reactionRoles) { await sentMessage.react(role.emoji); }
    }

    // Mini Games
    if (command === 'rps') {
        const choices = ['🪨', '📄', '✂️'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        message.channel.send(`I chose ${botChoice}!`);
    }

    if (command === 'afk') {
        const currentName = message.member.displayName;
        if (currentName.startsWith("[AFK] ")) {
            await message.member.setNickname(currentName.replace("[AFK] ", ""));
            message.reply("👋 Back!");
        } else {
            await message.member.setNickname("[AFK] " + currentName);
            message.reply("💤 AFK.");
        }
    }
});

// --- REACTION HANDLING ---
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    const roleData = CONFIG.reactionRoles.find(r => r.emoji === reaction.emoji.name);
    if (roleData) { const member = reaction.message.guild.members.cache.get(user.id); member?.roles.add(roleData.roleId).catch(() => {}); }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    const roleData = CONFIG.reactionRoles.find(r => r.emoji === reaction.emoji.name);
    if (roleData) { const member = reaction.message.guild.members.cache.get(user.id); member?.roles.remove(roleData.roleId).catch(() => {}); }
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
        const category = interaction.customId.split('_')[1];
        const channel = await interaction.guild.channels.create({
            name: `${category}-${interaction.user.username}`, type: ChannelType.GuildText,
            permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }, { id: CONFIG.staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel] }],
        });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel(CONFIG.closeButtonLabel).setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('claim_ticket').setLabel(CONFIG.claimButtonLabel).setStyle(ButtonStyle.Success));
        await channel.send({ content: `${interaction.user} Support needed!`, components: [row] });
        await interaction.editReply(`✅ Ticket: ${channel}`);
    }

    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(CONFIG.staffRoleId)) return interaction.reply({ content: "⚠️ Staff only!", flags: [MessageFlags.Ephemeral] });
        await interaction.reply(`🙋‍♂️ Claimed by ${interaction.user.username}`);
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply("🔒 Closing...");
        try {
            const attachment = await discordTranscripts.createTranscript(interaction.channel);
            const logChannel = interaction.guild.channels.cache.get(CONFIG.transcriptChannelId);
            if (logChannel) logChannel.send({ files: [attachment] });
        } catch (e) {}
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(CONFIG.token);
