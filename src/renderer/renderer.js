class ScreenShareApp {
    constructor() {
        this.socket = null;
        this.mediaStream = null;
        this.selectedSource = null;
        this.isHost = true;
        this.isSharing = false;
        this.isConnected = false;
        this.remoteControlEnabled = false;
        
        this.initializeUI();
        this.setupEventListeners();
        this.loadSources();
    }

    initializeUI() {
        this.hostBtn = document.getElementById('hostBtn');
        this.clientBtn = document.getElementById('clientBtn');
        this.hostMode = document.getElementById('hostMode');
        this.clientMode = document.getElementById('clientMode');
        
        // Host elements
        this.startSharingBtn = document.getElementById('startSharingBtn');
        this.stopSharingBtn = document.getElementById('stopSharingBtn');
        this.serverPortInput = document.getElementById('serverPort');
        this.sourcesList = document.getElementById('sourcesList');
        this.hostStatus = document.getElementById('hostStatus');
        this.connectionInfo = document.getElementById('connectionInfo');
        
        // Client elements
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.serverIPInput = document.getElementById('serverIP');
        this.clientPortInput = document.getElementById('clientPort');
        this.enableControlCheckbox = document.getElementById('enableControl');
        this.clientStatus = document.getElementById('clientStatus');
        this.remoteScreen = document.getElementById('remoteScreen');
        this.screenPlaceholder = document.getElementById('screenPlaceholder');
    }

    setupEventListeners() {
        // Mode switching
        this.hostBtn.addEventListener('click', () => this.switchMode(true));
        this.clientBtn.addEventListener('click', () => this.switchMode(false));
        
        // Host mode
        this.startSharingBtn.addEventListener('click', () => this.startSharing());
        this.stopSharingBtn.addEventListener('click', () => this.stopSharing());
        
        // Client mode
        this.connectBtn.addEventListener('click', () => this.connectToServer());
        this.disconnectBtn.addEventListener('click', () => this.disconnectFromServer());
        
        // Remote control
        this.remoteScreen.addEventListener('mousedown', (e) => this.handleMouseEvent(e, 'mousedown'));
        this.remoteScreen.addEventListener('mouseup', (e) => this.handleMouseEvent(e, 'mouseup'));
        this.remoteScreen.addEventListener('mousemove', (e) => this.handleMouseEvent(e, 'mousemove'));
        this.remoteScreen.addEventListener('click', (e) => this.handleMouseEvent(e, 'click'));
        this.remoteScreen.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleMouseEvent(e, 'rightclick');
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyboardEvent(e, 'keydown'));
        document.addEventListener('keyup', (e) => this.handleKeyboardEvent(e, 'keyup'));
    }

    switchMode(isHost) {
        this.isHost = isHost;
        
        if (isHost) {
            this.hostBtn.classList.add('active');
            this.clientBtn.classList.remove('active');
            this.hostMode.classList.add('active');
            this.clientMode.classList.remove('active');
            this.loadSources();
        } else {
            this.clientBtn.classList.add('active');
            this.hostBtn.classList.remove('active');
            this.clientMode.classList.add('active');
            this.hostMode.classList.remove('active');
        }
    }

    async loadSources() {
        try {
            const sources = await window.electronAPI.getSources();
            this.displaySources(sources);
        } catch (error) {
            console.error('Error loading sources:', error);
        }
    }

    displaySources(sources) {
        this.sourcesList.innerHTML = '';
        
        sources.forEach(source => {
            const sourceItem = document.createElement('div');
            sourceItem.className = 'source-item';
            sourceItem.dataset.sourceId = source.id;
            
            sourceItem.innerHTML = `
                <img src="${source.thumbnail.toDataURL()}" alt="${source.name}" class="source-thumbnail">
                <div class="source-name">${source.name}</div>
            `;
            
            sourceItem.addEventListener('click', () => this.selectSource(source, sourceItem));
            this.sourcesList.appendChild(sourceItem);
        });
    }

    selectSource(source, element) {
        // Remove previous selection
        document.querySelectorAll('.source-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Select current source
        element.classList.add('selected');
        this.selectedSource = source;
    }

    async startSharing() {
        if (!this.selectedSource) {
            alert('Please select a screen or window to share');
            return;
        }

        try {
            const port = this.serverPortInput.value;
            
            // Start server
            await window.electronAPI.startServer(port);
            
            // Get media stream
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: this.selectedSource.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                }
            });

            // Connect to local server
            this.socket = io(`http://localhost:${port}`);
            this.setupHostSocketEvents();
            
            this.isSharing = true;
            this.updateHostUI();
            this.startScreenCapture();
            
        } catch (error) {
            console.error('Error starting sharing:', error);
            alert('Failed to start screen sharing');
        }
    }

    setupHostSocketEvents() {
        this.socket.on('connect', () => {
            this.hostStatus.textContent = 'Server running - Ready for connections';
            this.hostStatus.style.background = '#c8e6c9';
            this.hostStatus.style.color = '#2e7d32';
            
            this.updateConnectionInfo();
        });

        this.socket.on('client-connected', () => {
            this.hostStatus.textContent = 'Client connected';
        });

        this.socket.on('client-disconnected', () => {
            this.hostStatus.textContent = 'Client disconnected - Waiting for connections';
        });

        this.socket.on('remote-control', (data) => {
            // Handle remote control events from client
            this.handleRemoteControl(data);
        });
    }

    async updateConnectionInfo() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            const publicIP = data.ip;
            const port = this.serverPortInput.value;
            
            this.connectionInfo.innerHTML = `
                <strong>Connection Info:</strong><br>
                Local: localhost:${port}<br>
                Network: ${this.getLocalIP()}:${port}<br>
                Public: ${publicIP}:${port}
            `;
        } catch (error) {
            console.error('Error getting IP info:', error);
        }
    }

    getLocalIP() {
        // This is a simplified approach - in a real app you'd get the actual local IP
        return '192.168.1.XXX';
    }

    startScreenCapture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const video = document.createElement('video');
        
        video.srcObject = this.mediaStream;
        video.play();
        
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const captureFrame = () => {
                if (!this.isSharing) return;
                
                ctx.drawImage(video, 0, 0);
                const frameData = canvas.toDataURL('image/jpeg', 0.8);
                
                if (this.socket) {
                    this.socket.emit('screen-frame', frameData);
                }
                
                requestAnimationFrame(captureFrame);
            };
            
            captureFrame();
        });
    }

    async stopSharing() {
        this.isSharing = false;
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        await window.electronAPI.stopServer();
        
        this.updateHostUI();
        this.hostStatus.textContent = 'Sharing stopped';
        this.hostStatus.style.background = '#ffecb3';
        this.hostStatus.style.color = '#ff8f00';
        this.connectionInfo.innerHTML = '';
    }

    updateHostUI() {
        this.startSharingBtn.disabled = this.isSharing;
        this.stopSharingBtn.disabled = !this.isSharing;
        this.serverPortInput.disabled = this.isSharing;
    }

    async connectToServer() {
        const serverIP = this.serverIPInput.value;
        const port = this.clientPortInput.value;
        this.remoteControlEnabled = this.enableControlCheckbox.checked;
        
        try {
            this.socket = io(`http://${serverIP}:${port}`);
            this.setupClientSocketEvents();
            
        } catch (error) {
            console.error('Error connecting to server:', error);
            alert('Failed to connect to server');
        }
    }

    setupClientSocketEvents() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateClientUI();
            this.clientStatus.textContent = 'Connected to server';
            this.clientStatus.style.background = '#c8e6c9';
            this.clientStatus.style.color = '#2e7d32';
            this.screenPlaceholder.style.display = 'none';
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateClientUI();
            this.clientStatus.textContent = 'Disconnected from server';
            this.clientStatus.style.background = '#ffcdd2';
            this.clientStatus.style.color = '#c62828';
            this.screenPlaceholder.style.display = 'block';
        });

        this.socket.on('screen-frame', (frameData) => {
            this.displayRemoteScreen(frameData);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            alert('Connection error');
        });
    }

    displayRemoteScreen(frameData) {
        const ctx = this.remoteScreen.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            this.remoteScreen.width = img.width;
            this.remoteScreen.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
        
        img.src = frameData;
    }

    disconnectFromServer() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.updateClientUI();
        this.clientStatus.textContent = 'Disconnected';
        this.clientStatus.style.background = '#ffecb3';
        this.clientStatus.style.color = '#ff8f00';
        this.screenPlaceholder.style.display = 'block';
    }

    updateClientUI() {
        this.connectBtn.disabled = this.isConnected;
        this.disconnectBtn.disabled = !this.isConnected;
        this.serverIPInput.disabled = this.isConnected;
        this.clientPortInput.disabled = this.isConnected;
    }

    handleMouseEvent(event, type) {
        if (!this.isConnected || !this.remoteControlEnabled || !this.socket) return;
        
        event.preventDefault();
        
        const rect = this.remoteScreen.getBoundingClientRect();
        const scaleX = this.remoteScreen.width / rect.width;
        const scaleY = this.remoteScreen.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        this.socket.emit('remote-control', {
            type: 'mouse',
            event: type,
            x: Math.round(x),
            y: Math.round(y),
            button: event.button
        });
    }

    handleKeyboardEvent(event, type) {
        if (!this.isConnected || !this.remoteControlEnabled || !this.socket) return;
        if (!this.clientMode.classList.contains('active')) return;
        
        // Only capture keyboard events when client mode is active and connected
        if (document.activeElement === this.serverIPInput || 
            document.activeElement === this.clientPortInput) return;
        
        event.preventDefault();
        
        this.socket.emit('remote-control', {
            type: 'keyboard',
            event: type,
            key: event.key,
            keyCode: event.keyCode,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey
        });
    }

    handleRemoteControl(data) {
        // This would be implemented in the server-side with robotjs
        // The main process would handle the actual mouse/keyboard control
        console.log('Remote control event:', data);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ScreenShareApp();
});