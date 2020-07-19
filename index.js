const Discord = require('discord.js');
const Upstream = require('./lib/upstream');
const splitArgs = require('string-argv');
const http = require('http');
const config = require('./config.json');

const bot = new Discord.Client();
console.log("Starting bot...");

let upstream = null;
const inviter = {
    c2u: {}, // channel id => user id
    botJoin(cid, uid) {
        this.c2u[cid] = uid;
    },
    botLeave(cid) {
        delete this.c2u[cid];
    },
    userJoin(cid, uid) {
    },
    userLeave(cid, uid) {
    },
    check(cid, uid) {
    },
    get(cid) {
        return this.c2u[cid];
    }
};

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
                if (typeof commands[cmd] === "function") continue;
                text.push(config.prefix + cmd + " ".repeat(padding - cmd.length) + " " + commands[cmd][0]);
            }
            text.push("```");
            msg.channel.send(text);
        }
    ],
    join: [
        "Join to your current channel",
        (msg, args) => {
            commands.joinChannel(msg);
        }
    ],
    play: [
        "Play the radio",
        async (msg, args) => {
            const voiceChannel = msg.member.voiceChannel;
            if (!commands.checkAlreadyInChannel(voiceChannel)) {
                try {
                    await commands.joinChannel(msg);
                } catch {
                    return false;
                }
            }
            voiceChannel.join().then(connection => {
                const id = upstream.on(connection);
                connection.on('disconnect', () => {
                    upstream.off(id);
                });
                msg.channel.send(":musical_note:  |  **Playing**");
                inviter.botJoin(voiceChannel.id, msg.member.id);
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
                const inviterId = inviter.get(voiceChannel.id);
                if (inviterId) {
                    if (voiceChannel.members.some(m => m.id === inviterId)) { // inviter in channel
                        if (!msg.member.hasPermission("MANAGE_GUILD") && msg.member.id !== inviterId) { // ADMIN is able to force leave
                            msg.channel.send(":warning:  |  **You do not have sufficient permissions.**");
                            return false;
                        }
                    }
                }
                msg.channel.send(":loudspeaker:  |  **Successfully left!**");
                voiceChannel.leave();
                inviter.botLeave(voiceChannel.id);
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
    ],
    joinChannel(msg) {
        return new Promise((resolve, reject) => {
            const voiceChannel = msg.member.voiceChannel;
            if (!voiceChannel) {
                msg.channel.send(":warning:  |  **You are not on a voice channel.**");
                return reject();
            }
            if (commands.checkAlreadyInChannel(voiceChannel)) {
                msg.channel.send(":warning:  |  **I'm lready in this channel.**");
                return reject();
            }
            if (commands.checkAlreadyInGuild(voiceChannel)) {
                msg.channel.send(":warning:  |  **I'm lready in another channel in this server. Leave me first.**");
                return reject();
            }
            if(!voiceChannel.joinable) {
                msg.channel.send(":warning:  |  **Not permit to play music in this channel.**");
                return reject();
            }
            voiceChannel.join().then(connection => {
                msg.channel.send(":loudspeaker:  |  **Successfully joined!**");
                inviter.botJoin(voiceChannel.id, msg.member.id);
                resolve();
            })
            .catch(err => {
                console.error(err);
                reject();
            });
        });
    },
    checkAlreadyInGuild(channel) {
        return bot.voiceConnections.some(vc => vc.channel.guild.id === channel.guild.id);
    },
    checkAlreadyInChannel(channel) {
        return bot.voiceConnections.some(vc => vc.channel.id === channel.id);
    }
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
            let str = cmd.replace('`', '') || "none";
            msg.channel.send(":warning:  |  **The command** `" + str + "` **don't exist, for more help use** `" + config.prefix + "help`");
        }
    }
});

bot.login(config.token);
