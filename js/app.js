// LS.Color.watchScheme() // Set light mode if preffered and watch for changes

let app, tabs, Mazec, chat;

M.on("load", async ()=>{

    app = {
        client: new MazecClient(location.origin.endsWith("test")? "http://api.extragon.test/v2/mazec": "https://api.extragon.cloud/v2/mazec"),

        screen: LS.Tabs("main", "#main", {
            mode: "presentation",
            list: false
        }),

        channelContent: LS.Tabs("homeContents", "#homeContents", {
            // mode: "presentation",
            list: false
        }),

        joinServerModal: LS.Modal("joinChat", O("#joinChatModal")),

        options: {
            messageSampleSize: 50
        },

        emojiMap: {
            ':smile:': 'https://cdn.discordapp.com/emojis/752860480758087711.gif?size=128&quality=lossless',
            ':yeah:': 'https://cdn.discordapp.com/emojis/1083458064696475758.webp?size=128&quality=lossless'
        },

        awaitingMessage: null,

        ui: {
            messageScroller: O("#messageArea"),
            messageLoaderOverlay: O("#messageLoader"),

            memberList: O("#memberList"),

            activeMessageElement: null,
            activeMessage: null,

            messagesScrollBottom(){
                O("#messageArea").scroll(0, O("#messageArea").scrollHeight)
            },

            async send(){
                if(app.awaitingMessage) return;

                let content = app.ui.messageContent.doc.getValue().trim();
                if(content.length < 1) return;
                
                // Fake placeholder:
                app.awaitingMessage = await app.messageElement({
                    author: app.client.user.id,
                    room: app.activeChat.id,
                    id: null,
                    timestamp: Date.now(),
                    text: content,
                    sent: true
                });

                app.ui.messageContent.doc.setValue("")
                app.ui.messagesScrollBottom()

                let promise = app.activeChat.send(content)

                localStorage["maze.previousContent." + app.activeChat.id] = ""

                setTimeout(async () => {
                    if(!app.awaitingMessage) return;

                    O("#messageArea").add(app.awaitingMessage)
                    app.ui.messagesScrollBottom()

                    let result = await promise;

                    console.log(result);

                    if(!result || result.error){
                        app.awaitingMessage.class("sent-message-waiting", false)
                        app.awaitingMessage.class("sent-message-errored")
                        app.awaitingMessage.attr("ls-accent", "red")
                    }
                }, 50)
            },

            async openChat(id){
                app.channelContent.setActive("room")
                app.ui.editingMessageStopEdit() // Todo: Save progress state

                if(app.activeChatID == id) return;

                app.activeChatID = null;
                if(localStorage.hasOwnProperty("maze.previousContent." + id)){
                    app.ui.messageContent.doc.setValue(localStorage["maze.previousContent." + id])
                }

                app.ui.fetchMessages(true, true) // Only prepares the view

                let chat = await app.client.chat(id)

                // Pre-fetch all profiles that are a part of the chat
                await app.client.prefetchProfiles(chat.info.members.map(member => member.member))

                app.messageOffset = 0;
                app.messageScrollOffset = 0

                app.messageOffsetMax = Infinity;

                if(chat.error){
                    let message = chat.error;

                    switch(chat.code){
                        case 13:
                            message = "Please log-in to view this chat."
                        break
                    }

                    alert(message)
                    return
                }

                app.chats[id] = chat;

                app.activeChatID = id;

                app.ui.fetchMessages(true)

                app.handleChannelEvents(chat)

                app.ui.renderMembers()

                app.ui.messagesScrollBottom()
                app.ui.drawTyping()
            },

            async renderMembers(){
                app.ui.memberList.get(".list-items").clear();

                for(let member of app.activeChat.info.members){
                    let profile = await app.client.profile(member.member);

                    app.ui.memberList.get(".list-items").add(N({
                        class: "list-item" + (profile.nsfw? " nsfw": ""),
                        inner: [
                            N({
                                class: "list-avatar",
                                inner: app.getAvatar(profile, 32, true)
                            }),

                            N("span", {innerText: profile.displayname}),

                            ...profile.bot? [
                                N("ls-box", {class: "inline color bot-tag", accent: "blue", inner: "BOT"})
                            ]: []
                        ],
                        onclick(){
                            app.showProfile(member.member, this.getBoundingClientRect().left - (O("#profilePopup").getBoundingClientRect().width || 320) - 15)
                        }
                    }))
                }
            },

            async fetchMessages(clear, prepareOnly){
                if(app.messageOffset >= app.messageOffsetMax) return;

                if (clear) {
                    for(let element of O("#messageArea").getAll(".maze-message")) element.remove();
                    app.ui.messageLoaderOverlay.style.display = "flex"
                }

                if(prepareOnly) return;

                let data = await app.activeChat.get(app.options.messageSampleSize, app.messageOffset),
                    originalScrollHeight = app.ui.messageArea.scrollHeight,
                    originalScrollOffset = app.ui.messageArea.scrollTop
                ;

                if(data.length < app.options.messageSampleSize) app.messageOffsetMax = app.messageOffset + app.options.messageSampleSize;

                for(let message of data){
                    let element = app.activeChat.messageBuffer[message.id].renderBuffer || await app.messageElement(message);

                    if(app.ui.messageArea.children.length > 0){
                        app.ui.messageArea.children[0].addBefore(element)
                    } else {
                        app.ui.messageArea.add(element)
                    }
                }

                app.ui.condenseMessages(app.messageOffset - 5, app.options.messageSampleSize)

                app.ui.messageLoaderOverlay.style.display = "none"

                app.ui.messageArea.scrollTop = originalScrollOffset + (app.ui.messageArea.scrollHeight - originalScrollHeight)
            },

            async drawTyping(){
                let typingUsers = app.activeChat.typingUsers.filter(user => user !== app.client.user.id);

                if(typingUsers.length < 1) return O("#typingUsers").class("hidden");

                O("#typingUsers").class("hidden", false)

                if(typingUsers.length > 5) return O(".typingUsersText").set(`Several people are typing`);

                let userList = [];

                for(let user of typingUsers){
                    userList.push((await app.client.profile(user)).displayname)
                }

                O(".typingUsersText").set(`${userList.join(", ")} ${userList.length > 1? "are": "is"} typing`)
            },

            updateButtons(){
                if(!app.ui.activeMessageElement) return O("#messageButtons").applyStyle({display: "none"});

                O("#messageButtons").applyStyle({
                    top: (app.ui.activeMessageElement.getBoundingClientRect().top - 30) + "px",
                    display: "flex"
                })
            },

            activeMessageEdit(){
                if(app.ui.editingMessage){
                    app.ui.editingMessageStopEdit()
                }

                app.ui.editingMessage = app.ui.activeMessage;
                app.ui.editingMessage.renderBuffer.get(".maze-message-text").hide()
                app.ui.editingMessage.renderBuffer.add(O("#messageEditPanel"))
                app.ui.messageEditContent.doc.setValue(app.ui.editingMessage.text)
                app.ui.messageEditContent.focus()
            },

            editingMessageStopEdit(){
                if(!app.ui.editingMessage) return;

                O("#assets").add(O('#messageEditPanel'))
                app.ui.editingMessage.renderBuffer.get(".maze-message-text").show()
                app.ui.editingMessage = null;
            },

            activeMessageCopy(){
                LS.Util.copy(app.activeChat.message(app.ui.activeMessage.id).buffer.text)
            },

            activeMessageCopyID(){
                LS.Util.copy(app.activeChat.message(app.ui.activeMessage.id).buffer.id)
            },

            activeMessageDelete(){
                app.activeChat.message(app.ui.activeMessage.id).delete()
            },

            messageArea: O("#messageArea"),

            profileShown: false,

            get displayNsfw(){
                return document.documentElement.classList.contains("display-nsfw")
            },

            set displayNsfw(value){
                O(document.documentElement).class("display-nsfw", !!value)
            },

            timeFormat(timestamp, includeDate){
                const options = {
                    ...includeDate? {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                    }: {},
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true,
                }

                return new Intl.DateTimeFormat('en-US', options).format(new Date(timestamp));
            },

            condenseMessages(from, limit){
                app.activeChat.traverseLocal(from, limit, (thisBuffer, i, nextBuffer) => {
                    if(!thisBuffer) return;

                    let condense = !!nextBuffer && nextBuffer.type == 0 && nextBuffer.author === thisBuffer.author && (thisBuffer.timestamp - nextBuffer.timestamp) < 300000;
                    if(thisBuffer.renderBuffer) thisBuffer.renderBuffer.class("condensed", condense)
                })
            },

            editedMessageBadge: "<span style='font-size:small;color:gray;margin-left:8px'>(Edited)</span>"
        },

        chats: {},

        activeChatID: null,

        get activeChat(){
            return app.chats[app.activeChatID]
        },

        htmlUnEscape(text){
            return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, function (match) {
                return {
                    '&amp;': '&',
                    '&lt;': '<',
                    '&gt;': '>',
                    '&quot;': '"',
                    "&#39;": "'"
                }[match];
            })
        },

        htmlEscape(text){
            return text.replace(/[&<>"']/g, function (match) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[match];
            })
        },

        renderMarkdown(text){
            text = app.htmlEscape(text);

            text = text.trim()
            
            // Parse headings
            .replace(/^(?<!\\)(#+) (.*)$/gm, function (match, hashes, content) {
                let headingLevel = Math.min(hashes.length, 6);
                return `<h${headingLevel}>${content}</h${headingLevel}>`;
            })
            .replace(/\[([^\n\]]*?)\]\(([\s\S]*?)\)/g, function (originalMatch, flags, content) {
                let result = content;

                if(flags){
                    if(!flags.includes(":")){
                        return `<a href="${result.replaceAll('"', "")}">${flags}</a>`;
                    }

                    flags = flags.split(";").map(flag => flag.trim());

                    for(let flag of flags){
                        flag = flag.split(":").map(f=>f.trim());
                        switch(flag[0]){
                            case "color":
                                result = `<span style="color:${flag[1].replaceAll('"', "")}">${result}</span>`;
                            break;
                            case "size":
                                // FIXME: Restrict usage to specified users
                                result = `<span style="font-size:${flag[1].replaceAll('"', "")}">${result}</span>`;
                            break;
                            case "box":
                                // Todo: add the actual logic :D
                                result = `<ls-box class="color" ls-accent="${flag[1].replaceAll('"', "")}">${result}</ls-box>`;
                            break;
                            case "icon":
                                // Todo: add the actual logic :D
                                result = `<i class="bi-${flag[1].replaceAll('"', "")}"></i>`;
                            break;
                            case "button":
                                // Todo: add the actual logic :D
                                result = `<button class="message-button" onclick="" ls-accent="${(flag[2] || "blue").replaceAll('"', "")}">${result}</button>`;
                            break;
                        }
                    }
                }

                return result;
            })
            .replaceAll("___", "<hr>")
            .replace(/(?<!\\)([*_`~|]+)(.+?)\1/gs, function (originalMatch, match, content) {
                let result = originalMatch;
                if (match.length <= 3) {

                    switch(match[0]){
                        case "*":
                            if (match.length === 1) {
                                result = '<i>' + content + '</i>';
                            } else if (match.length === 2) {
                                result = '<b>' + content + '</b>';
                            } else if (match.length >= 3) {
                                result = '<b><i>' + content + '</i></b>';
                            }
                        break;
                        case "_":
                            result = '<u>' + content + '</u>';
                        break;
                        case "`":
                            if(match.length > 2){

                                let language = content.match(/^[a-zA-Z0-9-]+/);

                                if(language) {language = language[0]; content = content.replace(/^[a-zA-Z0-9-]+/, "")};

                                content = content.trim();

                                if(language) try {
                                    content = hljs.highlight(
                                        app.htmlUnEscape(content),
                                        { language }
                                    ).value;
                                } catch {}

                                console.log(language);

                                result = '<div class="message-code-block theme-base16-atelier-forest">' + content + '</div>';
                            }else{
                                result = '<code>' + content + '</code>';
                            }
                        break;
                        case "~":
                            if(match.length == 2) result = '<s>' + content + '</s>';
                        break;
                        case "|":
                            if(match.length == 2) result = '<span class=message-spoiler onclick=\'this.classList.add("revealed")\'>' + content + '</span>';
                        break;
                    }
                }
                return result;
            });
            
            return text;

            // TODO: Make a better, real parser :D
        },

        pushNotification(title, options, onclick){
            function notify(){
                const notification = new Notification(title, options);
                notification.onclick = onclick || null;
            }

            if (Notification.permission === "granted") {
                notify()
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                        notify()
                    }
                });
            }

            // Denied :(
        },

        handleChannelEvents(chat){
            chat.open() // Subscribe for socket updates (like new messages, edits, etc.)

            if(!chat.maze_handling){

                chat.maze_handling = true;

                chat.on("message", async (msg) => {
                    if(msg.author === app.client.user.id) {
                        if(app.awaitingMessage) app.awaitingMessage.remove()
                        app.awaitingMessage = null
                    }
                    
                    if(app.activeChat && app.activeChat.id === chat.id) {
                        O("#messageArea").add(await app.messageElement(msg))
                        app.ui.messagesScrollBottom()
                        app.ui.condenseMessages(0, 5)
                    } else {
                        let profile = await app.client.profile(msg.author);

                        // Got notification


                        // ,..

                        app.pushNotification("Message in #" + msg.room, {
                            body: msg.text,
                            icon: "https://cdn.extragon.cloud/file/" + (profile.avatar || "826ddb1ccc499d49186262e4c8d6b53e.svg") + (!profile.avatar || profile.avatar.endsWith("svg")? "" : "?size=" + size)
                        })
                    }
                })

                chat.on("edit", (buffer) => {
                    if(!app.activeChat || app.activeChat.id !== chat.id) return;

                    let element = chat.messageBuffer[buffer.id].renderBuffer;

                    if(element){
                        element.get(".maze-message-text").set(app.renderMarkdown(buffer.text) + app.ui.editedMessageBadge)
                    }
                })

                chat.on("delete", (id) => {
                    if(!app.activeChat || app.activeChat.id !== chat.id) return;

                    app.ui.condenseMessages(Object.keys(app.activeChat.messageBuffer).indexOf(`${id - 5}`) + 1, 15)
                })

                chat.on("typing", async (id) => {
                    // TODO: handle this
                    if(!app.activeChat || app.activeChat.id !== chat.id) return;

                    app.ui.drawTyping()
                })

                chat.on("typing.stop", async () => {
                    if(!app.activeChat || app.activeChat.id !== chat.id) return;

                    if(chat.typingUsers.filter(user => user !== app.client.user.id).length < 1) O("#typingUsers").class("hidden")
                })

                chat.on("member.join", async (id) => {
                    if(!app.activeChat || app.activeChat.id !== chat.id) return;

                    app.ui.renderMembers()
                })
            }
        },

        async messageElement(messageBuffer){
            let profile = await app.client.profile(messageBuffer.author);

            let messageContent;

            switch(messageBuffer.type){
                case 0:
                    messageContent = app.renderMarkdown(messageBuffer.text) + (messageBuffer.edited? app.ui.editedMessageBadge : "");
                break;
                case 2:
                    messageContent = [
                        N({innerText: profile.displayname, style: "color:var(--accent)", class: "maze-message-username", onclick(){ app.showProfile(messageBuffer.author, this.getBoundingClientRect().right + 15) }}),
                        " has joined the conversation! ",
                        N({innerText: app.ui.timeFormat(messageBuffer.timestamp, true).replace(",", ""), class: "maze-message-timestamp"}),
                    ]
                break;
            }

            let element = N({
                class: "maze-message " + (messageBuffer.author == app.client.user.id? "own" : "not-own") + (profile.nsfw? " nsfw": "") + (messageBuffer.sent? " sent-message-waiting" : ""),
                
                attr: {
                    "message-type": String(messageBuffer.type)
                },

                id: "message-" + messageBuffer.id,
                inner: [

                    ...messageBuffer.type == 0? [
                        N({inner: [
                            app.getAvatar(profile)
                        ], class: "maze-message-avatar", attr: {"load": "solid"}, onclick(){ app.showProfile(messageBuffer.author, this.getBoundingClientRect().right + 15) }}),
    
                        N({inner: [
                            N({innerText: profile.displayname, class: "maze-message-username", onclick(){ app.showProfile(messageBuffer.author, this.getBoundingClientRect().right + 15) }}),
                            ...profile.nsfw? [
                                N({inner: "NSFW", tooltip: "This profile may include NSFW imagery.<br>Click to change how this content is displayed", class: "maze-nsfw-badge", onclick(){ app }}),
                            ] : [],
                            ...profile.bot? [
                                N("ls-box", {class: "inline color bot-tag", accent: "blue", inner: "BOT"})
                            ]: [],
                            N({innerText: app.ui.timeFormat(messageBuffer.timestamp, true).replace(",", ""), class: "maze-message-timestamp"}),
                        ], class: "maze-message-author"})
                    ]: [],

                    N({
                        ...messageBuffer.text.length > 4000 ? {
                            inner: N({
                                inner: [
                                    N({inner: messageContent, class: "maze-message-text"}),
                                    N({
                                        class: "maze-message-more-button-container",
                                        inner: N("button", {
                                            inner: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256"><path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z"></path></svg> Show more`,
                                            class: "maze-message-more-button pill"
                                        })
                                    }),
                                    
                                ],
                                class: "maze-message-more-container"
                            })
                        } : {inner: messageContent},
                        class: "maze-message-" + (messageBuffer.text.length > 4000 ? "content" : "text")
                    })
                ],

                onmouseenter(){
                    app.ui.activeMessageElement = this
                    app.ui.activeMessage = messageBuffer
                    app.ui.updateButtons();
                    
                    O(".ownMessageButtons").style.display = messageBuffer.author == app.client.user.id? "flex": "none"
                },

                onmouseleave(){
                    if(O("#messageButtons").matches(":hover")) return;
                    app.ui.activeMessageElement = null
                    app.ui.updateButtons();
                }
            })

            if(messageBuffer.id){
                element.messageID = messageBuffer.id;
                (await app.client.chat(messageBuffer.room)).messageBuffer[messageBuffer.id].renderBuffer = element
            }

            return element
        },

        getAvatar(profile, size = 80, badge = false){
            if(typeof profile === "string") profile = {avatar: profile}

            let element = N({
                class: "profile-avatar-source-container",
                attr: {"user-id": profile.id || ""},
                inner: [
                    N(profile.avatar && (profile.avatar.endsWith("webm") || profile.avatar.endsWith("mp4"))? "video": "img", {
                        src: "https://cdn.extragon.cloud/file/" + (profile.avatar || "826ddb1ccc499d49186262e4c8d6b53e.svg") + (!profile.avatar || profile.avatar.endsWith("svg")? "" : "?size=" + size),
                        class: "profile-avatar-source" + (badge? " has-badge": ""),
                        draggable: false
                    }),
                    badge? N({
                        class: "profile-presence-badge",
                        accent: profile.presence == 0? "gray": "green"
                    }): ""
                ]
            })

            return element
        },

        async showProfile(id, x = M.x, y = M.y){
            let container = O("#profilePopup");
            LS._topLayerInherit()

            container.loading = true;
            container.show("flex");
            app.ui.profileShown = true

            let profile = await app.client.profile(id);
            
            container.applyStyle({
                left: Math.min(x, innerWidth - container.getBoundingClientRect().width - 20) +"px",
                top: Math.min(y, innerHeight - container.getBoundingClientRect().height - 20) +"px"
            })

            container.get(".profile-avatar img").onload = ()=>{
                container.loading = false
            }

            container.class("nsfw", profile.nsfw)

            container.get(".profile-bio").set(profile.bio? [
                N("h3", "About me"),
                N({inner: app.renderMarkdown(profile.bio)})
            ]: "");

            container.get(".profile-name").set(profile.displayname);
            
            container.get(".profile-bot-badge").style.display = profile.bot? "inline-block": "none";

            container.get(".profile-avatar").set(app.getAvatar(profile, 256));

            container.getAll(".profile-banner :is(video, img)").all().applyStyle({display: "none"})

            if(profile.banner){
                if(profile.banner.endsWith("webm") || profile.banner.endsWith("mp4")){
                    container.get(".profile-banner video").show()
                    container.get(".profile-banner video").src = "https://cdn.extragon.cloud/file/" + profile.banner;
                } else {
                    container.get(".profile-banner img").show()
                    container.get(".profile-banner img").src = "https://cdn.extragon.cloud/file/" + profile.banner + "?size=544,272";
                }
            }

            container.get(".profile-banner").style.background = profile.colors[1]? profile.colors[1].hex : "var(--elevate-0)"
        },

        async temporary_renderPubliChannels(){
            O("#list .list-items").clear();

            let memberships = app.client.initialChannelCache || await app.client.listChannels();
            app.client.initialChannelCache = null;

            for(let membership of memberships){
                if(!membership.isMember) continue;

                let channel = await app.client.chat(membership.room);

                O("#list .list-items").add(N({
                    class: "list-item channel",
                    inner: [
                        N("i", {class: "bi-hash"}),
                        N("span", {
                            innerText: membership.name
                        })
                    ],

                    onclick(){
                        app.ui.openChat(membership.room)
                    }
                }))
            }
        }
    }

    Mazec = app.client;
    tabs = app.screen;
    
    let token = localStorage["==temporary.2226b75"];

    if(!token) tabs.setActive('login');

    // Startup
    if(token) {
        let login = await app.client.login(token)

        if(typeof login !== "object"){
            alert(login)
            tabs.setActive('login');
            return
        }

        // let error = await Mazec.initialize()

        app.temporary_renderPubliChannels()

        // Set profile information

        let profile = await app.client.profile(app.client.user.id), profileBar = O("#profileBar");

        profileBar.get(".list-avatar").set(app.getAvatar(profile, 32, true))

        profileBar.get(".profileBarName").set(N({innerText: profile.displayname}))

        app.channelContent.on("tab_changed", (id, name) => {
            O("#memberList").style.display = name == "room"? "flex": "none";
        })

        // Load more messages when scrolling

        let loadingMessages = false;
        app.ui.messageScroller.on("scroll", async event => {
            O("#messageButtons").applyStyle({display: "none"});

            if(app.activeChatID && !loadingMessages && app.ui.messageScroller.scrollTop < 50 && (app.options.messageSampleSize <= Object.keys(app.activeChat.messageBuffer).length)){
                loadingMessages = true;

                app.messageOffset += app.options.messageSampleSize;
                await app.ui.fetchMessages()

                loadingMessages = false

                console.log("Should load more");
            }
        })

        app.screen.setActive("home")

        app.client.on("heartbeat.miss", () => {
            O("#reconnection").style.display = "flex"
        })

        app.client.on("disconnect", () => {
            O("#reconnection").style.display = "flex"
        })

        app.client.on("heartbeat", () => {
            O("#reconnection").style.display = "none"
        })

        O("#messageButtons").on("click", () => O("#messageButtons").applyStyle({display: "none"}))
        
        LS.invoke("app.ready", app);

        let channels = await app.client.getAllChats()

        for(let channel of channels) app.handleChannelEvents(channel);
    }

    LS.GlobalEvents.prepare({
        name: "app.ready",
        completed: true
    })
})