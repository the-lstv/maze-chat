


// This is an example bot that does not really do anything, just reads messages from the chat and replies to "ping".


// Firstly, let's initialize our client, supplying the API endpoint:
let client = new MazecClient("http://api.extragon.test/v2/mazec");


client.login("BOT_TOKEN", async fragment => {

    if(!fragment) throw "Could not log-in";

    console.log("Bot logged in as", fragment.id);

    await client.initialize()

    console.log("Bot is connected and running!");




    // Let's get a chat by it's ID and listen for new events/read or send messages:

    let chat = await Mazec.chat(id)

    if(chat.error) throw chat.error; // For example, the bot does not have access

    chat.open() // Subscribe for socket updates (like new messages, edits, etc.)
    // Likewise, we unsub them with chat.close()

    // You can read messages on demand with chat.get() - either from a certain range and offset or directly fetching a message with its ID.

    console.log(" == Printing last 10 messages sent in chat ==");

    for(let message of (await chat.get(10)).reverse()){
        console.log(`<${message.author}>: ${message.text}`);
    }

    console.log(" == Now listening to new events ==");



    // Now for the fun event stuff:

    chat.on("message", async (msg)=>{
        console.log(`New message: <${message.author}>: ${message.text}`);

        if(message.text == "ping"){
            chat.send("pong")
        }
    })

    chat.on("edit", (buffer) => {
        console.log(`Message with ID ${buffer.id} got an edit: ${buffer.text}`);
    })

    chat.on("delete", (id) => {
        console.log(`Message with ID ${id} got deleted`);
    })

    chat.on("typing", (user) => {
        console.log(`User ${user} started typing in the channel`);
    })

    chat.on("typing.stop.all", () => {
        console.log(`All users stopped typing in the channel`);
    })

    // ...

    // An array of users who are currently typing in this channel, using the standard 10 second timeout. (including you!)
    chat.typingUsers

    // Make yourself type
    chat.sendTyping()




    // And there is of course a lot more stuff to do!

    return // FOLLOWING IS NOT FULLY IMPLEMENTED

    // - Global notifications
    client.enableNotifications();

    client.on("notification", notification => {
        switch (notification.type){
            case "message":
                console.log(`Got message from ${notification.channel}, ${notification.snipet}`);
            break
        }
    })

    // - Lists ALL channels including DMs
    let channels = await client.listChannels()

    // - Lists ALL servers
    let servers = await client.listServers()

    // - Get a profile of an user by their ID:
    let profile = await client.profile(0)

    // - Profile updates:
    // There will be a nicer API for this later;
    client.internal_subscribe(true, `profileUpdate.${0}`)

    client.on("profileUpdate", event => {
        console.log(`User ${event.target} updated their profile, new data: ${event.patch}`);
        
        // Update profile object on our side
        Object.assign(profile, event.patch)

        // (eg. {target: 0, patch: {pfp: "..."}} when the user updates their profile picture)
    })


    // Manipulating raw socket connection:
    // Only try this if you understand the protocol
    client.on("socket.raw", console.log) // Log raw socket data
    client.socket.send(client.arrayEncoder(["heartbeat"])) // Send a ping
})