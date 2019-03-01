const Discord = require('discord.js');
const Upstream = require('./lib/upstream');
const splitArgs = require('string-argv');
const http = require('http');
const config = require('./config.json');

const bot = new Discord.Client();
console.log("Starting bot...");

let upstream = null;

const commands = {
    help: [
        "Sends this message", 
        (msg, args) => {
            const text = [
                "Commands",
                "```"
            ];
            const padding = 10; // config
            for (let cmd in commands) {
                text.push(config.prefix + cmd + " ".repeat(padding - cmd.length) + " " + commands[cmd][0]);
            }
            text.push("```");
            msg.channel.send(text);
        }
    ],
    join: [
        "Join to your current channel",
        (msg, args) => {
            const channel = msg.member.voiceChannel;
            if (!channel) return msg.channel.send(':warning:  |  **You are not on a voice channel.**');
            if(!msg.member.voiceChannel.joinable) {
                msg.channel.send(":warning:  |  **Not permit to play music in this channel.**");
                return;
            }
            msg.member.voiceChannel.join();
            msg.channel.send(":loudspeaker:  |  **Successfully joined!**");
        }
    ],
    play: [
        "Play the radio",
        (msg, args) => {
            const channel = msg.member.voiceChannel;
            if (!channel) return msg.channel.send(':warning:  |  **You are not on a voice channel.**');
            msg.channel.send(":musical_note:  |  **Playing**");
            msg.member.voiceChannel.leave();
            msg.member.voiceChannel.join().then(connection => {
                const id = upstream.on(connection);
                connection.on('disconnect', () => {
                    upstream.off(id);
                });
            })
            .catch(console.error);
        }
    ],
    now: [
        "Show current playing song info",
        (msg, args) => {
            playing((meta) => {
                msg.channel.send(":musical_note:  |  Playing - " + meta.title + " ( " + meta.album + " ) - " + meta.artist + " | " + meta.playback_time_seconds + "/" + meta.length_seconds + "s");
            });
        }
    ],
    leave: [
        "Leave voice channel",
        (msg, args) => {
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
        }
    ],
    invite: [
        "Generate an invitation link you can use to invite this bot to your server",
        (msg, args) => {
            msg.channel.send(":tickets:  |  **Invite link:** `" + config.invite + "`");
        }
    ]
};

function updateStatus() {
    bot.user.setActivity("Self | " + config.prefix + "help | " + bot.guilds.array().length + " servers", { type: 'LISTENING' });
}

function playing(cb) {
    http.get("http://live.saru.moe/music/songctl2/data/playing.php", (res) => {
        let json = "";
        res.on('data', (chunk) => {
            json += chunk;
        });
        res.on('end', () => {
            cb(JSON.parse(json));
        });
    });
}

bot.on("ready", function () {
    console.log("Logged in " + bot.guilds.array().length + " servers");
    updateStatus();
    setInterval(updateStatus, 60000);
    upstream = new Upstream(config.uri);
});

bot.on('message', function (msg) {
    if(msg.content.indexOf(config.prefix) === 0) {
        const args = splitArgs(msg);
        const cmd = args.shift();
        const dat = commands[cmd.slice(config.prefix.length)];
        if(dat !== undefined) {
            dat[1](msg, args);
        } else {
            cmd = cmd.replace('`', '') || "none";
            msg.channel.send(":warning:  |  **The command** `" + cmd + "` **don't exist, for more help use** `" + config.prefix + "help`");
        }
    }
});

bot.login(config.token);
