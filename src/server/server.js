const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const robot = require('robotjs');

// Get port from command line args
const port = process.argv[2] || 3000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../../')));

// Configure robotjs
robot.setXDisplayName(process.env.DISPLAY || ':0.0');
robot.setMouseDelay(2);
robot.setKeyboardDelay(10);

let hostSocket = null;
let clients = [];

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // First connection becomes the host
  if (!hostSocket) {
    hostSocket = socket;
    console.log('Host connected:', socket.id);
    
    socket.on('screen-frame', (frameData) => {
      // Broadcast screen frame to all clients
      clients.forEach(clientSocket => {
        clientSocket.emit('screen-frame', frameData);
      });
    });
    
    socket.on('disconnect', () => {
      console.log('Host disconnected');
      hostSocket = null;
      // Notify all clients that host disconnected
      clients.forEach(clientSocket => {
        clientSocket.emit('host-disconnected');
      });
    });
    
  } else {
    // This is a client connection
    clients.push(socket);
    console.log('Client connected:', socket.id);
    
    // Notify host about client connection
    if (hostSocket) {
      hostSocket.emit('client-connected', socket.id);
    }
    
    socket.on('remote-control', (data) => {
      try {
        handleRemoteControl(data);
      } catch (error) {
        console.error('Error handling remote control:', error);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      clients = clients.filter(client => client.id !== socket.id);
      
      // Notify host about client disconnection
      if (hostSocket) {
        hostSocket.emit('client-disconnected', socket.id);
      }
    });
  }
});

function handleRemoteControl(data) {
  if (data.type === 'mouse') {
    switch (data.event) {
      case 'mousemove':
        robot.moveMouse(data.x, data.y);
        break;
      case 'mousedown':
        robot.mouseToggle('down', data.button === 2 ? 'right' : 'left');
        break;
      case 'mouseup':
        robot.mouseToggle('up', data.button === 2 ? 'right' : 'left');
        break;
      case 'click':
        robot.mouseClick(data.button === 2 ? 'right' : 'left');
        break;
      case 'rightclick':
        robot.mouseClick('right');
        break;
    }
  } else if (data.type === 'keyboard') {
    switch (data.event) {
      case 'keydown':
        try {
          // Handle special keys
          const modifiers = [];
          if (data.ctrlKey) modifiers.push('control');
          if (data.altKey) modifiers.push('alt');
          if (data.shiftKey) modifiers.push('shift');
          if (data.metaKey) modifiers.push('command');
          
          let key = data.key;
          
          // Map special keys
          const keyMap = {
            'Enter': 'enter',
            'Backspace': 'backspace',
            'Tab': 'tab',
            'Escape': 'escape',
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'Delete': 'delete',
            'Home': 'home',
            'End': 'end',
            'PageUp': 'pageup',
            'PageDown': 'pagedown',
            ' ': 'space'
          };
          
          if (keyMap[key]) {
            key = keyMap[key];
          }
          
          if (modifiers.length > 0) {
            robot.keyTap(key, modifiers);
          } else {
            robot.keyTap(key);
          }
        } catch (error) {
          console.error('Error sending key:', error);
        }
        break;
    }
  }
}

server.listen(port, () => {
  console.log(`Screen share server running on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});