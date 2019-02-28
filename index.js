const Discord = require('discord.js');
const Upstream = require('./lib/upstream');
const splitArgs = require('string-argv');
const config = require('./config.json');

var bot = new Discord.Client();
console.log("Starting bot...");

var upstream = null;

var commands = {
    "help": function (msg, args) {
        msg.channel.send([
            "Commands",
            "```",
            config.prefix + "help Sends this message",
            config.prefix + "join Join to your channel",
            config.prefix + "leave Leaves the voice channel",
            config.prefix + "play Play the radio",
            config.prefix + "invite Generate an invitation link you can use to invite the bot to your server",
            "```",
        ]);
    },
    "join": function (msg, args) {
        const channel = msg.member.voiceChannel;
        if (!channel) return msg.channel.send(':warning:  |  **You are not on a voice channel.**');
        if(!msg.member.voiceChannel.joinable) {
            msg.channel.send(":warning:  |  **Not permit to play music in this channel.**");
            return;
        }
        msg.member.voiceChannel.join();
        msg.channel.send(":loudspeaker:  |  **Successfully joined!**");
    },
    "play": function (msg, args) {
        const channel = msg.member.voiceChannel;
        if (!channel) return msg.channel.send(':warning:  |  **You are not on a voice channel.**');
        msg.channel.send(":musical_note:  |  **Playing**");
        msg.member.voiceChannel.join().then(connection => {
            const id = upstream.on(connection);
            connection.on('disconnect', () => {
                upstream.off(id);
            });
        })
        .catch(console.error);
    },
    "leave": function (msg, args) {
        const voiceChannel = msg.member.voiceChannel;
        if (voiceChannel) {
            if (msg.member.hasPermission("MANAGE_GUILD") == false) {
                msg.channel.send(":warning:  |  **You do not have sufficient permissions.**");
                return
            }
            msg.channel.send(":loudspeaker:  |  **Successfully left!**");
            msg.member.voiceChannel.leave();
        } else {
            msg.channel.send(":warning:  |  **Not currently in a voice channel.**");
        }
    },
    "invite": function (msg, args) {
        msg.channel.send(":tickets:  |  **Invite link:** `" + config.invite + "`");
    }
};

function updateStatus() {
    bot.user.setGame(config.prefix + "help | " + bot.guilds.array().length + " servers");
}

bot.on("ready", function () {
    console.log("Logged in " + bot.guilds.array().length + " servers");
    updateStatus();
    setInterval(updateStatus, 60000);
    upstream = new Upstream(config.uri);
});

bot.on('message', function (msg) {
    if(msg.content.indexOf(config.prefix) === 0) {
        var args = splitArgs(msg);
        var cmd = args.shift();
        var cmdFn = commands[cmd.substring(config.prefix.length)];
        if(cmdFn !== undefined) {
            cmdFn(msg, args);
        } else {
            cmd = cmd.replace('`', '') || "none";
            msg.channel.send(":warning:  |  **The command** `" + cmd + "` **don't exist, for more help use** `" + config.prefix + "help`");
        }
    }
});

bot.login(config.token);
