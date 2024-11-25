/*
        
    A single connection has theese hardcoded limits:
     - There can only be at most 65,536 pending requests at the same time (once old requests are finished, new ones can come in)
     - URL can be only up to 256 in length
     - Body size is virtually unlimited but should be kept below 16kb
        
*/

(() => {

    let qBlaze = {
        connection(server){
            return ((_this) => new class {
                constructor(){
                    _this = this;

                    server = qBlaze.parseURL(server);
    
                    this.server = server;
    
                    this.queue = [];
                    this.requestID = 0;
    
                    this.encoder = new TextEncoder;
                    this.decoder = new TextDecoder;

                    _this.globalHeaders = {};
    
                    this.methods = {"get": 0, "post": 1, "delete": 2, "patch": 3, "writeheader": 4}
    
                    this.resolvers = {}
                }
    
                request(method, url, headers, body = ""){
                    let id = _this.requestID++;
    
                    if(typeof url !== "string"){
                        throw "The url must be a string";
                    }
    
                    if(url.length > 255){
                        throw "The maximum URL length is 256 characters.";
                    }
    
                    if(typeof body !== "string" && !(body instanceof Uint8Array)){
                        throw "The body must be either a string or Uint8Array";
                    }
    
                    const promise = new Promise((resolve, reject) => {
                        _this.resolvers[id] = resolve;
                    });
    
                    const send = () => {
                        _this.socket.send(new Uint8Array([
                            (id >> 8) & 0xFF,
                            id & 0xFF,
                            _this.methods[method.toLowerCase()] || 0,
                            url.length,
                            ... _this.encoder.encode(url),
                            ... typeof body == "string"? _this.encoder.encode(body): [null],
                        ]))
                    }
    
                    if(!_this.socket || _this.socket.readyState !== 1) _this.open().then(() => { send() }); else send();
    
                    return promise
                }
    
                setGlobalHeaders(headers){
                    let string = "";
    
                    for(let key in headers){
                        if(!headers.hasOwnProperty(key)) continue;
    
                        if(!/^[!#$%&'*+.^_`|~0-9a-zA-Z-]+$/.test(key)) throw "Invalid header";
                        if(!/^[\t\x20-\x7E\x80-\xFF]*$/.test(headers[key])) throw "Invalid header value";

                        _this.globalHeaders[key] = headers[key];
                        
                        string += `${key}:${headers[key]}\n`
                    }
    
                    return _this.request("writeheader", "", null, string)
                }
    
                get(url, headers, body){
                    return _this.request("get", url, headers, body)
                }
    
                post(url, headers, body){
                    return _this.request("post", url, headers, body)
                }
    
                delete(url, headers, body){
                    return _this.request("delete", url, headers, body)
                }
    
                patch(url, headers, body){
                    return _this.request("patch", url, headers, body)
                }
    
                open(){
                    if(_this.pendingPromise) return _this.pendingPromise;

                    _this.globalHeaders = {};
    
                    let promise = new Promise((resolve, reject) => {
                        _this.socket = new WebSocket(_this.server)
    
                        _this.socket.addEventListener("open", () => {
                            resolve()
                        })
    
                        _this.socket.addEventListener("message", async (event) => {
                            let buffer = await event.data.arrayBuffer();
    
                            const dataView = new DataView(buffer);
                            let offset = 0;
    
                            const id = dataView.getUint16(offset, false);
                            offset += 2;
    
                            const status = dataView.getUint8(offset) + 200;
                            offset += 1;
    
                            const body = new Uint8Array(buffer, offset);
    
                            if(_this.resolvers[id]) {
                                _this.resolvers[id]({
                                    status,
                                    body,
    
                                    ok: status < 201,
    
                                    text(){
                                        return _this.decoder.decode(body)
                                    },
    
                                    json(){
                                        return JSON.parse(_this.decoder.decode(body))
                                    },
    
                                    arrayBuffer(){
                                        return body.buffer
                                    }
                                });
    
                                delete _this.resolvers[id];
                            } else console.warn("Dead request: Received response to", id)
                        })
    
                        _this.socket.addEventListener("close", event => {
                            _this.pendingPromise = null

                            _this.globalHeaders = {};
    
                            for(let resolver in _this.resolvers){
                                if(!_this.resolvers.hasOwnProperty(resolver)) continue;
    
                                // TODO: It would be possible to auto-reconnect on disconnection
                                _this.resolvers[resolver]({ status: 500, ok: false, body: null, code: event.code, reason: event.reason, wasClean: event.wasClean })
                            }
                        })
    
                        _this.socket.addEventListener("error", () => {
                            // ...
                        })
                    })
    
                    return _this.pendingPromise = promise
                }
            })()
        },

        parseURL(url){
            let parsed = new URL(url);
            return (parsed.protocol == "wss:" || parsed.protocol == "https:"? "wss" : "ws") + "://" + parsed.host + "/quicc/";
        },
    
        fetch(url, options, connection = null){
            let parsed = new URL(url);

            url = qBlaze.parseURL(url);
    
            options = options || {};
    
            if(!connection) connection = qBlaze.pool(url);
    
            return connection.request(options.method || "get", parsed.pathname, null, options.body)
        },
    
        pool(server){
            return qBlaze.connections[server] || (qBlaze.connections[server] = qBlaze.connection(server));
        },
    
        connections: {},
    }
    
    if(!window.qBlaze) window.qBlaze = qBlaze;
    return qBlaze
})()