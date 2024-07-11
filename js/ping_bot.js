
let client = new MazecClient("http://api.extragon.test/v2/mazec");


(async () => {
    await client.login("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTE5LCJwZXJtaXNzaW9ucyI6IjE2LnciLCJhcHAiOiIxMSIsImlhdCI6MTcyMDcwMDA3MCwiZXhwIjoxNzI1ODg0MDcwfQ.zRczwDS-i6FDyyb5CTXohj01-CFZ_Qt4LXKpM6inQZ0")

    await client.initialize()

    console.log("Bot is connected and running!");

    let chat = await client.chat(13)

    if(chat.error) throw chat.error; // For example, the bot does not have access

    chat.open()

    chat.on("message", async message => {
        if(message.text == "ping"){
            chat.send("pong")
        }
    })

})()