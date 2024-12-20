# maze-chat
"MazeChat" is an open-source chatting application built with "Maze", which utilizes its own realtime-messaging protocol and the <a href="https://github.com/the-lstv/Akeno">Akeno</a> backend. <br> <br>
This is a repo for the official **frontend AND the backend**. <br>
You can create your own frontends using the client.js file. <br>
<br>
Confused on what's frontend and what is backend? They work together, sort of.
Everything runs under Akeno, and as stated in /app.conf, the /js/backend.js is an API extension, which is all the backend that Maze needs. Its that simple, really.
<br>
<br>
**How to run:** <br>
Get Akeno, then clone this repository, change to your domain (in app.conf) and add the local path to the "config" file in Akeno. <br>
Then hot-reload/full-reload Akeno and you are done.
<br>
If you live in the future, you can also do `akeno get the-lstv/maze-chat` and be done with it.

![Screenshot from 2024-07-13 23-36-00](https://github.com/user-attachments/assets/d00e3d2a-e656-4679-a26e-ced8ef1c6ff7)


## Performance
I have no direct (self-hostable) comparsion, but I think Maze is pretty fast, and about to get much faster.<br>
For example - compared to Discord:<br><br>
**(Both tested in the same conditions, caching disabled, NOT including images, NOT including preflights, fresh Chrome instances, and no I did not test on localhost)**

### Loading speed:
| Platform | Load time | No. of requests | Size of resources | Consumed RAM | Scripting time | Rendering time |
|-|-|-|-|-|-|-|
| Discord | 7.6 seconds | 121 | 25.3MB | 110MB | 1904ms | 178ms |
| Maze | 0.7 seconds | 21 | 717kB (0.7MB) | 3MB | 49ms | 35ms |

... And as you can see, Maze singlehandedly wins every benchmark. Especially the memory consumption and scripting time - Discord consumes 107MB more than Maze! <br>
This is because Maze is much, much more lightweight than Discord, and is also written from scratch, using vanilla technologies, instead of Discord's vast amount of bloat.<br><br>
Maze is also more optimized and efficient, built for a purpose, and does not re-send data that it does not need.<br>
Instead of using JSON for its WebSocket communication, Maze uses a special binary encoding which can be as tiny as 18 bytes for a received message! How much does Discord need for the same? 927 bytes(!!), somehow

### Latency and efficiency of requests/realtime data
uhh ill add it leter
