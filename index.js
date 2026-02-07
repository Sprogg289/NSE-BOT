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
    REST,
    Routes,
    SlashCommandBuilder 
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
    // 🟢 CRITICAL: Added more Partials to prevent crashes on old/uncached messages when users use "!"
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember] 
});

// --- SECURE CONFIGURATION ---
const CONFIG = {
    prefix: process.env.PREFIX || '!',
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    staffRoleId: process.env.STAFF_ROLE_ID, 
    transcriptChannelId: process.env.TRANSCRIPT_CHANNEL_ID, 
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID, 
    onlineLogChannelId: process.env.ONLINE_LOG_CHANNEL_ID, 
    countingChannelId: process.env.COUNTING_CHANNEL_ID, 
    loggingChannelId: process.env.LOGGING_CHANNEL_ID, 
    setupColor: '#3498db',

    reactionRoles: [
        { emoji: '📣', roleId: process.env.ROLE_ANNOUNCEMENT_ID, name: '| Announcements Ping' },
        { emoji: '📕', roleId: process.env.ROLE_APPLICATION_ID, name: '| Application Ping' },
        { emoji: '🗓️', roleId: process.env.ROLE_EVENT_ID, name: '| Event Ping' },
        { emoji: '📍', roleId: process.env.ROLE_VTC_ID, name: '| VTC update Ping' },
        { emoji: '🌐', roleId: process.env.ROLE_DISCORD_ID, name: '| Discord Update Ping' },
    ],

    ticketEmbed: {
        title: '📩 NorthStar Support Center',
        description: 'Welcome to our official support portal.\nSelect a category below to open a ticket.',
        color: '#3498db', 
        image: 'https://media.discordapp.net/attachments/1077664866539683982/1446830775612866722/New_Project_26.png', 
    },
    ticketMenu: {
        placeholder: '🔎 Choose a category to start...',
        supportLabel: 'General Support',
        reportLabel: 'Player Report',
    },
    closeButtonLabel: '🔒 Close & Archive Ticket',
    claimButtonLabel: '🙋‍♂️ Claim Ticket', 
};

// --- SLASH COMMANDS DEFINITION ---
const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('uptime').setDescription('Check how long the bot has been online'),
    new SlashCommandBuilder().setName('help').setDescription('Show all available commands'),
    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('Deploy the ticket system (Staff Only)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),
].map(command => command.toJSON());

async function registerSlashCommands() {
    if (!CONFIG.token || !CONFIG.clientId) {
        console.error("❌ Cannot sync commands: Missing TOKEN or CLIENT_ID in .env");
        return;
    }
    const rest = new REST({ version: '10' }).setToken(CONFIG.token);
    try {
        console.log('⏳ Syncing Slash (/) commands...');
        await rest.put(Routes.applicationCommands(CONFIG.clientId), { body: commands });
        console.log('✅ Slash Commands are ready!');
    } catch (error) {
        console.error('❌ Slash Command Error:', error);
    }
}

// --- GLOBAL VARIABLES FOR COUNTING ---
let currentCount = 0;
let lastCounterId = null;
const COUNT_FILE = './countData.json'; 

function loadCount() {
    try {
        if (fs.existsSync(COUNT_FILE)) {
            const data = JSON.parse(fs.readFileSync(COUNT_FILE, 'utf8'));
            currentCount = data.count || 0;
            lastCounterId = data.lastUser || null;
        }
    } catch (e) { console.error("Error loading count:", e); }
}

function saveCount() {
    try {
        const data = { count: currentCount, lastUser: lastCounterId };
        fs.writeFileSync(COUNT_FILE, JSON.stringify(data, null, 4));
    } catch (e) { console.error("Error saving count:", e); }
}

async function sendLog(guild, embed) {
    if (!CONFIG.loggingChannelId || !guild) return;
    try {
        const logChannel = await guild.channels.fetch(CONFIG.loggingChannelId).catch(() => null);
        if (logChannel) await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.log("Log error:", error.message);
    }
}

// --- CLIENT READY ---
client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    loadCount();
    await registerSlashCommands();

    if (CONFIG.onlineLogChannelId) {
        const channel = client.channels.cache.get(CONFIG.onlineLogChannelId);
        if (channel) await channel.send('✅ **System Online:** NorthStar Bot is now using Slash Commands!').catch(() => {});
    }
});

// --- INTERACTION HANDLER (SLASH COMMANDS) ---
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply(`🏓 Pong! Latency: ${client.ws.ping}ms`);
    }

    if (interaction.commandName === 'uptime') {
        const hours = Math.floor(client.uptime / 3600000);
        const minutes = Math.floor((client.uptime % 3600000) / 60000);
        await interaction.reply(`The bot has been up for **${hours}h ${minutes}m**.`);
    }

    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🚚 NorthStar Commands')
            .setColor(CONFIG.setupColor)
            .setDescription('We have moved to **Slash Commands**! Type `/` to see all available options.')
            .addFields(
                { name: '👥 General', value: '`/ping`, `/uptime`, `/help`' },
                { name: '🛠️ Staff', value: '`/setup-ticket` (Admin only)' }
            );
        await interaction.reply({ embeds: [helpEmbed] });
    }

    if (interaction.commandName === 'setup-ticket') {
        const embed = new EmbedBuilder()
            .setTitle(CONFIG.ticketEmbed.title)
            .setDescription(CONFIG.ticketEmbed.description)
            .setColor(CONFIG.ticketEmbed.color)
            .setImage(CONFIG.ticketEmbed.image);
        
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder(CONFIG.ticketMenu.placeholder)
                .addOptions([
                    { label: CONFIG.ticketMenu.supportLabel, value: 'support', emoji: '🛠️' },
                    { label: CONFIG.ticketMenu.reportLabel, value: 'report', emoji: '⚠️' }
                ])
        );
        await interaction.reply({ embeds: [embed], components: [menu] });
    }
});

// --- MESSAGE HANDLER (GUARDS FOR "!") ---
client.on(Events.MessageCreate, async (message) => {
    if (!message.author || message.author.bot || !message.guild) return;

    // Counting Logic
    if (CONFIG.countingChannelId && message.channel.id === CONFIG.countingChannelId) {
        const userNumber = parseInt(message.content);
        if (isNaN(userNumber)) return message.delete().catch(() => {}); 
        if (userNumber === currentCount + 1) {
            if (lastCounterId === message.author.id) {
                message.reply("⛔ You cannot count twice in a row! Resetting to 0.");
                currentCount = 0; lastCounterId = null;
            } else {
                currentCount++; lastCounterId = message.author.id; message.react('✅').catch(() => {});
            }
            saveCount();
        } else {
            message.channel.send(`💀 **${message.author.username}** ruined the streak at **${currentCount}**! Reset to 0.`);
            currentCount = 0; lastCounterId = null;
            saveCount();
        }
        return;
    }

    // Redirect "!" users to "/"
    if (message.content.startsWith(CONFIG.prefix)) {
        const args = message.content.slice(CONFIG.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (['ping', 'help', 'uptime'].includes(command)) {
            return message.reply(`⚠️ We have switched to Slash Commands! Please type \`/${command}\` instead.`);
        }
    }
});

// --- LOGGING (WITH PARTIAL PROTECTION) ---
client.on(Events.MessageDelete, async (message) => {
    if (message.partial) return; 
    if (!message.guild || !message.author || message.author.bot) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Deleted' })
        .setColor('#f1c40f') 
        .addFields(
            { name: 'Author', value: `${message.author.tag || 'Unknown User'}`, inline: true }, 
            { name: 'Channel', value: `${message.channel}`, inline: true }, 
            { name: 'Content', value: (message.content || '[Image/Embed]').substring(0, 1024) }
        )
        .setTimestamp();
    sendLog(message.guild, embed);
});

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (oldMsg.partial) await oldMsg.fetch().catch(() => {});
    if (!oldMsg.author || oldMsg.author.bot || oldMsg.content === newMsg.content) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Edited' })
        .setColor('#3498db') 
        .addFields(
            { name: 'Author', value: `${oldMsg.author.tag || 'Unknown'}`, inline: true }, 
            { name: 'Before', value: (oldMsg.content || '[None]').substring(0, 1024) }, 
            { name: 'After', value: (newMsg.content || '[None]').substring(0, 1024) }
        )
        .setTimestamp();
    sendLog(oldMsg.guild, embed);
});

client.login(CONFIG.token);
