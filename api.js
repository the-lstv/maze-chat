var api, backend, db, mazeDatabase;

let clients = {}, globalMessageID = 0;

let enc = new TextEncoder,
    dec = new TextDecoder,
    encode = (text) => enc.encode(text),
    decode = (bytes) => dec.decode(bytes),
    globalTimeStart = 1697840000000,
    eventList = [
        "heartbeat",
        "message",
        "subscribe",
        "update",
        "typing",
        "authorize",
        "edit",
        "delete",
        "status",
        "presence"
    ],


    cache = {
        profiles: {},
        channelMemberships: {},
        presence: {},
        numConnections: {},
    }
;

eventList.get = function(name){
    return eventList[eventList.indexOf(name)]
}

function A2U8(...data) {
    let result = [], i = 0;
    for(const event of data) {
        if(!Array.isArray(event)) continue;

        let firstElementProcessed = false;

        for(const value of event){
            let number = value, encoded, isString = (typeof value == "string");

            if (!firstElementProcessed) {
                result.push(isString ? eventList.indexOf(value) : value);
                firstElementProcessed = true;
                continue;
            }

            if(typeof value == "boolean"){
                result.push(value? 2 : 1);
                continue
            }

            if (isString){

                if(value === ""){
                    result.push(21)
                    continue
                }

                encoded = encode(value)
                number = encoded.length;

            } else if (value >= 0 && value <= 155) {

                // Numbers 0 to 155 can have a dedicated byte
                result.push(value + 100);
                continue

            }

            const bytes = [];
            number = BigInt(number);

            while (number > 0) {
                bytes.push(Number(number & 0xFFn));
                number >>= 8n;
            }

            const length = bytes.length;
            if (length === 0) {
                bytes.push(0);
            }

            result.push(length + (isString ? 10 : 2), ...bytes);

            if (isString){
                result.push(...encoded)
            }
        }

        i++;

        if(i != data.length && data[i].length > 0) result.push(0);
    }

    return new Uint8Array(result.filter(b => b < 256))
}

function U82A(bytes) {
    let result = [],
        c = [],
        separator = false,
        skip = 0
    ;

    for(let i = 0; i < bytes.length; i++){
        let byte = bytes[i];
        if(skip > 0) {
            skip--
            continue
        }

        if(separator || i === 0){
            if(separator){
                result.push(c)
                c = []
            }
            c.push(eventList[byte])
            separator = false
            continue
        }

        if( byte === 0 ){
            separator = true
            continue
        }
        
        if( byte === 1 || byte === 2 ){
            c.push(byte == 2)
            continue
        }
        
        if( byte === 21 ){
            c.push("")
            continue
        }

        let isString = byte >= 11 && byte <= 20;

        if( (byte >= 3 && byte <= 10) || isString ){
            let size = byte - (isString? 10 : 2)
            let num = BigInt(0);
            for (let j = 0; j < size; j++) {
                num += BigInt(bytes[i + (j + 1)] || 0) << (BigInt(j) * 8n);
            }

            num = Number(num);
            
            i += (size)

            if(isString){
                c.push(
                    decode(new Uint8Array(bytes.slice(i + 1, i + num + 1)))
                )

                i += (num)
            } else {
                c.push(num)
            }


            continue
        }
        if( byte >= 100 && byte <= 255 ){
            c.push(byte - 100)
            continue
        }
    }
    result.push(c)

    return result;
}

api = {
    Initialize(backend_){
        backend = backend_;
        db = backend_.db;
        mazeDatabase = db.database("extragon")
    },

    util: {
        async getProfiles(list){
            let users = list.filter(_ => _ || _ === 0).map(id => id == "me"? User.id: +id).filter(_ => !isNaN(_)), result = [];
            
            
            let missingCache = users.filter(_ => !cache.profiles[_]);
            
            if(missingCache.length > 0) {
                let profiles = await mazeDatabase.query(`SELECT link, displayname, avatar, banner, bio, status, colors, nsfw, bot FROM \`chat.profiles\` WHERE link in (${missingCache.join()})`)
                
                if(profiles.err) return error(24), console.error(profiles.err);
                
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
                    cache.profiles[user].presence = cache.presence[user] || 0;

                    result.push(cache.profiles[user])
                } else result.push({
                    user,
                    created: false
                })
            }

            return result
        },

        getChannels(user, limit = 100, offset = 0){
            if(cache.channelMemberships[user]) return cache.channelMemberships[user];

            return new Promise(resolve => {
                mazeDatabase.query(
                    `SELECT room, isOwner, isBanned, bannedUntil, memberSince, isMember, location, type, \`chat.rooms\`.name FROM \`chat.rooms.members\` INNER JOIN \`chat.rooms\` ON \`chat.rooms.members\`.room = \`chat.rooms\`.id WHERE member = ? LIMIT ? OFFSET ?`,
                    [user, limit, offset],
    
                    function(err, results) {
                        if(!err){
                            results = results.map(result => {
                                result.isOwner = !!result.isOwner[0]
                                result.isBanned = !!result.isBanned[0]
                                result.isMember = !!result.isMember[0]
                                return result
                            });

                            cache.channelMemberships[user] = results;
                        
                            return resolve(results)
                        } else resolve(null), console.log(err);
                    }
                )
            })
        },

        updatePresence(user, presence){
            cache.presence[user] = presence;

            // backend.broadcast(`maze.presence.${id}`, A2U8([
            //     eventList.get("presence"),
            //     msg.author,
            //     msg.room,
            //     msg.id,
            //     msg.timestamp - globalTimeStart,
            //     msg.attachments.replace(/[\[\]]/g, ""),
            //     msg.mentions.replace(/[\[\]]/g, ""),
            //     msg.text,
            //     0
            // ]), true, true)
        },

        join(user){
            cache.channelMemberships[user].push(membership)
        }
    },

    async HandleRequest({req, res, segments, error, shift}){
        let response;

        let User = backend.user.getAuth(req);

        switch(shift()){
            case "": case null:
                // Do not move the below line to the request as "req" cannot be accessed after awaiting.
                let includeProfile = typeof req.getQuery("profile") === "string", includeChannels = typeof req.getQuery("channels") === "string";

                res.send(JSON.stringify({
                    auth: "/user/",
                    user_fragment: User,

                    ...User && includeProfile? {
                        user_profile: (await api.util.getProfiles([User.id]))[0]
                    } : {},

                    ...User && includeChannels? {
                        user_channels: await api.util.getChannels(User.id)
                    } : {},

                    latest_client: "0.3.0",
                    lowest_client: "0.3.0",
                    sockets: [
                        `ws${req.domain.endsWith("test")? "": "s"}://${req.domain}/v2/mazec/`
                    ]
                }))
                // todo: implement fast_stringify, possibly change things around
            break;

            case "stats":
                res.send(JSON.stringify({
                    active_clients: clients.length
                }))
            break;

            case "list":
                if(!User || User.error) return error(13);
                
                let results = await api.util.getChannels(User.id, +req.getQuery("limit") || 100, +req.getQuery("offset") || 0);
                return results? res.send(JSON.stringify(results)): error(24)
            break;


            case "user":
                if(!User || User.error) return error(13);
                let user;

                switch(shift()){
                    case "create_profile":
                        req.parseBody(async (data, fail) => {
                            if(fail){
                                return error(fail)
                            }

                            data = data.json;

                            if(typeof data !== "object"){
                                return error(2)
                            }

                            let row = await mazeDatabase.table("chat.profiles").has("link", User.id);

                            if(row.err) return error(row.err);

                            if(row.result.length < 1) {
                                let thing = await mazeDatabase.table("chat.profiles").insert({
                                    ...data,
                                    created: Date.now(),
                                    link: User.id
                                })

                                if(thing.err) return error(thing.err);

                                res.send(`{"success":true}`)
                            } else {
                                error("Profile for this user was already created. Did you mean to use \"patch\"?")
                            }
                        }).data()
                    break;

                    case "patch":
                        // ...
                    break;

                    case "profile":
                        let results = await api.util.getProfiles(shift().split(","));
                        
                        if(results) res.send(Buffer.from(JSON.stringify(results))); else error(24)
                    break;
                }
            break;

            case "chat":
                if(User.error) return error(13);
                let id = shift();

                switch(id){
                    default:
                        id = +id;
                        switch(shift()){
                            case "send": case "post":
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
                                        room: id,
                                        timestamp: Date.now(),
                                        type: 0
                                    }
    
                                    response = await mazeDatabase.table("chat.messages").insert(msg)
                                    
                                    if(!response.err){
                                        msg.id = response.result.insertId;
    
                                        // for(let v of Object.values(clients)){
                                        //     if(v.listeners.message.includes(id)){
                                        //         v.write([
                                        //             eventList.get("message"),
                                        //             msg.author,
                                        //             msg.room,
                                        //             msg.id,
                                        //             msg.timestamp - globalTimeStart,
                                        //             msg.attachments.replace(/[\[\]]/g, ""),
                                        //             msg.mentions.replace(/[\[\]]/g, ""),
                                        //             msg.text,
                                        //             0
                                        //         ])
                                        //     }
                                        // }

                                        backend.broadcast(`maze.messages.${id}`, A2U8([
                                            eventList.get("message"),
                                            msg.author,
                                            msg.room,
                                            msg.id,
                                            msg.timestamp - globalTimeStart,
                                            msg.attachments.replace(/[\[\]]/g, ""),
                                            msg.mentions.replace(/[\[\]]/g, ""),
                                            msg.text,
                                            0
                                        ]), true, true)
    
                                        res.send(JSON.stringify({id: msg.id}));
                                    } else {
                                        console.error(response.err);
                                        return error(24)
                                    }
                                }).data()
                            break;
                            
                            case "edit":
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

                                        backend.broadcast(`maze.messages.${id}`, A2U8([
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

                                        backend.broadcast(`maze.messages.${id}`, A2U8([
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
                                if(!id){
                                    return error(2)
                                }

                                // Todo: Implement memory caching

                                let query = (req.getQuery("id") && typeof +req.getQuery("id") == "number")? [`select id, text, attachments, mentions, author, timestamp, edited, type from \`chat.messages\` where room=? and deleted = false and id =?`, [id, (+req.getQuery("id")) || 0]] : [`select id, text, attachments, mentions, author, timestamp, edited, type from \`chat.messages\` where room=? and deleted = false order by id desc limit ${(+req.getQuery("limit")) || 10} offset ${(+req.getQuery("offset")) || 0}`, [id]];
                                
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

                                response = await mazeDatabase.query(`select * from \`chat.rooms\` where id=? LIMIT 1`, [id])

                                if(response.err){
                                    console.log(response.err);
                                    return error(24)
                                }

                                // TODO: improve, separate, and implement limits/offsets, etc

                                await new Promise(resolve => {
                                    mazeDatabase.query(
                                        `select member, isOwner, isBanned, bannedUntil, memberSince, isMember from \`chat.rooms.members\` WHERE room = ?`,
                                        [id],

                                        async function(err, results) {
                                            if(!err){

                                                response = response.result[0]

                                                response.members = results.map(result => {
                                                    result.isOwner = !!result.isOwner[0]
                                                    result.isBanned = !!result.isBanned[0]
                                                    result.isMember = !!result.isMember[0]
                                                    return result
                                                })

                                                return res.send(JSON.stringify(response));

                                            } else return error(24), console.log(err);
                                        }
                                    )
                                })
                        }
                    }
            break;

            case "join":
                if(User.error) return error(13);


                // TEMPORARY

                req.parseBody(async (data, fail) => {
                    if(fail){
                        return error(fail)
                    }

                    data = data.json;

                    if(typeof data !== "object" || !(data.channel || data.server)){
                        return error(2)
                    }

                    response = await mazeDatabase.table("chat.rooms.members").insert({
                        member: User.id,
                        room: data.channel,
                        memberSince: Date.now()
                    })

                    if(!response.err){ 
                        res.send(`{"success":true}`)

                        response = await mazeDatabase.table("chat.messages").insert({
                            text: "",
                            mentions: "[]",
                            attachments: "[]",
                            author: User.id,
                            room: data.channel,
                            timestamp: Date.now(),
                            type: 2
                        })

                        if(!response.err){
                            let msg_id = response.result.insertId;

                            backend.broadcast(`maze.messages.${data.channel}`, A2U8([
                                eventList.get("message"),
                                User.id,
                                data.channel,
                                msg_id,
                                0,
                                "",
                                "",
                                "",
                                2
                            ]), true, true)

                        } else {
                            console.error(response.err);
                            return error(24)
                        }
                    } else {
                        console.log(response.err);
                        return error(24)
                    }
                }).data()
            break;

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

                    response = await mazeDatabase.table("chat.rooms").insert({
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
                        mazeDatabase.table("chat.rooms.members").insert({
                            member: User.id,
                            room: response.result.insertId,
                            isOwner: true,
                            memberSince: Date.now()
                        })

                        res.send("" + response.result.insertId)
                    } else {
                        return error(24)
                    }
                }).data()
            break;

            default:
                error(1)
        }
    },

    HandleSocket: {
        open(ws){
            clients[ws.uuid] = ws;

            ws.alive = true;
            ws.authorized = false;

            // iduno man this might be removed soon
            clients[ws.uuid] = ws;

            ws.alive = true;
            ws.authorized = false;

            // ws.listeners = {
            //     message: []
            // }

            // ws.queue = []

            ws.write = (data) => {
                // ws.queue.push(data)

                if(ws.alive){
                    ws.send(A2U8(data), true, true);
                }
            }

            // ws.queueInterval = setInterval(function sendQueue(){
            //     if(ws.alive && ws.queue.length > 0){
            //         ws.send(A2U8(...ws.queue));
            //         ws.queue = []
            //     }
            // }, 100)

            ws.forget = (close = true) => {
                try {
                    if(!ws.alive) return;
    
                    if(close) ws.close()
                    ws.alive = false;
                    // clearInterval(ws.queueInterval);
                    delete clients[ws.uuid];
                } catch {}
            }

            setTimeout(()=>{
                if(!ws.authorized) {
                    ws.forget()
                }
            }, 4000)
        },
    
        message(ws, message, isBinary){
            for(let data of U82A(new Uint8Array(message))){

                if(!ws.authorized && data[0] !== "authorize") continue;

                switch(data[0]){
                    case "heartbeat":
                        // Heartbeat
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

                            api.util.updatePresence(user.id, 1)
                        }
                    break;

                    case "message": break;

                    case "typing":
                        backend.broadcast(`maze.messages.${data[1]}`, A2U8([eventList.get("typing"), data[1], ws.user.id]), true)
                    break;

                    case "subscribe":

                        if(data[1]) ws.subscribe("maze." + data[2]); else ws.unsubscribe("maze." + data[2])
                        
                        // switch(data[2]){ //Event type
                        //     case 0:
                                // Message
                                // if(data[1]){
                                //     if(!ws.listeners.message.includes(data[3])) {
                                //         ws.listeners.message.push(data[3])
                                //     }
                                // }else{
                                //     ws.listeners.message[ws.listeners.message.indexOf(data[3])] = null
                                // }
                        //     break;
                        // }
                    break;
                }
            }
        },

        close(ws, code, message){
            cache.numConnections[ws.user.id]--;

            if(cache.numConnections[ws.user.id] == 0) api.util.updatePresence(uws.ser.id, 0)

            ws.forget(false)
        }
    }
}

module.exports = api