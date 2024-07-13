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

![Screenshot from 2024-07-13 14-32-11](https://github.com/user-attachments/assets/6ea9dbbd-cf11-43f6-9424-b4931d37cfb2)
