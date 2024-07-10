var API, backend, db, mazeDatabase;

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
        "delete"
    ],


    profileCache = {}
;

eventList.get = function(name){
    return eventList[eventList.indexOf(name)]
}

function A2U8(...data) {
    let result = [], i = 0;
    for(const event of data) {
        if(!Array.isArray(event))continue;
        let j = -1;
        for(const value of event){
            j++;
            let number = value, encoded, isString = (typeof value == "string");
            if(j == 0){
                // Add event type if suitable
                result.push(isString? eventList.indexOf(value) : value);
                continue
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

            let a = [0];

            // Use 64bit int bitshift operations to convert a 1-8 byte number to a 8 bit array
            number = BigInt(number);
            for(let i = 0; i<8 ; i++){
                a.push(
                    Number(number & 0xFFn) >>> 0 //Unsigned
                )
                number >>= 8n;
            }

            // Remove trailing 0s
            let i = a.length - 1
            while (i >= 0 && a[i] === 0) {
                a.pop()
                i--
            }

            if(a.length < 2){
                a.push(0, 0) // If 0
            }

            a[0] = a.length + (isString ? 9 : 1) // Assign type
            result.push(...a);

            if (isString){
                result.push(...encoded)
            }
        }
        i++;
        if(i != data.length && data.length != 1 && data[i].length > 0) result.push(0);
    }
    result = result.map(b => Math.min(Math.abs(b), 255)).filter(b => typeof b == "number" && b < 256)
    return new Uint8Array(result)
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

API = {
    Initialize(backend_){
        backend = backend_;
        db = backend_.db;
        mazeDatabase = db.database("extragon")
    },

    async HandleRequest({req, res, segments, error, shift}){
        let response;

        let User = backend.user.getAuth(req);

        switch(shift()){
            case "": case null:
                res.send(JSON.stringify({
                    auth: "/user/",
                    user_fragment: User,
                    latest_client: "0.2.0",
                    lowest_client: "0.1.9",
                    sockets: [
                        `ws${req.secured? "s": ""}://${req.domain}/v2/mazec/`
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

                await new Promise(resolve => {
                    mazeDatabase.query(
                        `SELECT room, isOwner, isBanned, bannedUntil, memberSince, isMember, location, type, \`chat.rooms\`.name FROM \`chat.rooms.members\` INNER JOIN \`chat.rooms\` ON \`chat.rooms.members\`.room = \`chat.rooms\`.id WHERE member = ? LIMIT ? OFFSET ?`,
                        [User.id, +req.getQuery("limit") || 100, +req.getQuery("offset") || 0],

                        async function(err, results) {
                            if(!err){
                                return res.send(JSON.stringify(results.map(result => {
                                    result.isOwner = !!result.isOwner[0]
                                    result.isBanned = !!result.isBanned[0]
                                    result.isMember = !!result.isMember[0]
                                    return result
                                })));
                            } else return error(24), console.log(err);
                        }
                    )
                })
            break;


            case "user":
                if(!User || User.error) return error(13);
                let user;

                switch(shift()){
                    case "create_profile":
                        if(typeof req.body !== "object" || !req.body.displayname){
                            return error(2)
                        }

                        let row = await mazeDatabase.table("chat.profiles").has("link", User.id);

                        if(row.err) return error(row.err);

                        if(row.result.length < 1) {
                            let thing = await mazeDatabase.table("chat.profiles").insert({...req.body, ...{
                                link: User.id
                            }})

                            if(thing.err) return error(thing.err);

                            success()
                        } else {
                            error("Profile for this user was already created. Did you mean to use \"patch\"?")
                        }
                    break;

                    case "patch":
                        // ...
                    break;

                    case "profile":
                        user = shift();

                        if(user == "me" || user == "") user = User.id;
                        user = +user;

                        if(isNaN(user)) return error(2);

                        if(profileCache[user]) return res.send(profileCache[user]);
                        
                        let profile = await mazeDatabase.query(`SELECT displayname, avatar, banner, bio, status, colors, nsfw, bot FROM \`chat.profiles\` WHERE link=?`, [user])

                        if(profile.err) return error(profile.err);
                        
                        if(profile.result.length < 1) return send({
                            created: false
                        })
                        
                        profile = profile.result[0];

                        profile.bot = !!profile.bot[0]
                        profile.nsfw = !!profile.nsfw[0]

                        profileCache[user] = Buffer.from(JSON.stringify(profile))
                        res.send(profileCache[user])
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
                                        timestamp: Date.now()
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
                                        //             msg.text
                                        //         ])
                                        //     }
                                        // }

                                        console.log(`maze.chatMessages.${id}`);

                                        backend.broadcast(`maze.chatMessages.${id}`, A2U8([
                                            eventList.get("message"),
                                            msg.author,
                                            msg.room,
                                            msg.id,
                                            msg.timestamp - globalTimeStart,
                                            msg.attachments.replace(/[\[\]]/g, ""),
                                            msg.mentions.replace(/[\[\]]/g, ""),
                                            msg.text
                                        ]), true)
    
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
                                        error(fail)
                                        return send()
                                    }

                                    data = data.json;

                                    if(typeof data !== "object" || !data.text || !data.id || !id){
                                        error(2)
                                        return send()
                                    }

                                    let patch = {
                                        edited: true
                                    }

                                    if(data.text) patch.text = "" + data.text + "";
                                    if(data.mentions) patch.mentions = data.mentions;
                                    if(data.attachments) patch.attachments = data.attachments;
    
                                    response = await mazeDatabase.table("chat.messages").update("where id=" + (+data.id), patch)
                                    
                                    if(!response.err){
                                        for(let v of Object.values(clients)){
                                            if(v.listeners.message.includes(id)){
                                                v.write([
                                                    eventList.get("edit"),
                                                    id,
                                                    (+data.id),
                                                    (patch.text || ""),
                                                    (patch.mentions || "").replace(/[\[\]]/g, ""),
                                                    (patch.attachments || "").replace(/[\[\]]/g, "")
                                                ])
                                            }
                                        }
    
                                        send({success: true});
                                    } else {
                                        return error(24)
                                    }
                                }).data()
                            break;

                            case "delete":
                                res.wait = true;

                                req.parseBody(async (data, fail) => {
                                    if(fail){
                                        error(fail)
                                        return send()
                                    }

                                    data = data.json;

                                    if(typeof data !== "object" || !data.id || !id){
                                        error(2)
                                        return send()
                                    }

                                    let patch = {
                                        deleted: true
                                    }
    
                                    response = await mazeDatabase.table("chat.messages").update("where id=" + (+data.id), patch)
                                    
                                    if(!response.err){
                                        for(let v of Object.values(clients)){
                                            if(v.listeners.message.includes(id)){
                                                v.write([
                                                    eventList.get("delete"),
                                                    id,
                                                    (+data.id)
                                                ])
                                            }
                                        }
    
                                        send({success: true});
                                    } else {
                                        return error(24)
                                    }
                                }).data()
                            break;

                            case "read": case "get":
                                if(!id){
                                    return error(2)
                                }

                                let query = (req.getQuery("id") && typeof +req.getQuery("id") == "number")? [`select id, text, attachments, mentions, author, timestamp, edited from \`chat.messages\` where room=? and deleted = false and id =?`, [id, (+req.getQuery("id")) || 0]] : [`select id, text, attachments, mentions, author, timestamp, edited from \`chat.messages\` where room=? and deleted = false order by id desc limit ${(+req.getQuery("limit")) || 10} offset ${(+req.getQuery("offset")) || 0}`, [id]];
                                response = await mazeDatabase.query(...query)
                                console.log(query);
                                
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

                                if(!response.err){
                                    res.send(JSON.stringify(response.result[0]))
                                } else {
                                    // reply.asd = response.err
                                    console.log(response.err);
                                    return error(24)
                                }
                        }
                    }
            break;

            case "create":
                if(User.error) return error(13);

                req.parseBody(async (data, fail) => {
                    if(fail){
                        error(fail)
                        return send()
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
                    ws.send(A2U8(data));
                }
            }

            // ws.queueInterval = setInterval(function sendQueue(){
            //     if(ws.alive && ws.queue.length > 0){
            //         ws.send(A2U8(...ws.queue));
            //         ws.queue = []
            //     }
            // }, 100)

            ws.forget = (close = true) => {
                if(!ws.alive) return;

                if(close) ws.close()
                ws.alive = false;
                // clearInterval(ws.queueInterval);
                delete clients[ws.uuid];
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
                        ws.write([0])
                        continue;
                    break;

                    case "authorize":
                        if(ws.authorized) continue;

                        let user = backend.user.getAuth(data[1])

                        if(user.error) {
                            ws.forget()
                        } else {
                            ws.user = user
                            ws.authorized = true
                        }
                    break;

                    case "message": break;

                    case "subscribe":

                        console.log(data[1], data[2]);

                        if(data[1]) ws.subscribe(data[2]); else ws.unsubscribe(data[2])
                        
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
            ws.forget(false)
        }
    }
}

module.exports = API