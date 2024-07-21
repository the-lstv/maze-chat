var api, backend, db, mazeDatabase;

let globalTimeStart = 1697840000,
    eventList = [

        // MUST be syncronized with "/native/fastEncoder.cpp" and "/js/client.js"

        "heartbeat",
        "message",
        "subscribe",
        "update",
        "typing",
        "authorize",
        "edit",
        "delete",
        "status",
        "presence",
        "versionCheck",
        "profileChange"
    ],

    latest_client = "0.6.2",
    lowest_client = "0.6.0",

    cache = {
        profiles: {},

        memberships: {
            channel: {},
            user: {},
            server: {},
        },

        presence: {},
        numConnections: {},
        channels: {},
        servers: {},
        read: {},
        lastMessage: {}
    }
;

eventList.get = function(name){
    return eventList[eventList.indexOf(name)]
}

let NativeEncoder = require('../native/build/Release/fastEncoder');

api = {
    async Initialize(backend_){
        backend = backend_;
        db = backend_.db;
        mazeDatabase = db.database("extragon")

        // Preload cache

        let lastReads = await mazeDatabase.query(`select * from \`chat.lastRead\``)
        
        for(let entry of lastReads.result){
            if(!cache.read[entry.user]) cache.read[entry.user] = {};
            cache.read[entry.user][entry.channel] = entry.time
        }

        let lastMessages = await mazeDatabase.query(`select channel, max(timestamp) as timestamp from \`chat.messages\``)
        
        for(let entry of lastMessages.result){
            cache.lastMessage[entry.channel] = entry.timestamp
        }
    },

    util: {
        async getProfiles(list){
            let users = list.filter(_ => _ || _ === 0).map(id => id == "me"? User.id: +id).filter(_ => !isNaN(_)), result = [];


            let missingCache = users.filter(_ => !cache.profiles[_]);

            if(missingCache.length > 0) {
                let profiles = await mazeDatabase.query(`SELECT link, displayname, avatar, banner, bio, status, colors, nsfw, bot FROM \`chat.profiles\` WHERE link in (${missingCache.join()})`)
                
                if(profiles.err) return {error: 24}, console.error(profiles.err);
                
                for(let profile of profiles.result){
                    profile.bot = !!profile.bot[0]
                    profile.nsfw = !!profile.nsfw[0]
                    
                    profile.id = profile.link
                    delete profile.link
                    
                    cache.profiles[profile.id] = profile
                }
            }
            
            for(let user of users){
                if(cache.profiles[user]) {
                    result.push({...cache.profiles[user], presence: cache.presence[user] || 0})
                } else result.push({
                    id: user,
                    created: false
                })
            }

            return result
        },

        async getChannels(list){
            let channels = list.filter(_ => _ || _ === 0).map(id => id == "me"? User.id: +id).filter(_ => !isNaN(_)), result = [];

            let missingCache = channels.filter(_ => !cache.channels[_]);
            
            if(missingCache.length > 0) {
                let response = await mazeDatabase.query(`select * from \`chat.channels\` where id in (${missingCache.join()})`)
                
                if(response.err) return {error: 24}, console.error(response.err);
                
                for(let channel of response.result){
                    cache.channels[channel.id] = channel
                }
            }

            for(let channel of channels){
                if(cache.channels[channel]) result.push(cache.channels[channel])
                
                else result.push({
                    channel,
                    success: false
                })
            }

            return result
        },

        async getServers(list){
            let servers = list.filter(_ => _ || _ === 0).map(id => +id).filter(_ => !isNaN(_)), result = [];

            let missingCache = servers.filter(_ => !cache.servers[_]);
            
            if(missingCache.length > 0) {
                let response = await mazeDatabase.query(`select s.*, GROUP_CONCAT(c.id) as channels from \`chat.servers\` s left join  \`chat.channels\` c ON s.id = c.server where s.id in (${missingCache.join()})`)
                
                if(response.err) return {error: 24}, console.error(response.err);
                
                for(let server of response.result){
                    if(!server.id) continue;

                    server.isPublic = server.isPublic && !!server.isPublic[0]
                    server.channels = server.channels.split(",").map(id => +id)
                    cache.servers[server.id] = server
                }
            }

            for(let server of servers){
                if(cache.servers[server]) result.push(cache.servers[server])
                
                else result.push({
                    server,
                    success: false
                })
            }

            return result
        },

        getMemberships(user = null, server = null, channel = null){
            let isUser = typeof user === "number", isServer = typeof server === "number", isChannel = typeof channel === "number";

            if      (isUser && cache.memberships.user[user]) return cache.memberships.user[user];
            else if (isServer && cache.memberships.server[server]) return cache.memberships.server[server];
            else if (isChannel && cache.memberships.channel[channel]) return cache.memberships.channel[channel];

            return new Promise(resolve => {
                mazeDatabase.query(
                    `SELECT * FROM \`chat.channels.members\` WHERE ${isUser? "member": isServer? "server": "channel"} = ?`,
                    [isUser? user: isServer? server: channel],
    
                    function(err, results) {
                        if(!err){
                            results = results.map(result => {
                                result.isOwner = !!result.isOwner[0]
                                result.isBanned = !!result.isBanned[0]
                                result.isMember = !!result.isMember[0]
                                return result
                            });

                            if      (isUser)    cache.memberships.user[user]       = results;
                            else if (isServer)  cache.memberships.server[server]   = results;
                            else if (isChannel) cache.memberships.channel[channel] = results;

                            return resolve(results)
                        } else resolve(null), console.log(err);
                    }
                )
            })
        },

        async broadcastToRelevantUsers(user, data, messageSelf = true){
            let membersNotified = [];

            let userMemberships = await api.util.getMemberships(user);

            for(let membership of userMemberships){
                let channelMembers = await api.util.getMemberships(null, membership.server || null, membership.channel || null)
                
                for(let membership of channelMembers){
                    if(membersNotified.includes(membership.member)) continue;

                    membersNotified.push(membership.member)

                    if(!messageSelf && user == membership.member) continue;

                    backend.broadcast(`maze.user.${membership.member}`, data, true, true)
                }
            }
        },

        async updatePresence(user, presence){
            if(cache.presence[user] === presence) return;

            cache.presence[user] = presence
            
            await api.util.broadcastToRelevantUsers(user, NativeEncoder.A2U8([
                eventList.get("presence"),
                user,
                presence
            ]))
        },

        async updateLastRead(user, id, date = Date.now()){
            mazeDatabase.query(`INSERT INTO \`chat.lastRead\` (user, channel, time) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE time = VALUES(time);`, [user, id, date]);

            if(!cache.read[user]) cache.read[user] = {};
            cache.read[user][id] = date;
        },

        async join(user, options){

            // Join a server, channel, or DM

            let membership = {
                member: user
            }

            // TODO: needs changes

            return new Promise((resolve, reject) => {
                if(typeof options !== "object" || typeof options.id !== "number" || isNaN(options.id) || !options.type) return resolve({error: "Invalid options"});
    
                mazeDatabase.query(
                    `SELECT * FROM \`chat.channels.members\` WHERE member = ? AND ${options.type == "server"? "server": "channel"} = ? LIMIT 1`,
                    [user, options.id],
    
                    async function(err, results) {
                        if(!err){
                            if(results.length > 0 && !!results[0].isBanned[0] && options.isBanned !== false) return resolve({error: "User is banned"});

                            if(options.type == "channel") membership.channel = options.id;
                            if(options.type == "server") membership.server = options.id;

                            if(options.owner) membership.isOwner = true;
                            membership.isBanned = !!options.isBanned;
                            membership.isMember = typeof options.isMember === "boolean"? options.isMember: true;

                            if(results.length){
                                response = await mazeDatabase.table("chat.channels.members").update(`where ${options.type == "server"? "server": "channel"}=${+options.id} and member=${+user}`, membership)
                            } else {
                                membership.memberSince = Date.now() / 1000
                                response = await mazeDatabase.table("chat.channels.members").insert(membership);
                            }
                            
                            if(!response.err){
                                if(membership.isBanned) return resolve({error: "User is banned"});

                                if(!membership.bannedUntil) membership.bannedUntil = null;

                                // Uh, this is some very terrible code

                                await api.util.getMemberships(user)
                                await api.util.getMemberships(null, options.type == "server"? options.id: null, options.type == "channel"? options.id: null)

                                if(!cache.memberships.user[user].find(membership => membership[options.type == "server"? "server": "channel"] === options.id)){
                                    cache.memberships.user[user].push(membership)
                                    cache.memberships[options.type == "server"? "server": "channel"][options.id].push(membership)
                                }

                                if(results.length && membership.isMember) {
                                    return resolve({success: true, updated: true})
                                }

                                resolve({success: true, updated: false})

                                // response = await mazeDatabase.table("chat.messages").insert({
                                //     text: "",
                                //     mentions: "[]",
                                //     attachments: "[]",
                                //     author: user,
                                //     channel: data.channel,
                                //     timestamp: Date.now() / 1000,
                                //     type: 2
                                // })

                                // if(!response.err){
                                //     let msg_id = response.result.insertId;

                                //     backend.broadcast(`maze.messages.${data.channel}`, NativeEncoder.A2U8([
                                //         eventList.get("message"),
                                //         user,
                                //         data.channel,
                                //         msg_id,
                                //         0,
                                //         "",
                                //         "",
                                //         "",
                                //         2
                                //     ]), true, true)

                                // } else {
                                //     console.error(response.err);
                                //     return error(24)
                                // }
                            } else return resolve({error: "Could not join"}), console.log(response.err);
                        } else return resolve({error: "Could not get up-to-date information"}), console.error(err);
                    }
                )
            })

        }
    },

    async HandleRequest({req, res, segments, error, shift}){
        let response, id; // These are only here because you cannot redeclare across a switch

        let User = backend.user.getAuth(req);

        switch(shift()){
            case "": case null:
                // Do not move the below line to the request as "req" cannot be accessed after awaiting.
                let includeProfile = typeof req.getQuery("profile") === "string", includeMemberships = typeof req.getQuery("channels") === "string";

                res.send(JSON.stringify({
                    auth: "/user/",
                    user_fragment: User,

                    ...User && includeProfile? {
                        user_profile: (await api.util.getProfiles([User.id]))[0]
                    } : {},

                    ...User && includeMemberships? {
                        user_memberships: await api.util.getMemberships(User.id)
                    } : {},

                    latest_client,
                    lowest_client,

                    sockets: [
                        `ws${req.domain.endsWith("test")? "": "s"}://${req.domain}/v2/mazec/`
                    ]
                }))
                // todo: implement fast_stringify, possibly change things around
            break;


            case "list":
                if(!User || User.error) return error(13);
                
                let results = await api.util.getMemberships(User.id);
                return results? res.send(JSON.stringify(results)): error(24)
            break;


            case "user":
                if(!User || User.error) return error(13);
                let user; // <= I dont know what this is but I'm scared to remove it

                switch(shift()){
                    case "create_profile":
                        if(cache.profiles[User.id]) return error(25); 

                        let row = await mazeDatabase.table("chat.profiles").has("link", User.id);

                        if(!row || row.err) return error(row.err), console.error(row.err);;

                        if(row.result.length < 1) {

                            let initialData = await mazeDatabase.query(`select username, displayname, pfp from \`users\` where id = ? limit 1`, [User.id])

                            if(!initialData || initialData.err) return error(24), console.error(initialData.err);
                            if(!initialData.result || initialData.result.length < 1) return error(6);

                            initialData = initialData.result[0];

                            let thing = await mazeDatabase.table("chat.profiles").insert({
                                displayname: initialData.displayname || initialData.name,
                                ... initialData.pfp? {avatar: initialData.avatar} : {},
                                created: Date.now() / 1000,
                                link: User.id
                            })

                            if(!thing || thing.err) return error(thing.err), console.error(thing.err);

                            res.send(`{"success":true}`)
                        } else {
                            error(25)
                        }
                    break;

                    case "patch":
                        req.parseBody(async (data, fail) => {
                            if(fail){
                                return error(fail)
                            }

                            data = data.json;

                            if(typeof data !== "object"){
                                return error(2)
                            }

                            let patch = {}

                            if(data.displayname && data.displayname.length <= 50 && data.displayname.length > 0) patch.displayname = data.displayname;
                            if(data.bio && data.bio.length <= 600) patch.bio = data.bio;
                            if(data.avatar && /^\b[a-f0-9]{32}\.[a-zA-Z0-9]+\b$/g.test(data.avatar)) patch.avatar = data.avatar;
                            if(data.banner && /^\b[a-f0-9]{32}\.[a-zA-Z0-9]+\b$/g.test(data.banner)) patch.banner = data.banner;
                            if(data.colors) patch.colors = data.colors;
                            if(typeof data.nsfw === "boolean") patch.nsfw = data.nsfw;

                            if(Object.keys(patch).length < 1) return res.send('{"success":true}')

                            let result = await mazeDatabase.table("chat.profiles").update("where link=" + (+User.id), patch)

                            if(result && !result.err) {
                                if(result.affectedRows < 1) return error(6);

                                if(cache.profiles[User.id]) Object.assign(cache.profiles[User.id], patch) // Update cache

                                let broadcast = Array(8).fill(0);

                                broadcast[0] = eventList.get("profileChange");
                                broadcast[1] = User.id;

                                let i = 1;
                                for(let key of ['displayname', 'bio', 'avatar', 'banner', 'colors', 'nsfw']){
                                    i++;
                                    if(!patch.hasOwnProperty(key)) continue;
                                    broadcast[i] = patch[key]
                                }

                                api.util.broadcastToRelevantUsers(User.id, NativeEncoder.A2U8(broadcast), false)

                                return res.send('{"success":true}')
                            } else return error(24), console.error(result.err);
                        }).data()
                    break;

                    case "profile":
                        let results = await api.util.getProfiles(shift().split(","));
                        
                        if(results) res.send(Buffer.from(JSON.stringify(results))); else error(24)
                    break;
                }
            break;

            case "channels":
                if(User.error) return error(13);
                id = shift();

                switch(shift()){
                    case "create":
                        if(User.error) return error(13);

                        req.parseBody(async (data, fail) => {
                            if(fail){
                                return error(fail)
                            }
        
                            data = data.json;
        
                            if(typeof data !== "object" || !data.name){
                                return error(2)
                            }
        
                            if(typeof data.location == "string") data.location = ["channel", "dm", "server", "group"].indexOf(data.location);
                            if(typeof data.type == "string") data.type = ["text", "announcement", "voice"].indexOf(data.type);
        
                            response = await mazeDatabase.table("chat.channels").insert({
                                author: User.id,
                                name: data.name,
                                icon: data.icon || "",
                                location: data.location || 0,
                                type: data.type || 0,
                                isPublic: data.isPublic ? 1 : 0,
                                data: data.data ? JSON.stringify(data.data) : "{}",
                                e2e: data.encryption ? 1 : 0,
                                burn: data.burn ? 1 : 0,
                            })
            
                            if(!response.err){
                                api.util.join(User.id, {
                                    type: "channel",
                                    id: response.result.insertId,
                                    owner: true
                                })
        
                                res.send("" + response.result.insertId)
                            } else {
                                return error(24)
                            }
                        }).data()
                    break;

                    case "join":
                        if(User.error) return error(13);

                        // TO-DO: re-add POST for more join options

                        res.send(JSON.stringify(await api.util.join(User.id, {
                            type: "channel",
                            id: +id
                        })))
                    break;

                    case "send": case "post":
                        id = +id;
                        res.wait = true;

                        req.parseBody(async (data, fail) => {
                            if(fail){
                                return error(fail)
                            }

                            data = data.json;

                            if(typeof data !== "object" || !data || !data.text || !id || typeof data.text !== "string"){
                                return error(2)
                            }

                            if(data.text.length > 8000) {
                                return error(49)
                            }

                            let msg = {
                                text: data.text,
                                mentions: Array.isArray(data.mentions) ? data.mentions.map(e => +e ).filter(e => !isNaN(e)) : "[]",
                                attachments: data.attachments || "[]",
                                author: User.id,
                                channel: id,
                                timestamp: Date.now() / 1000,
                                type: 0,
                                ...data.reply? {reply: data.reply}: {}
                            }

                            response = await mazeDatabase.table("chat.messages").insert(msg)
                            
                            if(!response.err){
                                msg.id = response.result.insertId;

                                cache.lastMessage[id] = Date.now();

                                api.util.updateLastRead(User.id, id)

                                backend.broadcast(`maze.messages.${id}`, NativeEncoder.A2U8([
                                    eventList.get("message"),
                                    msg.author,
                                    msg.channel,
                                    msg.id,
                                    msg.timestamp - globalTimeStart,
                                    msg.attachments.replace(/[\[\]]/g, ""),
                                    msg.mentions.replace(/[\[\]]/g, ""),
                                    msg.text,
                                    0,
                                    ...msg.reply? [msg.reply]: []
                                ]), true, true)

                                res.send(JSON.stringify({id: msg.id}));
                            } else {
                                console.error(response.err);
                                return error(24)
                            }
                        }).data()
                    break;
                    
                    case "edit":
                        id = +id;

                        res.wait = true;

                        req.parseBody(async (data, fail) => {
                            if(fail){
                                return error(fail)
                            }

                            data = data.json;

                            if(typeof data !== "object" || !data.text || !data.id || !id){
                                return error(2)
                            }

                            let patch = {
                                edited: true
                            }

                            if(data.text) patch.text = "" + data.text + "";
                            if(data.mentions) patch.mentions = data.mentions;
                            if(data.attachments) patch.attachments = data.attachments;

                            response = await mazeDatabase.table("chat.messages").update("where id=" + (+data.id), patch)

                            if(!response.err){
                                // for(let v of Object.values(clients)){
                                //     if(v.listeners.message.includes(id)){
                                //         v.write([
                                //             eventList.get("edit"),
                                //             id,
                                //             (+data.id),
                                //             (patch.text || ""),
                                //             (patch.mentions || "").replace(/[\[\]]/g, ""),
                                //             (patch.attachments || "").replace(/[\[\]]/g, "")
                                //         ])
                                //     }
                                // }

                                backend.broadcast(`maze.messages.${id}`, NativeEncoder.A2U8([
                                    eventList.get("edit"),
                                    id,
                                    (+data.id),
                                    (patch.text || ""),
                                    (patch.mentions || "").replace(/[\[\]]/g, ""),
                                    (patch.attachments || "").replace(/[\[\]]/g, "")
                                ]), true, true)

                                res.send(`{"success":true}`);
                            } else {
                                return error(24)
                            }
                        }).data()
                    break;

                    case "delete":
                        id = +id;

                        res.wait = true;

                        req.parseBody(async (data, fail) => {
                            if(fail){
                                return error(fail)
                            }

                            data = data.json;

                            if(typeof data !== "object" || !data.id || !id){
                                return error(2)
                            }

                            let patch = {
                                deleted: true
                            }

                            response = await mazeDatabase.table("chat.messages").update("where id=" + (+data.id), patch)
                            
                            if(!response.err){
                                // for(let v of Object.values(clients)){
                                //     if(v.listeners.message.includes(id)){
                                //         v.write([
                                //             eventList.get("delete"),
                                //             id,
                                //             (+data.id)
                                //         ])
                                //     }
                                // }

                                backend.broadcast(`maze.messages.${id}`, NativeEncoder.A2U8([
                                    eventList.get("delete"),
                                    id,
                                    (+data.id)
                                ]), true, true)

                                res.send(`{"success":true}`);
                            } else {
                                return error(24)
                            }
                        }).data()
                    break;

                    case "read": case "get":
                        id = +id;

                        if(!id){
                            return error(2)
                        }

                        api.util.updateLastRead(User.id, id)

                        // Todo: Implement memory caching

                        let query = (req.getQuery("id") && typeof +req.getQuery("id") == "number")? [`select id, text, attachments, mentions, author, timestamp, edited, reply, type from \`chat.messages\` where channel=? and deleted = false and id =?`, [id, (+req.getQuery("id")) || 0]] : [`select id, text, attachments, mentions, author, timestamp, edited, type, reply, channel from \`chat.messages\` where channel=? and deleted = false order by id desc limit ${(+req.getQuery("limit")) || 10} offset ${(+req.getQuery("offset")) || 0}`, [id]];
                        
                        response = await mazeDatabase.query(...query)
                        
                        if(!response.err){

                            res.send(JSON.stringify(response.result.map(message => {
                                message.edited = !!message.edited[0]
                                return message
                            })))

                        } else {
                            return error(response.err)
                        }
                    break;

                    default:
                        if(!id){
                            return error(2)
                        }

                        let channels = await api.util.getChannels(id.split(",")), result = [];

                        if(!channels || channels.err){
                            console.log(channels.err);
                            return error(24)
                        }

                        for(let channel of channels){
                            if(!channel) continue;

                            channel = {
                                ...channel,
                                unread: ((cache.read[User.id] && cache.read[User.id][channel.id]? cache.read[User.id][channel.id]: 0) < (cache.lastMessage[channel.id] || 1)) || false
                            }

                            if(channel.location == 0){
                                let members = await api.util.getMemberships(null, null, channel.id)

                                if(members && !members.err){
                                    channel.members = members;
                                } else console.error(members.err);
                            }

                            result.push(channel);
                        }
                        
                        return res.send(JSON.stringify(result))
                }
            break;

            case "servers":
                if(User.error) return error(13);
                id = shift();

                switch(shift()){
                    case "create":
                        if(User.error) return error(13);

                        req.parseBody(async (data, fail) => {
                            if(fail){
                                return error(fail)
                            }
        
                            data = data.json;
        
                            if(typeof data !== "object" || !data.name){
                                return error(2)
                            }
        
                            // if(typeof data.location == "string") data.location = ["channel", "dm", "server", "group"].indexOf(data.location);
                            // if(typeof data.type == "string") data.type = ["text", "announcement", "voice"].indexOf(data.type);
        
                            response = await mazeDatabase.table("chat.servers").insert({
                                owner: User.id,
                                displayname: data.name,
                                icon: data.icon || "",
                                // banner: data.banner || "",
                                isPublic: data.isPublic ? 1 : 0
                            })
            
                            if(!response.err){
                                api.util.join(User.id, {
                                    type: "server",
                                    id: response.result.insertId,
                                    owner: true
                                })
        
                                res.send("" + response.result.insertId)
                            } else {
                                return error(24)
                            }
                        }).data()
                    break;

                    case "join":
                        if(User.error) return error(13);

                        // TO-DO: re-add POST for more join options

                        res.send(JSON.stringify(await api.util.join(User.id, {
                            type: "server",
                            id: +id
                        })))
                    break;

                    default:
                        if(!id){
                            return error(2)
                        }

                        let servers = await api.util.getServers(id.split(",")), result = [];

                        if(!servers || servers.err) return error(24), console.log(servers.err);

                        for(let server of servers){
                            if(!server) continue;

                            let members = await api.util.getMemberships(null, server.id)

                            if(members && !members.err){
                                server.members = members;
                            } else console.error(members.err);

                            result.push(server);
                        }
                        
                        return res.send(JSON.stringify(result))
                }
            break;

            default:
                error(1)
        }
    },

    HandleSocket: {
        open(ws){
            ws.alive = true;
            ws.authorized = false;

            // ws.queueInterval = setInterval(function sendQueue(){
            //     if(ws.alive && ws.queue.length > 0){
            //         ws.send(NativeEncoder.A2U8(...ws.queue));
            //         ws.queue = []
            //     }
            // }, 100)

            // FIXME: Potential deprecation
            ws.forget = (close = true) => {
                try {
                    if(!ws.alive) return;
    
                    if(close) ws.close()
                    ws.alive = false;
                    // clearInterval(ws.queueInterval);
                } catch {}
            }

            // Kick the client if they did not authorize within 4 seconds
            setTimeout(()=>{
                if(!ws.authorized) {
                    ws.forget()
                }
            }, 4000)
        },
    
        message(ws, message, isBinary){
            for(let data of NativeEncoder.U82A(new Uint8Array(message))){

                // If unauthorized, the client must not perform any other actions
                if(!ws.authorized && data[0] !== "authorize") continue;

                switch(data[0]){
                    case "heartbeat":
                        // Heartbeat ("ping")
                        ws.alive = true;
                        ws.send(new Uint8Array([0]), true, true);
                    continue;

                    case "authorize":
                        if(ws.authorized) continue;

                        let user = backend.user.getAuth(data[1])

                        if(user.error) {
                            ws.forget()
                        } else {
                            ws.user = user
                            ws.authorized = true

                            if(!cache.numConnections[user.id]) cache.numConnections[user.id] = 0;
                            cache.numConnections[user.id]++;

                            // The user is now online
                            api.util.updatePresence(user.id, 1)

                            ws.subscribe("maze.user." + user.id)

                            // In case the user reconnected from an older client, notify the user of the current client version (to potentially update)
                            ws.send(NativeEncoder.A2U8([
                                eventList.get("versionCheck"),
                                lowest_client,
                                latest_client
                            ]), true, true)

                            // Note that all clients MUST respond to "lowest_client", as that is considered the lowest compatible version. If the client is older, it must NOT use the API anymore.
                        }
                    break;

                    // Sending messages through websockets is not implemented and should NOT be implemented, at least at this state, due to error checking
                    case "message": break;

                    case "typing":
                        // TODO: Check if the user is a member of the channel to avoid fake typing
                        backend.broadcast(`maze.messages.${data[1]}`, NativeEncoder.A2U8([eventList.get("typing"), data[1], ws.user.id]), true)
                    break;

                    case "subscribe":
                        if(data[1]) ws.subscribe("maze." + data[2]); else ws.unsubscribe("maze." + data[2])
                    break;
                }
            }
        },

        close(ws, code, message){
            ws.forget(false)

            if(!ws.authorized || !ws.user) return;

            cache.numConnections[ws.user.id]--;

            if(cache.numConnections[ws.user.id] == 0) api.util.updatePresence(ws.user.id, 0)
        }
    }
}

module.exports = api