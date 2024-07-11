
LS.once("app.ready", async function(app) {
    LS.Resize("list", O("#list"), [0, 0, 0, 1], {snap: true})
    LS.Resize("memberList", O("#memberList"), [0, 0, 1, 0], {snap: true})

    LS._topLayer.add(O("#profilePopup"))

    M.on("click", (evt)=>{
        if(!O("#profilePopup").matches(":hover") && app.ui.profileShown && !evt.target.className.includes("maze-message-username") && !evt.target.classList.contains("list-item") && !evt.target.className.includes("maze-message-avatar")) {
            O("#profilePopup").hide();
            app.ui.profileShown = false
        }
    })

    await M.Script("https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.js");
    await M.Script("https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.5/mode/markdown/markdown.min.js");
    M.Style("https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.5/codemirror.min.css");

    app.ui.messageContent = CodeMirror(O('#messageContent'), {
        mode: 'markdown',
        theme: 'borderline',
        lineWrapping: true,
        extraKeys: {
            'Enter': function(cm) {
                app.ui.send()

                const cursor = cm.getCursor();
                const line = cm.getLine(cursor.line);

                if (cm.state.keySeq == 'Shift-Enter') {
                    cm.replaceRange('\n', cursor);
                }
            }
        }
    });

    // Emoji Rendering

    function renderEmojis(instance, line) {
        if(!line || !line.lineNo) return;

        for(let match of line.text.matchAll(/:[a-zA-Z0-9_-]+:/g)){
            const emoji = match[0];
            const emojiUrl = app.emojiMap[emoji];

            if (emojiUrl) {
                const from = CodeMirror.Pos(line.lineNo(), match.index);
                const to = CodeMirror.Pos(line.lineNo(), match.index + emoji.length);

                postEvent = true

                instance.markText(from, to, {
                    replacedWith: N("span", {
                        class: "emoji",
                        style: {
                            backgroundImage: `url(${emojiUrl})`
                        },
                        title: emoji
                    })
                });
            }
        }
    }

    let postEvent = false;

    app.ui.messageContent.on('renderLine', (instance, line, element) => {
        if(postEvent) return postEvent = false; else renderEmojis(instance, line);
    });

    app.ui.messageContent.on('change', () => {
        let value = app.ui.messageContent.doc.getValue();

        if(app.activeChat){
            localStorage["maze.previousContent." + app.activeChat.id] = value

            if(value.length > 0) app.activeChat.sendTyping()
        }
    });
})

// let element = O(messageContent), textInput = O(hiddenTextarea);

// let text = "";

// element.addEventListener('input', function() {

//     let cursor = saveCursorPosition();

//     const result = getMarkdownPreview(element, cursor);

//     element.set(result[0]);

//     restoreCursorPosition(element, cursor || 0, result[1]);
// });

// function getMarkdownPreview(element, position) {
//     let text = element.innerText,
//         parsingText = "",
//         content = N("span"),
//         currentElement = content,

//         changeFollows = false,

//         selectionContainer = content
//     ;

//     let i = 0;
//     for(let char of text.split("")){
//         parsingText += char
        
//         i++

//         if(char == "*"){
//             changeFollows = char;
//         }

//         if(i == text.length || changeFollows){
//             currentElement.set(parsingText)

//             parsingText = "";

//             if(changeFollows){
//                 let newElement = N("b");

//                 currentElement.add(newElement);

//                 currentElement = newElement;

//                 changeFollows = null;
//             }
//         }

//         if(i == position){
//             selectionContainer = currentElement
//             console.log("position matching ", position, selectionContainer);
//         }
//     }

//     return [content, selectionContainer.firstChild || content.firstChild || content];
// }

// function saveCursorPosition() {
//     const selection = window.getSelection();
//     if (selection.rangeCount > 0) {
//         const range = selection.getRangeAt(0);
//         return range.startOffset;element.innerText.length
//     }
// }
  
// function restoreCursorPosition(element, position, target) {
//     const selection = window.getSelection();
//     if (selection.rangeCount > 0) {
//         const range = document.createRange();
//         range.setStart(target || element, Math.min(position, element.innerText.length));
//         range.collapse(true);
//         selection.removeAllRanges();
//         selection.addRange(range);
//     }
// }