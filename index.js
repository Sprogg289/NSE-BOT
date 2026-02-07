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
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember] 
});

// --- CONFIGURATION ---
const CONFIG = {
    // Note: Prefix is no longer needed for commands, but good for legacy ref
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
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

    ticketEmbed: {
        title: '📩 NorthStar Support Center',
        description: 'Welcome to our official support portal.\nSelect a category below to open a ticket. Our team is here to assist you.',
        color: '#3498db', 
        image: 'https://media.discordapp.net/attachments/1077664866539683982/1446830775612866722/New_Project_26.png', 
        footerText: 'NorthStar VTC • Reliability at every mile',
    },
    ticketMenu: {
        placeholder: '🔎 Choose a category...',
        options: [
            { label: 'General Support', value: 'support', emoji: '🛠️' },
            { label: 'Player Report', value: 'report', emoji: '⚠️' },
            { label: 'Partnership Request', value: 'partnership', emoji: '🤝' },
            { label: 'Invite Request', value: 'invite', emoji: '🗓️' },
            { label: 'Management Team', value: 'contentManagement', emoji: '📋' }
        ]
    }
};

// --- SLASH COMMANDS DEFINITION ---
const commands = [
    // Utility
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('uptime').setDescription('Check how long the bot has been online'),
    new SlashCommandBuilder().setName('help').setDescription('Show all available commands'),
    
    // Staff Setup (Admin only)
    new SlashCommandBuilder().setName('setup-ticket').setDescription('ADMIN: Setup the ticket system panel')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder().setName('setup-reaction').setDescription('ADMIN: Setup the reaction role panel')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    // Moderation
    new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
        .addUserOption(option => option.setName('target').setDescription('The user to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the warning').setRequired(true)),
    
    new SlashCommandBuilder().setName('kick').setDescription('Kick a user')
        .addUserOption(option => option.setName('target').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the kick').setRequired(false)),

    new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
        .addUserOption(option => option.setName('target').setDescription('The user to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the ban').setRequired(false)),

    new SlashCommandBuilder().setName('timeout').setDescription('Timeout (Mute) a user')
        .addUserOption(option => option.setName('target').setDescription('The user to timeout').setRequired(true))
        .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the timeout').setRequired(false)),

    // Mini-games (Example: RPS)
    new SlashCommandBuilder().setName('rps').setDescription('Play Rock Paper Scissors')
        .addStringOption(option => 
            option.setName('choice')
            .setDescription('Choose your move')
            .setRequired(true)
            .addChoices(
                { name: 'Rock', value: 'rock' },
                { name: 'Paper', value: 'paper' },
                { name: 'Scissors', value: 'scissors' }
            )
        )

].map(command => command.toJSON());

// --- REGISTER COMMANDS ---
async function registerSlashCommands() {
    if (!CONFIG.token || !CONFIG.clientId) {
        console.warn('⚠️  Missing TOKEN or CLIENT_ID in .env - Cannot register slash commands.');
        return;
    }
    const rest = new REST({ version: '10' }).setToken(CONFIG.token);
    try {
        console.log('⏳ Started refreshing application (/) commands.');
        // Registers commands globally. 
        // Note: Global updates can take up to 1 hour. For instant updates, use .applicationGuildCommands(clientId, guildId)
        await rest.put(Routes.applicationCommands(CONFIG.clientId), { body: commands });
        console.log('✅ / Commands synced successfully!');
    } catch (error) {
        console.error('❌ Error syncing / commands:', error);
    }
}

// --- COUNTING SYSTEM ---
let currentCount = 0;
let lastCounterId = null;
const COUNT_FILE = './countData.json'; 

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

// --- LOGGING UTILITY ---
async function sendLog(guild, embed) {
    if (!CONFIG.loggingChannelId || !guild) return;
    try {
        const logChannel = await guild.channels.fetch(CONFIG.loggingChannelId).catch(() => null);
        if (logChannel) await logChannel.send({ embeds: [embed] });
        else console.warn(`⚠️ Log channel ID ${CONFIG.loggingChannelId} not found or bot lacks permission.`);
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
        if (channel) await channel.send('✅ **System Online:** NorthStar Bot is ready via Slash Commands!').catch(() => {});
    }
    
    // Status
    client.user.setActivity('over NorthStar VTC', { type: 3 }); // "Watching over..."
});

// --- MAIN INTERACTION HANDLER (SLASH COMMANDS) ---
client.on(Events.InteractionCreate, async interaction => {
    // Handle Chat Commands
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member, guild } = interaction;

        // --- UTILITY ---
        if (commandName === 'ping') {
            await interaction.reply({ content: `🏓 Pong! Latency: ${client.ws.ping}ms`, flags: [MessageFlags.Ephemeral] });
        }

        if (commandName === 'uptime') {
            const uptime = Math.floor(client.uptime / 1000 / 60 / 60);
            await interaction.reply(`The bot has been up for ${uptime} hours.`);
        }

        if (commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setTitle('NorthStar Commands')
                .setColor(CONFIG.setupColor)
                .setDescription('Here are the available Slash Commands:')
                .addFields(
                    { name: '🛡️ Moderation', value: '`/warn`, `/kick`, `/ban`, `/timeout`' },
                    { name: '🛠️ Staff', value: '`/setup-ticket`, `/setup-reaction`' },
                    { name: '👥 Community', value: '`/ping`, `/uptime`, `/rps`' }
                )
                .setFooter({ text: 'Use / before any command' });
            await interaction.reply({ embeds: [helpEmbed], flags: [MessageFlags.Ephemeral] });
        }

        // --- SETUP COMMANDS (Staff Only) ---
        if (commandName === 'setup-ticket') {
            // Permission check handled by builder, but double check logic if needed
            const embed = new EmbedBuilder()
                .setTitle(CONFIG.ticketEmbed.title)
                .setDescription(CONFIG.ticketEmbed.description)
                .setColor(CONFIG.ticketEmbed.color)
                .setImage(CONFIG.ticketEmbed.image)
                .setFooter({ text: CONFIG.ticketEmbed.footerText });

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder(CONFIG.ticketMenu.placeholder)
                    .addOptions(CONFIG.ticketMenu.options)
            );

            await interaction.channel.send({ embeds: [embed], components: [menu] });
            await interaction.reply({ content: '✅ Ticket panel sent!', flags: [MessageFlags.Ephemeral] });
        }

        if (commandName === 'setup-reaction') {
            const reactionEmbed = new EmbedBuilder()
                .setTitle('🎭 Roles')
                .setDescription(CONFIG.reactionRoles.map(r => `${r.emoji} : **${r.name}**`).join('\n'))
                .setColor(CONFIG.setupColor);
            
            const sentMessage = await interaction.channel.send({ embeds: [reactionEmbed] });
            for (const role of CONFIG.reactionRoles) { await sentMessage.react(role.emoji).catch(() => {}); }
            await interaction.reply({ content: '✅ Reaction roles sent!', flags: [MessageFlags.Ephemeral] });
        }

        // --- MODERATION ---
        if (commandName === 'warn') {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
                return interaction.reply({ content: '❌ No permission.', flags: [MessageFlags.Ephemeral] });
            
            const target = options.getUser('target');
            const reason = options.getString('reason');
            
            const embed = new EmbedBuilder()
                .setTitle('⚠️ User Warned')
                .setColor('#f1c40f')
                .addFields(
                    { name: 'User', value: `${target.tag}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason }
                ).setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            sendLog(guild, embed);
        }

        if (commandName === 'kick') {
            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) 
                return interaction.reply({ content: '❌ No permission.', flags: [MessageFlags.Ephemeral] });

            const target = options.getMember('target');
            const reason = options.getString('reason') || 'No reason provided';

            if (!target) return interaction.reply({ content: '❌ User not found in server.', flags: [MessageFlags.Ephemeral] });
            if (!target.kickable) return interaction.reply({ content: '❌ I cannot kick this user (Check roles/hierarchy).', flags: [MessageFlags.Ephemeral] });

            await target.kick(reason);
            await interaction.reply({ content: `👢 **${target.user.tag}** has been kicked. Reason: ${reason}` });
        }

        if (commandName === 'ban') {
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) 
                return interaction.reply({ content: '❌ No permission.', flags: [MessageFlags.Ephemeral] });

            const targetUser = options.getUser('target');
            const reason = options.getString('reason') || 'No reason provided';

            try {
                await guild.members.ban(targetUser, { reason });
                await interaction.reply({ content: `🔨 **${targetUser.tag}** has been banned. Reason: ${reason}` });
            } catch (e) {
                await interaction.reply({ content: `❌ Failed to ban: ${e.message}`, flags: [MessageFlags.Ephemeral] });
            }
        }

        if (commandName === 'timeout') {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
                return interaction.reply({ content: '❌ No permission.', flags: [MessageFlags.Ephemeral] });

            const target = options.getMember('target');
            const minutes = options.getInteger('minutes');
            const reason = options.getString('reason') || 'No reason provided';

            if (!target) return interaction.reply({ content: '❌ User not found.', flags: [MessageFlags.Ephemeral] });
            if (!target.moderatable) return interaction.reply({ content: '❌ I cannot timeout this user.', flags: [MessageFlags.Ephemeral] });

            await target.timeout(minutes * 60 * 1000, reason);
            await interaction.reply({ content: `🤐 **${target.user.tag}** timed out for ${minutes} minutes.` });
        }

        // --- MINI GAMES (Example) ---
        if (commandName === 'rps') {
            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            const userChoice = options.getString('choice');
            
            let result;
            if (userChoice === botChoice) result = "It's a Tie! 👔";
            else if (
                (userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'paper' && botChoice === 'rock') ||
                (userChoice === 'scissors' && botChoice === 'paper')
            ) result = "You Win! 🎉";
            else result = "You Lose! 🤖";

            await interaction.reply(`You chose **${userChoice}**. I chose **${botChoice}**.\n**${result}**`);
        }
    }

    // --- TICKET SYSTEM LOGIC ---
    // Handle Dropdown Selection
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const category = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`modal_${category}`).setTitle(`${category.toUpperCase()}`);
        const q1 = new TextInputBuilder().setCustomId('details').setLabel("Details").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(q1));
        await interaction.showModal(modal);
    }
    
    // Handle Modal Submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_')) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const category = interaction.customId.split('_')[1];
        
        // Create Private Ticket Channel
        const channel = await interaction.guild.channels.create({
            name: `${category}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
                { id: CONFIG.staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel] }
            ],
        });

        // Ticket Controls
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close & Archive').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ Claim Ticket').setStyle(ButtonStyle.Success)
        );

        const details = interaction.fields.getTextInputValue('details');
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${category.toUpperCase()} Ticket`)
            .setDescription(`Thank you for contacting support.\n\n**User:** ${interaction.user}\n**Details:**\n${details}`)
            .setColor('#3498db');

        await channel.send({ content: `${interaction.user} <@&${CONFIG.staffRoleId}>`, embeds: [welcomeEmbed], components: [row] });
        await interaction.editReply(`✅ Ticket created: ${channel}`);
    }

    // Handle Buttons (Close/Claim)
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            await interaction.reply("🔒 Saving transcript and closing...");
            try {
                // Generate Transcript
                const attachment = await discordTranscripts.createTranscript(interaction.channel);
                const logChannel = interaction.guild.channels.cache.get(CONFIG.transcriptChannelId);
                if (logChannel) {
                    await logChannel.send({ 
                        content: `**Ticket Closed:** ${interaction.channel.name} by ${interaction.user.tag}`,
                        files: [attachment] 
                    });
                }
            } catch (e) { console.error("Transcript error:", e); }
            
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
        
        if (interaction.customId === 'claim_ticket') {
            await interaction.reply({ content: `👮‍♂️ Ticket claimed by ${interaction.user}!`, flags: [MessageFlags.Ephemeral] });
            await interaction.channel.send(`👮‍♂️ **${interaction.user}** is now handling this ticket.`);
        }
    }
});

// --- WELCOME & LOGGING EVENTS ---

// 1. WELCOME
client.on(Events.GuildMemberAdd, async (member) => {
    if (!CONFIG.welcomeChannelId) return console.warn("⚠️ Welcome Channel ID missing in config.");
    const channel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);
    if (!channel) return console.warn("⚠️ Welcome Channel not found (check permissions/ID).");

    const welcomeEmbed = new EmbedBuilder()
        .setTitle(`👋 Welcome to NorthStar VTC!`) 
        .setDescription(`Hello ${member}, we are thrilled to have you here!\nIf you wish to join our driver team, please apply in the application channel.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setImage('https://cdn.discordapp.com/attachments/1077664866539683982/1457809010119151812/Welcome_message.png')
        .setColor(CONFIG.setupColor) 
        .setFooter({ text: 'NorthStar Logistics • Reliability at every mile' }) 
        .setTimestamp();

    channel.send({ content: `Welcome ${member}!`, embeds: [welcomeEmbed] }).catch(console.error);
});

// 2. MESSAGE DELETE LOG
client.on(Events.MessageDelete, async (message) => {
    if (message.partial || !message.guild || !message.author || message.author.bot) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Deleted', iconURL: message.author.displayAvatarURL() })
        .setColor('#e74c3c') 
        .addFields(
            { name: 'Author', value: `${message.author.tag}`, inline: true }, 
            { name: 'Channel', value: `${message.channel}`, inline: true }, 
            { name: 'Content', value: (message.content || '[Image/Embed]').substring(0, 1024) }
        )
        .setFooter({ text: `ID: ${message.id}` })
        .setTimestamp();
    sendLog(message.guild, embed);
});

// 3. MESSAGE EDIT LOG
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (oldMessage.partial) await oldMessage.fetch().catch(() => {});
    if (newMessage.partial) await newMessage.fetch().catch(() => {});
    
    if (!oldMessage.guild || !oldMessage.author || oldMessage.author.bot || oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Message Edited', iconURL: oldMessage.author.displayAvatarURL() })
        .setColor('#3498db') 
        .addFields(
            { name: 'Author', value: `${oldMessage.author.tag}`, inline: true }, 
            { name: 'Channel', value: `${oldMessage.channel}`, inline: true }, 
            { name: 'Before', value: (oldMessage.content || '[None]').substring(0, 1024) }, 
            { name: 'After', value: (newMessage.content || '[None]').substring(0, 1024) }
        )
        .setTimestamp();
    sendLog(oldMessage.guild, embed);
});

// 4. BAN LOG
client.on(Events.GuildBanAdd, async (ban) => {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Member Banned', iconURL: ban.user.displayAvatarURL() })
        .setColor('#8B0000') // Dark Red
        .addFields({ name: 'User', value: `${ban.user.tag}` })
        .setTimestamp();
        
    // Attempt to fetch executor from audit logs
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const log = fetchedLogs.entries.first();
        if (log && log.target.id === ban.user.id) {
            embed.addFields(
                { name: 'Banned By', value: `${log.executor.tag}`, inline: true },
                { name: 'Reason', value: `${log.reason || 'No reason'}` }
            );
        }
    } catch (e) { console.error(e); }

    sendLog(ban.guild, embed);
});

// --- COUNTING CHANNEL LOGIC (Only Text Command Logic remaining) ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (CONFIG.countingChannelId && message.channel.id === CONFIG.countingChannelId) {
        const userNumber = parseInt(message.content);
        if (isNaN(userNumber)) return message.delete().catch(() => {}); 
        
        if (userNumber === currentCount + 1) {
            // Prevent user from counting twice in a row
            if (lastCounterId === message.author.id) {
                message.react('❌').catch(() => {});
                message.channel.send(`⛔ **${message.author}**, you cannot count twice in a row! Reset to 0.`);
                currentCount = 0; lastCounterId = null;
                saveCount();
                return;
            }
            currentCount++; lastCounterId = message.author.id; message.react('✅').catch(() => {});
            saveCount();
        } else {
            message.react('❌').catch(() => {});
            message.channel.send(`💀 **${message.author}** ruined the streak at **${currentCount}**! Reset to 0.`);
            currentCount = 0; lastCounterId = null;
            saveCount();
        }
    }
});

client.login(CONFIG.token);
