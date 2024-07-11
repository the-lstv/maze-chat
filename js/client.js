/*

0         = split - requires a byte (0-255) as the command right after, same as in the beginning
1 - 2     = bool ()
3 - 10    = number (in bytes that will follows) ( 3 = 1, 10 = 8 ) - 4 byes = 32bit number, 8 = 64bit number.
11 - 20   = oncoming length for a number with length for an oncoming string in bytes (eg. 11 5 h e l l o  -  encoded "hello" in 5 bytes.)
21        = empty string
22        = (unreleased) array start
23        = (unreleased) array end
24 - 99   = reserved for the future
100 - 255 = raw number value (0 - 155), treated same as 3-10, but does not need a length indication.
*/

(function(){

    let enc = new TextEncoder,
        dec = new TextDecoder,
        encode = (text) => enc.encode(text),
        decode = (bytes) => dec.decode(bytes),
        version = "0.1.20",
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
        ]
    ;

    function A2U8(...data) {
        let result = [], i = 0;
        for(const event of data) {
            if(!Array.isArray(event)) continue;
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

    window.U82A = U82A;
    window.A2U8 = A2U8;

    let bytes = {
        event: 1,
        message: 0
    }

    function chatClass(parent, id, chat){
        return new ((_this => class chatClass {
            constructor(){
                _this = this;

                this.parent = parent;

                if(this.parent.chats[id]) throw "Maze client error; Tried initializing the same chat twice";

                this.id = id;
                this.info = chat;
                this.isOpen = true
                this.events = new((LS.EventResolver || options.EventResolver)())(this);

                this.typingTimeout = 0;
                this.typingUsers = [];
                this.typingUserTimeouts = {};

                this.messageBuffer = {};
            }

            async send(text, attachments, mentions){
                this.typingTimeout = 0;

                return await _this.parent.request("/chat/" + _this.id + "/post/", {
                    method: "POST",
                    body: JSON.stringify({
                        mentions, attachments, text
                    })
                }).json()
            }

            // latencyTest(message = "Hi! I am testing the latency."){
            //     return new Promise(async (r)=>{
            //         _this.on("message", (received)=>{
            //             r(Date.now() - start)
            //         })
            //         let start = Date.now(),
            //         msg = await chat.send(message);
            //     })
            // }

            async open(){
                _this.isOpen = true;
                _this.parent.internal_subscribe(true, `chatMessages.${_this.id}`)
            }

            async close(){
                _this.isOpen = false;
                _this.parent.internal_subscribe(false, `chatMessages.${_this.id}`)
            }

            sendTyping(){
                if((Date.now() - _this.typingTimeout) < 9500) return;

                _this.parent.send(["typing", _this.id])
                _this.typingTimeout = Date.now()
            }

            traverse(from, to, callback){
                for(let i = from; i < to + from; i++){
                    callback(_this.messageBuffer[i])
                }
            }

            traverseLocal(from, limit, callback){
                let keys = Object.keys(_this.messageBuffer).reverse();

                for(let i = from; i < limit + from; i++){
                    callback(_this.messageBuffer[keys[i]], i, _this.messageBuffer[keys[i + 1]])
                }
            }

            message(id){
                let tools;

                tools = {
                    buffer: _this.messageBuffer[id],

                    async get(callback){
                        let value = _this.messageBuffer[id] || await tools.fetch()
                        if(callback) callback(value)
                        return value
                    },

                    async fetch(){
                        let query = await _this.parent.request(`/chat/${_this.id}/get/?id=${id}`).send();

                        if(query.ok){
                            let message = (await query.json())[0];

                            _this.messageBuffer[id] = message;
                            tools.buffer = message;
    
                            return message || false
                        } else {
                            return false
                        }
                    },

                    async edit(text, attachments, mentions){
                        return await _this.parent.request("/chat/" + _this.id + "/edit/", {
                            method: "POST",
                            body: JSON.stringify({
                                id,
                                mentions, attachments, text
                            })
                        }).json()
                    },

                    async delete(){
                        return await _this.parent.request("/chat/" + _this.id + "/delete/", {
                            method: "POST",
                            body: JSON.stringify({
                                id
                            })
                        }).json()
                    },

                    async react(emoji){
                        return await _this.parent.request("/chat/" + _this.id + "/react/", {
                            method: "POST",
                            body: JSON.stringify({
                                id,
                                emoji
                            })
                        }).json()
                    }
                }

                return tools
            }

            get(limit, offset = 0){
                return new Promise(async resolve => {
                    let query = await _this.parent.request(`/chat/${_this.id}/read/?limit=${(+limit) || 10}&offset=${(+offset) || 0}`).send();

                    if(query.ok){
                        let messages = await query.json();

                        for(let message of messages){
                            if(_this.messageBuffer[message.id]){
                                Object.assign(message, _this.messageBuffer[message.id])
                                continue
                            }

                            _this.messageBuffer[message.id] = message;
                            message.room = _this.id;
                            message.renderBuffer = null;
                        }

                        resolve(messages)
                    } else {
                        resolve({
                            error: query.error
                        })
                    }
                })
            }
        })());
    }

    function MazecClient(gateway, options){
        return new((_this => class MazecClient {
            constructor(gateway, options){
                options = options || {};
                _this = this;
    
                this.queue = [];
                this.listening = {};

                this.user = {};
    
                this.profileCache = {};
    
                this.lastHeartbeatStarted = this.lastHeartbeat = Date.now()
    
                if(!(window.LS? LS.EventResolver : false) && !options.EventResolver){
                    throw "Failed initializing MazecClient; No suitable event system provided. Please make sure that LS is available and accesible or provide your own with the EventResolver option."
                }
    
                this.events = new((LS.EventResolver || options.EventResolver)())(this);
    
                this.on("socket.raw", async (evt) => {
                    if(typeof evt.data == "string") return; //We don't do that here :D
    
                    let data = new Uint8Array(await evt.data.arrayBuffer());

                    data = U82A(data);
    
                    for(const event of data){
                        switch(event[0]){
                            case "heartbeat":
                                this.lastHeartbeat = Date.now()
                            break;
                            case "message": 
                                if(this.chats[event[2]]) {
                                    let buffer = {
                                        author: event[1],
                                        room: event[2],
                                        id: event[3],
                                        timestamp: event[4] + globalTimeStart,
                                        attachments: event[5],
                                        mentions: event[6],
                                        text: event[7],
                                        type: event[8],
                                    };

                                    let chat = this.chats[event[2]];

                                    // User joined
                                    if(event[8] == 2){
                                        chat.info.members.push({
                                            member: event[1],
                                            memberSince: event[4] + globalTimeStart,
                                            isBanned: false,
                                            isOwner: false,
                                            isMember: true
                                        })

                                        chat.invoke("member.join", event[1]);
                                    }

                                    chat.typingUsers = chat.typingUsers.filter(user => user !== event[1])

                                    chat.invoke("typing.stop", event[1]);

                                    if(chat.typingUsers.length < 1){
                                        chat.invoke("typing.stop.all");
                                    }

                                    chat.invoke("message", buffer)

                                    chat.messageBuffer[event[3]] = buffer
                                };
                            break;
                            case "edit":
                                if(this.chats[event[1]]){
                                    let buffer = {
                                        id: event[2],
                                        text: event[3],
                                        mentions: event[5],
                                        attachments: event[5],
                                        edited: true
                                    };

                                    this.chats[event[1]].invoke("edit", buffer);
                                    
                                    if(this.chats[event[1]].messageBuffer[event[2]]) Object.assign(this.chats[event[1]].messageBuffer[event[2]], buffer)
                                }
                            break;
                            case "delete":
                                if(this.chats[event[1]]){
                                    this.chats[event[1]].invoke("delete", event[2]);
                                    
                                    delete this.chats[event[1]].messageBuffer[event[2]]
                                }
                            break;
                            case "typing":
                                let chat = this.chats[event[1]];

                                if(chat){
                                    if(chat.typingUserTimeouts[event[2]]) clearInterval(chat.typingUserTimeouts[event[2]])

                                    if(!chat.typingUsers.includes(event[2])) chat.typingUsers.push(event[2]);

                                    chat.invoke("typing", event[2]);
                                    
                                    chat.typingUserTimeouts[event[2]] = setTimeout(() => {
                                        chat.typingUsers = chat.typingUsers.filter(user => user !== event[2])

                                        chat.invoke("typing.stop", event[2]);

                                        if(chat.typingUsers.length < 1){
                                            chat.invoke("typing.stop.all");
                                        }
                                    }, 10000)
                                }
                            break;
                        }
                    }
                })

                function sendQueue(){
                    if(_this.queue.length > 0 && _this.socket && _this.socket.readyState == 1){
                        _this.socket.send(A2U8(..._this.queue));
                        _this.queue = []
                    }
                }
    
                setInterval(sendQueue, 100)
    
                Object.defineProperty(this.user, "id", {
                    get(){
                        return _this.user.fragment? _this.user.fragment.id : null
                    }
                })

                Object.defineProperty(this.user, "profile", {
                    get(){
                        return _this.profileCache[_this.user.fragment? _this.user.fragment.id : null] || null
                    }
                })
    
                this.version = version;
                this.api = gateway;
                this.chats = {};
            }

            async login(token, callback = data => data){
                _this.user.token = token
                let test = await _this.request().json();

                if(test.user_fragment && !test.user_fragment.error){
                    return callback(_this.user.fragment = test.user_fragment)
                } else return callback(false)
            }
    
            request(endpoint = "", options = {}){
                let url = _this.api + endpoint;
                
                async function execute(){
                    return await fetch(url, {
                        ...options,
                        headers: {
                            Authorization: _this.user.token,
                            ... options.headers? options.headers : {}
                        }
                    })
                }

                return {
                    async json(){
                        return await (await execute()) .json()
                    },
                    async send(){
                        return await execute()
                    }
                }
            }
    
            async initialize(channel = "default"){
                if(!_this.user.token) {
                    return "No user is logged in"
                }

                let conn;
    
                try {
                    conn = await _this.request().json()
                } catch (e) {
                    console.error("[Mazec Debug] ", e);
                    return "Couldn't connect with the API"
                }
                
                if(_this.checkVersion(conn.lowest_client) == -1){
                    return `Mazec client is too outdated (minimum supported is ${conn.lowest_client}, current is ${version})`
                }
    
                let profile = await _this.profile(conn.user_fragment.id);
                _this.profileCache[conn.user_fragment.id] = profile;

                if(!profile){
                    console.warn("[Mazec Debug] This user does not have a profile set-up yet.")
                }
    
                _this.isOutdated = _this.checkVersion(conn.latest_client) == -1;
                _this.server = conn
    
                await _this.ensureSocket()
                return
            }

            async prefetchProfiles(list = []){
                if(list.length < 1) return;

                list = list.map(id => +id).filter(_ => typeof id !== "number" && !isNaN(_));

                let missingList = list.filter(id => !_this.profileCache[id]), result = [];

                if(missingList.length > 0){
                    let data = await _this.request("/user/profile/" + missingList.join(",")).json();

                    if(!Array.isArray(data)) throw "Failed fetching profiles " + missingList.join(", ");
                    
                    for(let profile of data){
                        if(typeof profile !== "object" || profile.created === false){
                            result.push(profile)
                            continue
                        }
                        
                        profile.created = true
                        profile.colors = profile.colors.split(",").map(color => window.C? C(color): color)
        
                        _this.profileCache[profile.id] = profile
                    }

                }

                for(let user of list){
                    if(_this.profileCache[user]) result.push(_this.profileCache[user] || null)
                }
    
                return result
            }

            async profile(id = "me"){
                if(id == "me") id = this.user.id;
                return (await _this.prefetchProfiles([id]))[0]
            }

            async profileSetup(){
                
            }
    
            ensureSocket(){
                if(!_this.user.token) return;

                return new Promise(r=>{
                    if( !_this.socket || _this.socket.readyState > 1 ){
                        console.log("[Mazec - Network] Connecting")
    
                        _this.socket = new WebSocket(_this.server.sockets[0]);
    
                        _this.socket.addEventListener("message", async event=>{
                            if(_this.paused) return;
                            _this.invoke("socket.raw", event)
                        })

                        _this.socket.addEventListener("open", async ()=>{
                            console.log("[Mazec - Network] Connected")

                            _this.send(["authorize", _this.user.token])                            
    
                            // re-subscribe to previous events
                            for(let event of Object.keys(_this.listening)){
                                if(!_this.listening[event]) continue;
                                _this.internal_subscribe(true, event)
                            }
    
                            if(_this.heartBeat) clearInterval(_this.heartBeat);
    
                            _this.heartBeat = setInterval(async()=>{
                                if((Date.now() - _this.lastHeartbeat) > 7000){
                                    console.warn("[Mazec - Network] SKIPPED A HEARTBEAT!")
                                }
    
                                if(!_this.socket){
                                    _this.die = true
                                }
    
                                if(_this.die){
                                    clearInterval(_this.heartBeat)
                                    return _this.die = false
                                }
    
                                if(_this.socket.readyState > 1){
                                    clearInterval(_this.heartBeat)
                                    await _this.ensureSocket()
                                } else {
                                    _this.lastHeartbeatStarted = Date.now()
                                    _this.send([0])
                                }
                            }, 14000)
    
                            r(_this.socket)
                        })
    
                        _this.socket.addEventListener("close", async ()=>{
                            _this.socket = null;
                            console.log("[Mazec - Network] Connection lost")

                            setTimeout(_this.ensureSocket, 500)
                        })
                    }
                })
            }
    
            internal_subscribe(enable = true, event){
                // console.log(enable, evt);
                // let hash = JSON.stringify(evt).split('').reduce((a, b) => {
                //     a = (a << 5) - a + b.charCodeAt(0);
                //     return a & a;
                // }, 0);
                if(typeof enable !== "boolean") throw "first argument must be a boolean";

                _this.listening[event] = enable
                _this.send(["subscribe", enable, `maze.${event}`])
            }
    
            send(data){
                if(!Array.isArray(data)) throw "Please only provide a properly encoded array.";
                _this.queue.push(data)
            }
    
            checkVersion(With){
                let v1 = version.split(".").map(n => +n), v2 = With.split(".").map(n => +n);

                for(let i = 0; i < Math.max(v1.length, v2.length); i++){
                    if(v1[i]>v2[i]) return 1;
                    if(v1[i]<v2[i]) return -1;
                }
                return 0
            }
    
            async create(options){
                return (await _this.request("/create", {
                    method: "POST",
                    body: JSON.stringify(options)
                }).json())
            }
    
            async chat(id){
                if(this.chats[id]) return this.chats[id];
    
                let chat = await _this.request("/chat/" + id).json()
    
                if(chat && !chat.error){
                    this.chats[id] = chatClass(this, id, chat);
                    return this.chats[id]
                } else {
                    return {
                        error: chat.error || "Unknown error while loadin the chat",
                        code: chat.code || -1
                    }
                }
            }

            async listChannels(){
                return await _this.request("/list").json()
            }
        })())(gateway, options)
    }

    window.MazecClient = MazecClient
})();