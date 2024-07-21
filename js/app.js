// LS.Color.watchScheme() // Set light mode if preffered and watch for changes

let app, tabs, Mazec, chat;

M.on("load", async ()=>{

    app = {
        client: new MazecClient(location.origin.endsWith("test")? "http://api.extragon.test/v2/mazec": "https://api.extragon.cloud/v2/mazec"),

        cdn: LSCDN(location.origin.endsWith("tefst")? "http://cdn.extragon.test": "https://cdn-origin.extragon.cloud"),

        screen: LS.Tabs("main", "#main", {
            mode: "presentation",
            list: false
        }),

        channelContent: LS.Tabs("homeContents", "#homeContents", {
            list: false
        }),

        channelTabSwitcher: LS.Tabs("channelList", "#channelList", {
            list: false
        }),

        joinServerModal: LS.Modal("joinChat", O("#joinChatModal")),

        cropModal: LS.Modal("cropModal", O("#cropModal"), {
            uncancelable: true
        }),

        profileEditorPatch: {},

        options: {
            messageSampleSize: 50
        },

        // emojiMap: {
        //     ':smile:': 'https://cdn.discordapp.com/emojis/752860480758087711.gif?size=128&quality=lossless',
        //     ':yeah:': 'https://cdn.discordapp.com/emojis/1083458064696475758.webp?size=128&quality=lossless'
        // },

        awaitingMessage: null,

        ui: {
            messageArea: O("#messageArea"),
            messageContainer: O("#messageContainer"),
            mesageDisplayContainer: O("#mesageDisplayContainer"),
            messageLoaderOverlay: O("#messageLoader"),

            memberList: O("#memberList"),

            activeMessageElement: null,
            activeMessage: null,

            messagesScrollBottom(){
                app.ui.messageArea.scroll(0, app.ui.messageArea.scrollHeight)
            },

            async send(){
                if(app.awaitingMessage) return;

                let content = app.ui.messageContent.doc.getValue().trim();
                if(content.length < 1) return;
                
                // Fake placeholder:
                app.awaitingMessage = await app.messageElement({
                    author: app.client.user.id,
                    channel: app.activeChat.id,
                    id: null,
                    timestamp: Date.now(),
                    text: content,
                    sent: true,
                    ...app.replyingMessage? {reply: app.replyingMessage}: {}
                });

                app.ui.messageContent.doc.setValue("")
                app.ui.messagesScrollBottom()

                let promise = app.activeChat.send({
                    text: content,
                    ...app.replyingMessage? {reply: app.replyingMessage}: {}
                })

                localStorage["maze.previousContent." + app.activeChat.id] = ""

                app.replyingMessage = null;

                setTimeout(async () => {
                    if(!app.awaitingMessage) return;

                    app.ui.messageContainer.add(app.awaitingMessage)
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

                Q(".channel.selected").all().class("selected", false)
                
                app.activeChatID = null;

                if(localStorage.hasOwnProperty("maze.previousContent." + id)){
                    app.ui.messageContent.doc.setValue(localStorage["maze.previousContent." + id])
                }

                app.ui.fetchMessages(true, true) // Only prepares the view

                app.ui.mesageDisplayContainer.style.display = "none";

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

                Q(".channelName").all().set(chat.info.name.replaceAll(" ", "-"))

                if(chat.listItemRenderer) {
                    chat.listItemRenderer.class("selected")
                    chat.listItemRenderer.class("unread", false)
                }

                app.activeChatID = id;

                app.ui.fetchMessages(true, false, true)

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

            async fetchMessages(clear, prepareOnly, display){
                if(app.messageOffset >= app.messageOffsetMax) return;

                if (clear) {
                    for(let element of app.ui.messageContainer.getAll(".maze-message")) element.remove();
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

                    if(app.ui.messageContainer.children.length > 0){
                        app.ui.messageContainer.children[0].addBefore(element)
                    } else {
                        app.ui.messageContainer.add(element)
                    }
                }

                app.ui.condenseMessages(app.messageOffset - 5, app.options.messageSampleSize)

                app.ui.messageLoaderOverlay.style.display = "none"

                app.ui.messageArea.scrollTop = originalScrollOffset + (app.ui.messageArea.scrollHeight - originalScrollHeight)

                if(display) {
                    app.ui.mesageDisplayContainer.style.display = "block";
                    app.ui.messagesScrollBottom()
                }
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

            activeMessageReply(){
                app.replyingMessage = app.ui.activeMessage.id;
            },

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

                    let condense = !!nextBuffer && !nextBuffer.reply && !thisBuffer.reply && nextBuffer.type == 0 && nextBuffer.author === thisBuffer.author && (thisBuffer.timestamp - nextBuffer.timestamp) < 300000;
                    if(thisBuffer.renderBuffer) thisBuffer.renderBuffer.class("condensed", condense)
                })
            },

            editedMessageBadge: "<span style='font-size:small;color:gray;margin-left:8px'>(Edited)</span>",

            resetSettings(){
                app.ui.profileShown = false
                O(".profileEditorPreviewWrapper").add(O("#profilePopup"))
                app.showProfile(app.client.user.id)

                O("#profileEditorDisplayname").value = app.client.user.profile.displayname;
                O("#profileEditorBio").value = app.client.user.profile.bio;

                O("#profileEditorGradientPrimary").value = app.client.user.profile.colors[1] || "#000";
                O("#profileEditorGradientSecondary").value = app.client.user.profile.colors[2] || "#000";
                O("#profileEditorGradientToggle").checked = !!app.client.user.profile.colors[1] || !!app.client.user.profile.colors[2]
                O("#profileEditorNSFWToggle").checked = app.client.user.profile.nsfw

                O("#unsavedContent").class("visible", false)

                app.profileEditorPatch = {}
            },

            async saveSettings() {
                if(app.ui.settingsSaveInProgress) return null;

                app.ui.settingsSaveInProgress = true;

                O("#settingsSaveButton").get("span").hide()
                O("#settingsSaveButton").get(".loader").show()

                let patch = {...app.profileEditorPatch};

                async function uploadPicture(source, key){
                    if((!source instanceof Blob) || (!source instanceof File)) return;

                    let upload = await app.cdn.uploadBlob(source);
    
                    if(!upload || !Array.isArray(upload) || !upload[0].success){
                        return false
                    }
                    
                    patch[key] = (upload[0].name || upload[0].hash).replace(".svg", ".webp") // SVG is accepted but gets converted through the uploader, so it should be renamed
                    if(!patch[key].includes(".")) patch[key] += ".webp";
                }

                if(patch.avatar) await uploadPicture(patch.avatar, "avatar");
                if(patch.banner) await uploadPicture(patch.banner, "banner");

                if(patch.colors) patch.colors = patch.colors.join(",")

                let result;

                try{
                    result = await app.client.updateProfile(patch)
                } catch {}

                app.ui.settingsSaveInProgress = false;

                O("#settingsSaveButton").get("span").show()
                O("#settingsSaveButton").get(".loader").hide()

                if(!result || !result.success){
                    // Something went wrong
                    LS.Modal.build({
                        title: "Something went wrong",
                        content: "We could not save your profile :(",
                        buttons: [{text: "OK", color: "auto"}]
                    })
                } else O("#unsavedContent").class("visible", false);
            }
        },

        activeChatID: null,

        get activeChat(){
            return app.client.chats[app.activeChatID]
        },

        _replyingMessage: null,

        get replyingMessage(){
            return app._replyingMessage;
        },

        set replyingMessage(value){
            app._replyingMessage = value;

            if(value) {
                O(".replyingMessage").show("flex").get("b").set("user")
            } else O(".replyingMessage").hide()
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
            if(!chat.maze_handling){
                chat.open() // Subscribe for socket updates (like new messages, edits, etc.)

                chat.maze_handling = true;

                chat.on("message", async (msg) => {
                    if(msg.author === app.client.user.id) {
                        if(app.awaitingMessage) app.awaitingMessage.remove()
                        app.awaitingMessage = null
                    }
                    
                    if(app.activeChat && app.activeChat.id === chat.id) {
                        app.ui.messageContainer.add(await app.messageElement(msg))
                        app.ui.messagesScrollBottom()
                        app.ui.condenseMessages(0, 5)
                    } else {
                        let profile = await app.client.profile(msg.author);

                        // Got notification

                        if(chat.listItemRenderer) {
                            chat.listItemRenderer.class("unread")
                        }

                        app.pushNotification("Message in #" + msg.channel, {
                            body: msg.text,
                            icon: "https://cdn.extragon.cloud/file/" + (profile.avatar || "826ddb1ccc499d49186262e4c8d6b53e.svg") + (!profile.avatar || profile.avatar.endsWith("svg")? "" : "?size=32")
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

            let channel = app.client.chats[messageBuffer.channel];

            let element = N({
                class: "maze-message " + (messageBuffer.author == app.client.user.id? "own" : "not-own") + (profile.nsfw? " nsfw": "") + (messageBuffer.sent? " sent-message-waiting" : "") + (messageBuffer.reply? " message-reply" : ""),
                
                attr: {
                    "message-type": String(messageBuffer.type)
                },

                id: "message-" + messageBuffer.id,
                inner: [

                    ...messageBuffer.type == 0? [
                        ...messageBuffer.reply && channel && channel.messageBuffer[messageBuffer.reply]? [
                            N({inner: [
                                app.getAvatar(await app.client.profile(channel.messageBuffer[messageBuffer.reply].author)),
                                N({innerText: channel.messageBuffer[messageBuffer.reply].text.substring(0, 500).replaceAll("\n", " "), class: "message-reply-text"})
                            ], class: "message-reply-target", onclick(){ app.scrollToMessage(channel.messageBuffer[messageBuffer.reply]) }}),
                        ] : [],

                        N({inner: [
                            app.getAvatar(profile)
                        ], class: "maze-message-avatar", onclick(){ app.showProfile(messageBuffer.author, this.getBoundingClientRect().right + 15) }}),
    
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
                (await app.client.chat(messageBuffer.channel)).messageBuffer[messageBuffer.id].renderBuffer = element
            }

            return element
        },

        updateAvatar(avatarView, profile, size, badge){
            if(typeof profile === "string") profile = {avatar: profile}

            let previousSource = "";

            if(avatarView.has(".profile-avatar-source has-badge")) {
                let source = avatarView.get('.profile-avatar-source has-badge');
                previousSource = source.src || ""
                source.remove()
            }

            let isAnimated = profile.avatar && (profile.avatar.endsWith("webm") || profile.avatar.endsWith("mp4"))

            if(!size) {
                size = (+previousSource.split("size=").at(-1)) || 80
            }

            if(typeof badge !== "boolean") {
                badge = avatarView.has(".profile-presence-badge")
            }

            avatarView.set([
                N(isAnimated? "video": "img", {
                    src: "https://cdn.extragon.cloud/file/" + (profile.avatar || "826ddb1ccc499d49186262e4c8d6b53e.svg") + (!profile.avatar || profile.avatar.endsWith("svg")? "" : "?size=" + size),
                    class: "profile-avatar-source" + (badge? " has-badge": ""),
                    draggable: false,
                    ...isAnimated? {attr: ["loop", "autoplay", "muted"]}: {}
                }),
                badge? N({
                    class: "profile-presence-badge",
                    accent: profile.presence == 0? "gray": "green"
                }): ""
            ])
        },

        getAvatar(profile, size = 64, badge = false){
            if(typeof profile === "string") profile = {avatar: profile}

            let element = N({
                class: "profile-avatar-source-container",
                attr: {"user-id": typeof profile.id !== "undefined"? String(profile.id) : ""},
                inner: [
                    badge? N({
                        class: "profile-presence-badge",
                        accent: profile.presence == 0? "gray": "green"
                    }): ""
                ]
            })

            app.updateAvatar(element, profile, size, badge)

            return element
        },

        async updateProfile(id){
            await app.showProfile(id, app.ui.profileX, app.ui.profileY)
        },

        async showProfile(id, x = M.x, y = M.y){
            let container = O("#profilePopup");

            LS._topLayerInherit()

            app.ui.profileX = x
            app.ui.profileY = y

            app.ui.profileShown = true
            app.ui.profileShownID = id

            let profile = await app.client.profile(id);

            container.class("nsfw", profile.nsfw)

            container.get(".profile-bio").set(profile.bio? [
                N("h3", "About me"),
                N({inner: app.renderMarkdown(profile.bio)})
            ]: "");

            container.get(".profile-name").innerText = profile.displayname;
            
            container.get("#profile-bot-badge").style.display = profile.bot? "inline-block": "none";

            container.get(".profile-avatar").set(app.getAvatar(profile, 256));

            app.showBanner(profile.banner)

            for(let i = 0; i < 3; i++) container.style.setProperty("--custom-color-" + i, profile.colors[i] || "var(--ui)");

            O("#profilePopup").class("color", !!profile.colors[1] || !!profile.colors[2])

            container.show("flex");

            container.applyStyle({
                left: Math.min(x, innerWidth - container.getBoundingClientRect().width - 20) +"px",
                top: Math.min(y, innerHeight - container.getBoundingClientRect().height - 20) +"px"
            })
        },

        showBanner(banner, raw){
            let container = O("#profilePopup");

            container.getAll(".profile-banner :is(video, img)").all().applyStyle({display: "none"})

            if(banner){
                if(banner.endsWith("webm") || banner.endsWith("mp4")){
                    container.get(".profile-banner video").show()
                    container.get(".profile-banner video").src = (raw? "" : "https://cdn.extragon.cloud/file/") + banner;
                } else {
                    container.get(".profile-banner img").show()
                    container.get(".profile-banner img").src = (raw? "" : "https://cdn.extragon.cloud/file/") + banner + (raw? "" : "?size=544,272");
                }
            }
        },

        scrollToMessage(message){
            if(!message.renderBuffer){
                return
            }

            message.renderBuffer.scrollIntoView({
                behavior: "smooth"
            })

            message.renderBuffer.class("highlight")

            setTimeout(() => {
                message.renderBuffer.class("highlight", false)
            }, 800)
        },

        async temporary_renderPubliChannels(){
            O("#list .list-items").clear();

            let memberships = app.client.initialChannelCache || await app.client.listChannels();
            app.client.initialChannelCache = null;

            for(let membership of memberships){
                if(!membership.isMember) continue;

                if(membership.channel){
                    let channel = await app.client.chat(membership.channel);
                    
                    console.log(channel.info.unread);
    
                    channel.listItemRenderer = N({
                        class: "list-item channel" + (channel.info.unread? " unread": ""),
                        inner: [
                            N("i", {class: "bi-hash"}),
                            N("span", {
                                innerText: channel.info.name
                            })
                        ],
    
                        onclick(){
                            app.ui.openChat(membership.channel)
                        }
                    })
    
                    O("#publicChannelList").add(channel.listItemRenderer)
                } else if(membership.server){

                    O("#myServerList").add(N({
                        class: "serverIcon"
                    }))
                }

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

        if(!login || login.error){
            tabs.setActive(login.error == "outdated" ? 'outdated': 'login');
            return
        }

        let channels = await app.client.getAllChats()

        for(let channel of channels) app.handleChannelEvents(channel);

        // let error = await Mazec.initialize()

        app.temporary_renderPubliChannels()

        // Set profile information

        let profile = await app.client.profile(app.client.user.id), profileBar = O("#profileBar");

        profileBar.get(".list-avatar").set(app.getAvatar(profile, 32, true))

        profileBar.get(".profileBarName").set(N({innerText: profile.displayname}))

        app.channelContent.on("tab_changed", (id, name) => {
            O("#memberList").style.display = name == "room"? "flex": "none";
        })

        app.screen.on("tab_changed", (id, name) => {
            if(name == "settings") {
                app.ui.resetSettings();
            } else {
                O("#profilePopup").hide();
                LS._topLayer.add(O("#profilePopup"))
            }
        })

        // This code is very dirty

        O("#profileEditorBio").on("input", () => {
            O("#unsavedContent").class("visible", true)
            O("#profilePopup .profile-bio").set(O("#profileEditorBio").value? [
                N("h3", "About me"),
                N({inner: app.renderMarkdown(O("#profileEditorBio").value)})
            ]: "")
            app.profileEditorPatch.bio = O("#profileEditorBio").value;
        })

        O("#profileEditorDisplayname").on("input", () => {
            O("#unsavedContent").class("visible", true)
            O("#profilePopup .profile-name").innerText = app.profileEditorPatch.displayname = O("#profileEditorDisplayname").value || app.client.user.profile.displayname;
        })

        O("#profileEditorGradientToggle").on("change", () => {
            O("#unsavedContent").class("visible", true)
            let checked = O("#profileEditorGradientToggle").checked;
            O("#profilePopup").class("color", checked)
            app.profileEditorPatch.colors = [...app.client.user.profile.colors];

            app.profileEditorPatch.colors[1] = checked? O("#profileEditorGradientPrimary").value: "";
            app.profileEditorPatch.colors[2] = checked? O("#profileEditorGradientSecondary").value: "";
        })

        O("#profileEditorNSFWToggle").on("change", () => {
            O("#unsavedContent").class("visible", true)
            let checked = O("#profileEditorNSFWToggle").checked;
            O("#profilePopup").class("nsfw", checked)
            app.profileEditorPatch.nsfw = checked;
        })

        O("#profileEditorGradientPrimary").on("input", () => {
            O("#unsavedContent").class("visible", true)
            O("#profilePopup").style.setProperty("--custom-color-1", O("#profileEditorGradientPrimary").value)
            if(!app.profileEditorPatch.colors) app.profileEditorPatch.colors = [...app.client.user.profile.colors]
            app.profileEditorPatch.colors[1] = O("#profileEditorGradientPrimary").value
        })

        O("#profileEditorGradientSecondary").on("input", () => {
            O("#unsavedContent").class("visible", true)
            O("#profilePopup").style.setProperty("--custom-color-2", O("#profileEditorGradientSecondary").value)
            if(!app.profileEditorPatch.colors) app.profileEditorPatch.colors = [...app.client.user.profile.colors]
            app.profileEditorPatch.colors[2] = O("#profileEditorGradientSecondary").value
        });

        let croppers = {};

        async function imageCropModal(input, source, key, preview, viewport, circle){
            if(!source) return;

            O("#cropModal .cropperContainer").hide()
            O("#cropModal .modalLoading").show("flex")
            O("#settingsSaveImageButton > span").show()
            O("#settingsSaveImageButton > div").hide()

            O("#settingsSaveImageButton").onclick = null;

            app.cropModal.show()

            if(!window.Croppie) {
                await M.Script("https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.js")
                await M.Style("https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.css")
            }

            if(!croppers[key]) {
                let element = N({class: "cropper" + (circle? " circle": "")})

                croppers[key] = new Croppie(element, {
                    viewport,
                    boundary: { width: 400, height: 300 },
                });

                O(".cropperContainer").add(element)
            }

            Q(".cropper").forEach(element => element.style.display = "none")
            croppers[key].element.show()

            let sourceURL = URL.createObjectURL(source);

            if(input) input.value = null;

            setTimeout(() => {
                O("#cropModal .cropperContainer").show()
                O("#cropModal .modalLoading").hide()

                croppers[key].bind({
                    url: sourceURL
                });

                let processing;

                O("#settingsSaveImageButton").onclick = () => {
                    if(processing) return;
                    processing = true;

                    O("#settingsSaveImageButton > span").hide()
                    O("#settingsSaveImageButton > div").show()

                    URL.revokeObjectURL(sourceURL);

                    croppers[key].result('blob', 'viewport', 'webp', .6, false).then(function(blob) {
                        const image = new Image();
                        image.onload = () => {

                            const canvas = document.createElement('canvas');
                            canvas.width = image.naturalWidth;
                            canvas.height = image.naturalHeight;

                            canvas.getContext('2d').drawImage(image, 0, 0);

                            canvas.toBlob(async (blob) => {
                                app.profileEditorPatch[key] = new File([blob], source.name, {type: blob.type});
                                O("#unsavedContent").class("visible", true)

                                app.cropModal.hide()
                            }, 'image/webp');

                        };

                        let url = URL.createObjectURL(blob);

                        if(key == "banner") {
                            image.src = url;
                            app.showBanner(url, true)
                        } else image.src = O(preview).src = url;
                    });
                }
            }, 350)
        }

        O("#profileEditorAvatar").on("input", event => {
            imageCropModal(event.target, event.target.files[0], "avatar", ".profile-avatar :is(img,video)", { width: 256, height: 256 }, true)
        });

        O("#profileEditorBanner").on("input", event => {
            imageCropModal(event.target, event.target.files[0], "banner", ".profile-banner :is(img,video)", { width: 310, height: 160 })
        });

        // Load more messages when scrolling

        let loadingMessages = false;
        app.ui.messageArea.on("scroll", async event => {
            O("#messageButtons").applyStyle({display: "none"});

            if(app.activeChatID && !loadingMessages && app.ui.messageArea.scrollTop < 50 && (app.options.messageSampleSize <= Object.keys(app.activeChat.messageBuffer).length)){
                loadingMessages = true;

                app.messageOffset += app.options.messageSampleSize;
                await app.ui.fetchMessages()

                loadingMessages = false

                console.log("Should load more");
            }
        })

        // Client events

        app.client.on("heartbeat.miss", () => {
            O("#reconnection").style.display = "flex"
        })
        
        .on("disconnect", () => {
            O("#reconnection").style.display = "flex"
        })
        
        .on("connect", () => {
            O("#reconnection").style.display = "none"
        })
        
        .on("heartbeat", () => {
            O("#reconnection").style.display = "none"
        })
        
        .on("error.outdatedClient", () => {
            app.screen.setActive("outdated")
        })

        .on("presence", (user, status) => {
            console.log(user, status);

            for(let badge of Q(`[user-id="${user}"] .profile-presence-badge`)){
                badge.setAttribute("ls-accent", status === 0? "gray": "green")
            }
        })
        
        .on("profileUpdate", async (patch) => {
            if(patch.id === app.ui.profileShownID){
                app.updateProfile(patch.id)
            }

            if(patch.avatar){
                for(let element of Q(`[user-id="${patch.id}"]`)){
                    app.updateAvatar(element, app.client.profileCache[patch.id])
                }
            }
        })



        // Keyboard controls

        M.on("keyup", event => {
            switch(event.key){
                case "Escape":
                    if(app.screen.activeTab === "settings") app.screen.setActive("home");

                    else if(app.replyingMessage) app.replyingMessage = null
                break;

                default:
                    if(app.screen.activeTab === "home"){
                        if(!event.ctrlKey && !(app.ui.messageContent.hasFocus() || app.ui.messageEditContent.hasFocus()) && app.activeChat && document.activeElement.tagname !== "TEXTAREA" && /^[a-zA-Z0-9\s]$/.test(event.key)) {
                            O("#messageContent textarea").focus()

                            app.ui.messageContent

                            event.preventDefault();
                            app.ui.messageContent.replaceSelection(event.key);
                        }
                    }
                break;
            }
        })


        app.screen.setActive("home")

        O("#messageButtons").on("click", () => O("#messageButtons").applyStyle({display: "none"}))

        LS.invoke("app.ready", app);
    }

    LS.GlobalEvents.prepare({
        name: "app.ready",
        completed: true
    })
})