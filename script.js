// Detección de dispositivo
class DeviceDetector {
    constructor() {
        this.userAgent = navigator.userAgent || navigator.vendor || window.opera;
        this.isDesktop = this.detectDesktop();
        this.isMobile = this.detectMobile();
        this.isTablet = this.detectTablet();
        this.deviceType = this.getDeviceType();
        this.orientation = this.getOrientation();
        
        this.initializeDeviceOptimizations();
        this.addOrientationListener();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(this.userAgent) ||
               (window.innerWidth <= 768) ||
               ('ontouchstart' in window);
    }

    detectTablet() {
        return /iPad|Android(?=.*Tablet)|(?=.*\bTablet\b)(?=.*\bFirefox\b)|Kindle|Silk|PlayBook/i.test(this.userAgent) ||
               (window.innerWidth > 768 && window.innerWidth <= 1024 && 'ontouchstart' in window);
    }

    detectDesktop() {
        return !this.detectMobile() && !this.detectTablet() && window.innerWidth > 1024;
    }

    getDeviceType() {
        if (this.isMobile && !this.isTablet) return 'mobile';
        if (this.isTablet) return 'tablet';
        if (this.isDesktop) return 'desktop';
        return 'unknown';
    }

    getOrientation() {
        if (window.innerHeight > window.innerWidth) return 'portrait';
        return 'landscape';
    }

    initializeDeviceOptimizations() {
        document.body.setAttribute('data-device', this.deviceType);
        document.body.setAttribute('data-orientation', this.orientation);
        
        // Aplicar optimizaciones específicas por dispositivo
        if (this.isMobile) {
            this.applyMobileOptimizations();
        } else if (this.isTablet) {
            this.applyTabletOptimizations();
        } else {
            this.applyDesktopOptimizations();
        }
    }

    applyMobileOptimizations() {
        // Prevenir zoom en inputs
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }

        // Optimizar textarea para móviles
        document.addEventListener('DOMContentLoaded', () => {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.setAttribute('autocomplete', 'off');
                messageInput.setAttribute('autocorrect', 'off');
                messageInput.setAttribute('autocapitalize', 'sentences');
                messageInput.setAttribute('spellcheck', 'true');
            }
        });

        // Configurar gesture handling
        this.setupMobileGestures();
    }

    applyTabletOptimizations() {
        // Optimizaciones específicas para tablets
        document.body.classList.add('tablet-layout');
    }

    applyDesktopOptimizations() {
        // Optimizaciones específicas para desktop
        document.body.classList.add('desktop-layout');
    }

    setupMobileGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        let isSwiping = false;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = false;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (Math.abs(e.touches[0].clientX - touchStartX) > 10) {
                isSwiping = true;
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!isSwiping) return;

            const touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchEndX - touchStartX;
            const sidebar = document.getElementById('sidebar');

            // Swipe desde la izquierda para abrir sidebar
            if (touchStartX < 20 && deltaX > 50 && sidebar) {
                sidebar.classList.add('open');
            }
            // Swipe hacia la izquierda para cerrar sidebar
            else if (deltaX < -50 && sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        }, { passive: true });
    }

    addOrientationListener() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.orientation = this.getOrientation();
                document.body.setAttribute('data-orientation', this.orientation);
                this.handleOrientationChange();
            }, 100);
        });

        window.addEventListener('resize', () => {
            this.orientation = this.getOrientation();
            document.body.setAttribute('data-orientation', this.orientation);
            this.handleOrientationChange();
        });
    }

    handleOrientationChange() {
        // Cerrar sidebar en cambio de orientación en móviles
        if (this.isMobile) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }

        // Reajustar elementos de UI
        if (window.UI) {
            window.UI.handleDeviceOrientationChange();
        }
    }
}

// Configuración global
const CONFIG = {
    API_BASE: 'https://back-end-orzion-pro.onrender.com',
    TYPING_SPEED: 1, // milisegundos por carácter
    WELCOME_DURATION: 4000, // 4 segundos
    AUTO_SAVE_INTERVAL: 30000, // 30 segundos
    MAX_CHAT_HISTORY: 50,
    STORAGE_KEYS: {
        USER: 'orzion_user',
        CURRENT_CHAT: 'orzion_current_chat',
        SETTINGS: 'orzion_settings',
        THEME: 'orzion_theme'
    }
};

// Estado global de la aplicación
class AppState {
    constructor() {
        this.currentUser = null;
        this.currentChatId = null;
        this.chatHistory = [];
        this.userMemory = [];
        this.isTyping = false;
        this.isStreaming = true;
        this.activeTools = [];
        this.welcomeShown = false;
        this.currentTheme = 'light';
        this.currentPersonality = 'professional';
        this.isFirstTime = true;
        this.personalities = {};
        this.welcomeMessages = [];
        this.currentWelcomeMessage = null;
        this.streamController = null;
        this.isGenerating = false;
    }

    // Gestión de usuario
    setUser(username) {
        this.currentUser = username;
        this.userMemory = [];
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, username);
        this.loadUserSettings();
        this.loadUserData();
        this.loadUserMemory();
    }

    // Cargar configuraciones del usuario
    async loadUserSettings() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/user-settings/${this.currentUser}`);
            const data = await response.json();

            this.currentTheme = data.settings.theme || 'light';
            this.currentPersonality = data.settings.personality || 'professional';
            this.isFirstTime = data.settings.first_time !== false;
            this.personalities = data.personalities || {};
            this.welcomeMessages = data.welcome_messages || [];

            // Aplicar tema
            this.applyTheme(this.currentTheme);

            // Mostrar configuración inicial si es primera vez
            if (this.isFirstTime) {
                UI.showInitialSetup();
            }
        } catch (error) {
            console.error('Error cargando configuraciones:', error);
        }
    }

    // Aplicar tema
    applyTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, theme);
    }

    // Guardar configuraciones
    async saveSettings() {
        try {
            await fetch(`${CONFIG.API_BASE}/update-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.currentUser,
                    theme: this.currentTheme,
                    personality: this.currentPersonality
                })
            });
        } catch (error) {
            console.error('Error guardando configuraciones:', error);
        }
    }

    // Configuración inicial
    async completeInitialSetup(theme, personality) {
        try {
            await fetch(`${CONFIG.API_BASE}/initial-setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.currentUser,
                    theme: theme,
                    personality: personality
                })
            });

            this.currentTheme = theme;
            this.currentPersonality = personality;
            this.isFirstTime = false;
            this.applyTheme(theme);
        } catch (error) {
            console.error('Error completando configuración inicial:', error);
        }
    }

    // Obtener mensaje de bienvenida
    async getWelcomeMessage() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/welcome-message/${this.currentUser}`);
            const data = await response.json();
            this.currentWelcomeMessage = data.welcome_message;
            return this.currentWelcomeMessage;
        } catch (error) {
            console.error('Error obteniendo mensaje de bienvenida:', error);
            return this.welcomeMessages[0] || {
                title: "¡Bienvenido a Orzion Pro!",
                subtitle: "Tu asistente de IA más avanzado",
                message: "¿En qué puedo ayudarte hoy?"
            };
        }
    }

    // Detener generación
    stopGeneration() {
        if (this.streamController) {
            this.streamController.abort();
            this.streamController = null;
        }
        this.isGenerating = false;
        UI.setTypingState(false);
    }

    getUser() {
        return this.currentUser || localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    }

    clearUser() {
        this.currentUser = null;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_CHAT);
    }

    // Gestión de chat
    createNewChat() {
        this.currentChatId = generateUniqueId();
        this.chatHistory = [];
        localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_CHAT, this.currentChatId);
        this.saveCurrentChat();
    }

    loadUserData() {
        const savedChatId = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_CHAT);
        if (savedChatId) {
            this.currentChatId = savedChatId;
            this.loadChatFromHistory(savedChatId);
        } else {
            this.createNewChat();
        }
    }

    saveCurrentChat() {
        if (this.chatHistory.length > 0) {
            const chatData = {
                id: this.currentChatId,
                title: this.generateChatTitle(),
                messages: this.chatHistory,
                username: this.currentUser
            };

            // Guardar en servidor
            this.saveChatToServer(chatData);
        }
    }

    generateChatTitle() {
        if (this.chatHistory.length > 0) {
            const firstMessage = this.chatHistory[0];
            return firstMessage.content.substring(0, 50) + (firstMessage.content.length > 50 ? '...' : '');
        }
        return 'Nuevo Chat';
    }

    async saveChatToServer(chatData) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/save-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatData)
            });

            if (!response.ok) {
                console.error('Error guardando chat:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error guardando chat:', error);
        }
    }

    async loadChatFromHistory(chatId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/chat-history/${this.currentUser}`);
            const data = await response.json();
            const chat = data.chat_histories.find(c => c.id === chatId);
            if (chat) {
                this.chatHistory = chat.messages;
                this.currentChatId = chatId;
                localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_CHAT, chatId);
                UI.displayChatHistory();
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    }

    // Cargar memoria de todos los chats del usuario para contexto global
    async loadUserMemory() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/chat-history/${this.currentUser}`);
            const data = await response.json();
            this.userMemory = data.chat_histories || [];
            return this.userMemory;
        } catch (error) {
            console.error('Error cargando memoria del usuario:', error);
            return [];
        }
    }
}

// Gestión de UI
class UIManager {
    constructor() {
        this.elements = {};
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Pantallas principales
        this.elements.authScreen = document.getElementById('authScreen');
        this.elements.chatScreen = document.getElementById('chatScreen');
        this.elements.welcomeScreen = document.getElementById('welcomeScreen');
        this.elements.initialSetupScreen = document.getElementById('initialSetupScreen');
        this.elements.settingsScreen = document.getElementById('settingsScreen');

        // Elementos de autenticación
        this.elements.loginForm = document.getElementById('loginForm');
        this.elements.registerForm = document.getElementById('registerForm');
        this.elements.authTabs = document.querySelectorAll('.auth-tab');

        // Elementos de chat
        this.elements.sidebar = document.getElementById('sidebar');
        this.elements.sidebarToggle = document.getElementById('sidebarToggle');
        this.elements.chatMessages = document.getElementById('chatMessages');
        this.elements.messageInput = document.getElementById('messageInput');
        this.elements.sendButton = document.getElementById('sendButton');
        this.elements.typingIndicator = document.getElementById('typingIndicator');
        this.elements.errorMessage = document.getElementById('errorMessage');

        // Controles
        this.elements.modelSelect = document.getElementById('modelSelect');
        this.elements.streamToggle = document.getElementById('streamToggle');
        this.elements.toolsToggle = document.getElementById('toolsToggle');
        this.elements.stopButton = document.getElementById('stopButton');
        this.elements.themeToggle = document.getElementById('themeToggle');
        this.elements.settingsButton = document.getElementById('settingsButton');

        // Sidebar elementos
        this.elements.usernameDisplay = document.getElementById('usernameDisplay');
        this.elements.chatHistoryList = document.getElementById('chatHistoryList');
        this.elements.newChatBtn = document.getElementById('newChatBtn');
        this.elements.logoutBtn = document.getElementById('logoutBtn');
        this.elements.proToolBtns = document.querySelectorAll('.tool-btn');

        // Optimizaciones móviles
        this.setupMobileOptimizations();
    }

    setupMobileOptimizations() {
        // Configurar input de mensaje para móviles
        if (this.elements.messageInput && window.deviceDetector && window.deviceDetector.isMobile) {
            // Prevenir zoom automático en iOS
            this.elements.messageInput.addEventListener('focus', this.handleMobileFocus.bind(this));
            this.elements.messageInput.addEventListener('blur', this.handleMobileBlur.bind(this));
            
            // Mejorar experiencia de escritura en móviles
            this.elements.messageInput.addEventListener('input', this.handleMobileInput.bind(this));
        }

        // Configurar sidebar para móviles
        if (window.deviceDetector && window.deviceDetector.isMobile) {
            this.setupMobileSidebar();
        }
    }

    handleMobileFocus(e) {
        // Scroll automático al input en móviles
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        // Expandir área de escritura en móviles
        if (window.deviceDetector && window.deviceDetector.isMobile) {
            document.body.classList.add('mobile-input-focused');
        }
    }

    handleMobileBlur(e) {
        // Remover clase de foco móvil
        document.body.classList.remove('mobile-input-focused');
    }

    handleMobileInput(e) {
        // Auto-resize más agresivo en móviles
        if (window.deviceDetector && window.deviceDetector.isMobile) {
            this.autoResizeTextarea();
            
            // Scroll automático mientras escribe
            setTimeout(() => {
                this.scrollToBottom();
            }, 100);
        }
    }

    setupMobileSidebar() {
        // Hacer sidebar más fácil de usar en móviles
        if (this.elements.sidebar) {
            // Touch overlay para cerrar sidebar
            const overlay = document.createElement('div');
            overlay.className = 'mobile-sidebar-overlay';
            overlay.addEventListener('click', () => {
                this.elements.sidebar.classList.remove('open');
            });
            document.body.appendChild(overlay);

            // Mostrar/ocultar overlay basado en estado del sidebar
            const observer = new MutationObserver(() => {
                if (this.elements.sidebar.classList.contains('open')) {
                    overlay.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                } else {
                    overlay.style.display = 'none';
                    document.body.style.overflow = '';
                }
            });

            observer.observe(this.elements.sidebar, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    handleDeviceOrientationChange() {
        // Reajustar UI en cambio de orientación
        setTimeout(() => {
            this.autoResizeTextarea();
            this.scrollToBottom();
            
            // Cerrar sidebar en cambio de orientación
            if (window.deviceDetector && window.deviceDetector.isMobile && this.elements.sidebar) {
                this.elements.sidebar.classList.remove('open');
            }
        }, 100);
    }

    attachEventListeners() {
        // Autenticación
        this.elements.authTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
        });

        this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.elements.registerForm.addEventListener('submit', (e) => this.handleRegister(e));

        // Chat
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keydown', (e) => this.handleInputKeydown(e));
        this.elements.messageInput.addEventListener('input', () => this.autoResizeTextarea());

        // Controles
        this.elements.streamToggle.addEventListener('click', () => this.toggleStreaming());
        this.elements.toolsToggle.addEventListener('click', () => this.toggleTools());
        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.elements.logoutBtn.addEventListener('click', () => this.logout());

        // Nuevos controles
        if (this.elements.stopButton) {
            this.elements.stopButton.addEventListener('click', () => this.stopGeneration());
        }
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.elements.settingsButton) {
            this.elements.settingsButton.addEventListener('click', () => this.showSettings());
        }

        // Sidebar
        this.elements.sidebarToggle.addEventListener('click', () => this.toggleSidebar());

        // Herramientas Pro
        this.elements.proToolBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleToolClick(btn.dataset.tool));
        });

        // Eventos globales
        window.addEventListener('resize', () => this.handleResize());
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    // Gestión de autenticación
    switchAuthTab(tab) {
        this.elements.authTabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        document.getElementById(`${tab}Form`).classList.add('active');
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showError('Por favor complete todos los campos');
            return;
        }

        try {
            console.log('Intentando login para usuario:', username);
            
            const response = await fetch(`${CONFIG.API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            console.log('Respuesta del servidor:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Login exitoso:', data);
                appState.setUser(username);
                this.showChatScreen();
            } else {
                const error = await response.json();
                console.error('Error de login:', error);
                this.showError(error.detail || 'Error de autenticación');
            }
        } catch (error) {
            console.error('Error de conexión:', error);
            this.showError('Error de conexión. Verifica tu internet.');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;

        if (!username || !password) {
            this.showError('Por favor complete todos los campos');
            return;
        }

        if (username.length < 3) {
            this.showError('El username debe tener al menos 3 caracteres');
            return;
        }

        if (password.length < 4) {
            this.showError('La contraseña debe tener al menos 4 caracteres');
            return;
        }

        try {
            console.log('Intentando registro para usuario:', username);
            
            const response = await fetch(`${CONFIG.API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            console.log('Respuesta del servidor:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Registro exitoso:', data);
                appState.setUser(username);
                this.showChatScreen();
            } else {
                const error = await response.json();
                console.error('Error de registro:', error);
                this.showError(error.detail || 'Error de registro');
            }
        } catch (error) {
            console.error('Error de conexión:', error);
            this.showError('Error de conexión. Verifica tu internet.');
        }
    }

    showChatScreen() {
        this.elements.authScreen.classList.add('hidden');
        this.elements.chatScreen.classList.remove('hidden');
        this.elements.usernameDisplay.textContent = appState.getUser();
        this.loadChatHistory();

        // Mostrar información del dispositivo en consola
        this.logDeviceInfo();

        if (!appState.isFirstTime && !appState.welcomeShown) {
            this.showWelcomeAnimation();
            appState.welcomeShown = true;
        }
    }

    logDeviceInfo() {
        if (window.deviceDetector) {
            console.log(`📱 Dispositivo detectado: ${window.deviceDetector.deviceType}`);
            console.log(`📐 Orientación: ${window.deviceDetector.orientation}`);
            console.log(`📏 Resolución: ${window.innerWidth}x${window.innerHeight}`);
            console.log(`🤖 User Agent: ${navigator.userAgent}`);
            
            // Mostrar notificación temporal en UI
            const deviceType = window.deviceDetector.deviceType;
            const emoji = deviceType === 'mobile' ? '📱' : deviceType === 'tablet' ? '📱' : '💻';
            this.showError(`${emoji} Optimizado para ${deviceType}`, 'info');
        }
    }

    // Mostrar configuración inicial
    showInitialSetup() {
        this.elements.initialSetupScreen.classList.remove('hidden');
        this.elements.chatScreen.classList.add('hidden');

        // Llenar opciones de personalidad
        const personalitySelect = document.getElementById('personalitySelect');
        if (personalitySelect) {
            personalitySelect.innerHTML = '';
            Object.entries(appState.personalities).forEach(([key, personality]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${personality.name} - ${personality.description}`;
                personalitySelect.appendChild(option);
            });
        }
    }

    // Completar configuración inicial
    async completeSetup() {
        const theme = document.querySelector('input[name="theme"]:checked').value;
        const personality = document.getElementById('personalitySelect').value;

        await appState.completeInitialSetup(theme, personality);

        this.elements.initialSetupScreen.classList.add('hidden');
        this.showChatScreen();
        this.showWelcomeAnimation();
        appState.welcomeShown = true;
    }

    async showWelcomeAnimation() {
        // Obtener mensaje de bienvenida dinámico
        const welcomeMsg = await appState.getWelcomeMessage();

        // Actualizar contenido de bienvenida
        document.querySelector('.welcome-title').textContent = welcomeMsg.title;
        document.querySelector('.welcome-subtitle').textContent = welcomeMsg.subtitle;
        document.querySelector('.welcome-hint').textContent = welcomeMsg.message;

        this.elements.welcomeScreen.style.display = 'flex';
        this.elements.welcomeScreen.style.opacity = '1';
        this.elements.welcomeScreen.style.transform = 'scale(1)';

        // Ocultar elementos del chat durante la bienvenida
        this.elements.chatMessages.style.display = 'none';
        document.querySelector('.chat-header').style.display = 'none';

        // Mostrar bienvenida por tiempo completo
        setTimeout(() => {
            this.elements.welcomeScreen.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
            this.elements.welcomeScreen.style.opacity = '0';
            this.elements.welcomeScreen.style.transform = 'scale(1.2)';

            setTimeout(() => {
                this.elements.welcomeScreen.style.display = 'none';
                this.elements.chatMessages.style.display = 'block';
                document.querySelector('.chat-header').style.display = 'block';
                this.elements.messageInput.focus();
            }, 1000);
        }, CONFIG.WELCOME_DURATION);
    }

    hideWelcomeScreen() {
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            this.elements.welcomeScreen.style.opacity = '0';
            this.elements.welcomeScreen.style.transform = 'scale(1.1)';

            setTimeout(() => {
                this.elements.welcomeScreen.style.display = 'none';
                this.elements.chatMessages.style.display = 'block';
                document.querySelector('.chat-header').style.display = 'block';
            }, 500);
        }
    }

    // Gestión de mensajes
    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message || appState.isTyping) return;

        // Ocultar pantalla de bienvenida si está visible
        if (this.elements.welcomeScreen && this.elements.welcomeScreen.style.display !== 'none') {
            this.hideWelcomeScreen();
        }

        // Añadir mensaje del usuario
        const userMessage = { role: 'user', content: message, timestamp: new Date() };
        appState.chatHistory.push(userMessage);
        this.displayMessage(userMessage);

        // Limpiar input
        this.elements.messageInput.value = '';
        this.autoResizeTextarea();

        // Deshabilitar envío y habilitar detención
        this.setTypingState(true);
        appState.isGenerating = true;

        try {
            const modelName = this.elements.modelSelect.value;
            const tools = appState.activeTools;

            // Crear AbortController para poder detener la petición
            appState.streamController = new AbortController();

            const response = await fetch(`${CONFIG.API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: message,
                    model_name: modelName,
                    stream: appState.isStreaming,
                    tools: tools,
                    username: appState.currentUser,
                    chat_history: appState.chatHistory
                }),
                signal: appState.streamController.signal
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const botMessage = { role: 'assistant', content: '', timestamp: new Date() };
            appState.chatHistory.push(botMessage);

            if (appState.isStreaming) {
                await this.handleStreamingResponse(response, botMessage);
            } else {
                const data = await response.json();
                botMessage.content = data.choices[0].message.content;
                this.displayMessage(botMessage);
            }

        } catch (error) {
            if (error.name !== 'AbortError') {
                this.showError(`Error: ${error.message}`);
            }
        } finally {
            this.setTypingState(false);
            appState.isGenerating = false;
            appState.streamController = null;
            appState.saveCurrentChat();
        }
    }

    async handleStreamingResponse(response, botMessage) {
        const messageElement = this.displayMessage(botMessage);
        const contentElement = messageElement.querySelector('.message-content');
        let tempContent = '';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices && data.choices[0].delta.content) {
                                const newContent = data.choices[0].delta.content;
                                botMessage.content += newContent;
                                tempContent += newContent;

                                // Renderizar markdown en tiempo real
                                this.renderMarkdownRealTime(contentElement, botMessage.content);

                                // Escritura progresiva más suave
                                await new Promise(resolve => setTimeout(resolve, CONFIG.TYPING_SPEED));
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            // Ignorar líneas malformadas
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error en streaming:', error);
        }

        // Renderizar markdown final con highlighting completo
        this.renderMarkdown(contentElement, botMessage.content);
    }

    async typeText(element, text) {
        for (const char of text) {
            element.textContent += char;
            await new Promise(resolve => setTimeout(resolve, CONFIG.TYPING_SPEED));
            this.scrollToBottom();
        }
    }

    displayMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role === 'user' ? 'user-message' : 'bot-message'}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = message.role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const content = document.createElement('div');
        content.className = 'message-content';

        if (message.role === 'user') {
            content.innerHTML = this.escapeHtml(message.content);
        } else {
            this.renderMarkdown(content, message.content);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        return messageDiv;
    }

    renderMarkdownRealTime(element, content) {
        // Renderizado básico en tiempo real sin syntax highlighting completo
        let html = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/\n/g, '<br>');

        // Detectar bloques de código en tiempo real
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'text';
            const codeId = generateUniqueId();
            return `
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="code-language">${language}</span>
                        <button class="copy-button" onclick="copyCode('${codeId}')">
                            <i class="fas fa-copy"></i> Copiar
                        </button>
                    </div>
                    <div class="code-block">
                        <pre><code id="${codeId}" class="language-${language}">${this.escapeHtml(code)}</code></pre>
                    </div>
                </div>
            `;
        });

        element.innerHTML = html;
    }

    renderMarkdown(element, content) {
        // Configurar marked.js para soporte avanzado
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {}
                }
                return hljs.highlightAuto(code).value;
            },
            langPrefix: 'hljs language-',
            breaks: true,
            gfm: true
        });

        let html = marked.parse(content);

        // Procesar bloques de código para añadir botones de copiar estilo ChatGPT
        html = html.replace(/<pre><code class="hljs language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
            const codeId = generateUniqueId();

            return `
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="code-language">${lang}</span>
                        <div class="code-actions">
                            <button class="copy-button" onclick="copyCode('${codeId}')" title="Copiar código">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="code-content">
                        <pre><code id="${codeId}" class="hljs language-${lang}">${code}</code></pre>
                    </div>
                </div>
            `;
        });

        // También manejar bloques sin lenguaje especificado
        html = html.replace(/<pre><code class="hljs">([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
            const codeId = generateUniqueId();

            return `
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="code-language">texto</span>
                        <div class="code-actions">
                            <button class="copy-button" onclick="copyCode('${codeId}')" title="Copiar código">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="code-content">
                        <pre><code id="${codeId}" class="hljs">${code}</code></pre>
                    </div>
                </div>
            `;
        });

        element.innerHTML = html;

        // Aplicar highlight.js después del renderizado
        element.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    // Utilidades de UI
    setTypingState(isTyping) {
        appState.isTyping = isTyping;
        this.elements.sendButton.disabled = isTyping;

        // Mostrar/ocultar botón de detener
        if (this.elements.stopButton) {
            this.elements.stopButton.style.display = isTyping ? 'flex' : 'none';
        }

        if (isTyping) {
            this.elements.typingIndicator.classList.add('show');
        } else {
            this.elements.typingIndicator.classList.remove('show');
        }
    }

    // Detener generación
    stopGeneration() {
        appState.stopGeneration();
        this.showError('Generación detenida por el usuario', 'info');
    }

    // Cambiar tema
    toggleTheme() {
        const newTheme = appState.currentTheme === 'light' ? 'dark' : 'light';
        appState.applyTheme(newTheme);
        appState.saveSettings();

        // Actualizar icono del botón
        const icon = this.elements.themeToggle.querySelector('i');
        if (icon) {
            icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Mostrar configuraciones
    showSettings() {
        this.elements.settingsScreen.classList.remove('hidden');
        this.populateSettings();
    }

    // Llenar configuraciones actuales
    populateSettings() {
        const themeRadios = document.querySelectorAll('input[name="settingsTheme"]');
        themeRadios.forEach(radio => {
            radio.checked = radio.value === appState.currentTheme;
        });

        const personalitySelect = document.getElementById('settingsPersonality');
        if (personalitySelect) {
            personalitySelect.value = appState.currentPersonality;
        }
    }

    // Guardar configuraciones
    async saveSettingsChanges() {
        const theme = document.querySelector('input[name="settingsTheme"]:checked').value;
        const personality = document.getElementById('settingsPersonality').value;

        appState.currentTheme = theme;
        appState.currentPersonality = personality;
        appState.applyTheme(theme);
        await appState.saveSettings();

        this.elements.settingsScreen.classList.add('hidden');
        this.showError('Configuración guardada exitosamente', 'success');

        // Actualizar icono de tema
        this.updateThemeIcon();
    }

    // Actualizar icono de tema
    updateThemeIcon() {
        const icon = this.elements.themeToggle.querySelector('i');
        if (icon) {
            icon.className = appState.currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    showError(message, type = 'error') {
        this.elements.errorMessage.classList.remove('error', 'success', 'info');
        this.elements.errorMessage.classList.add('show', type);
        document.getElementById('errorText').textContent = message;

        const icon = this.elements.errorMessage.querySelector('i');
        if (icon) {
            switch (type) {
                case 'success':
                    icon.className = 'fas fa-check-circle';
                    break;
                case 'info':
                    icon.className = 'fas fa-info-circle';
                    break;
                default:
                    icon.className = 'fas fa-exclamation-triangle';
            }
        }

        setTimeout(() => {
            this.elements.errorMessage.classList.remove('show');
        }, 5000);
    }

    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    // Gestión de historial
    async loadChatHistory() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/chat-history/${appState.getUser()}`);
            const data = await response.json();

            this.elements.chatHistoryList.innerHTML = '';

            data.chat_histories.forEach(chat => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <div class="history-content">
                        <div class="history-title">${chat.title}</div>
                        <div class="history-date">${this.formatDate(chat.created_at)}</div>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn rename-btn" data-chat-id="${chat.id}" title="Renombrar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="history-action-btn delete-btn" data-chat-id="${chat.id}" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;

                // Click en el contenido para cargar chat
                const content = historyItem.querySelector('.history-content');
                content.addEventListener('click', () => {
                    appState.loadChatFromHistory(chat.id);
                });

                // Botón de renombrar
                const renameBtn = historyItem.querySelector('.rename-btn');
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.renameChat(chat.id, chat.title);
                });

                // Botón de eliminar
                const deleteBtn = historyItem.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteChat(chat.id, chat.title);
                });

                this.elements.chatHistoryList.appendChild(historyItem);
            });
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    }

    // Renombrar chat
    async renameChat(chatId, currentTitle) {
        const newTitle = prompt('Nuevo nombre para el chat:', currentTitle);
        if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/rename-chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: appState.currentUser,
                        chat_id: chatId,
                        new_title: newTitle.trim()
                    })
                });

                if (response.ok) {
                    this.loadChatHistory();
                    this.showError('Chat renombrado exitosamente', 'success');
                } else {
                    this.showError('Error al renombrar el chat', 'error');
                }
            } catch (error) {
                console.error('Error de conexión:', error);
                this.showError('Error de conexión. Verifica tu internet.');
            }
        }
    }

    // Eliminar chat
    async deleteChat(chatId, title) {
        if (confirm(`¿Estás seguro de que quieres eliminar el chat "${title}"?`)) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/delete-chat`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: appState.currentUser,
                        chat_id: chatId
                    })
                });

                if (response.ok) {
                    this.loadChatHistory();
                    this.showError('Chat eliminado exitosamente', 'success');

                    // Si era el chat actual, crear uno nuevo
                    if (appState.currentChatId === chatId) {
                        this.createNewChat();
                    }
                } else {
                    this.showError('Error al eliminar el chat', 'error');
                }
            } catch (error) {
                console.error('Error de conexión:', error);
                this.showError('Error de conexión. Verifica tu internet.');
            }
        }
    }

    displayChatHistory() {
        this.elements.chatMessages.innerHTML = '';
        appState.chatHistory.forEach(message => {
            this.displayMessage(message);
        });
    }

    // Controles de funcionalidad
    toggleStreaming() {
        appState.isStreaming = !appState.isStreaming;
        this.elements.streamToggle.classList.toggle('active', appState.isStreaming);
    }

    toggleTools() {
        const isActive = this.elements.toolsToggle.classList.contains('active');
        this.elements.toolsToggle.classList.toggle('active', !isActive);

        if (!isActive) {
            appState.activeTools = ['code', 'translate', 'summarize', 'analyze'];
        } else {
            appState.activeTools = [];
        }
    }

    handleToolClick(tool) {
        const prompts = {
            code: 'Actúa como un generador de código experto. Ayúdame a crear código de alta calidad para: ',
            translate: 'Actúa como un traductor profesional. Traduce el siguiente texto: ',
            summarize: 'Actúa como un especialista en resumir contenido. Resume de manera concisa: ',
            analyze: 'Actúa como un analista de datos experto. Analiza y proporciona insights sobre: '
        };

        const prompt = prompts[tool];
        if (prompt) {
            this.elements.messageInput.value = prompt;
            this.elements.messageInput.focus();
            this.autoResizeTextarea();
        }
    }

    toggleSidebar() {
        this.elements.sidebar.classList.toggle('open');
    }

    createNewChat() {
        appState.createNewChat();
        this.elements.chatMessages.innerHTML = '';
        this.loadChatHistory();
    }

    logout() {
        appState.clearUser();
        this.elements.chatScreen.classList.add('hidden');
        this.elements.authScreen.classList.remove('hidden');

        // Limpiar formularios
        document.querySelectorAll('input').forEach(input => input.value = '');
    }

    // Eventos de ventana
    handleResize() {
        if (window.innerWidth <= 768) {
            this.elements.sidebar.classList.remove('open');
        }
    }

    handleOutsideClick(e) {
        if (window.innerWidth <= 768 &&
            !this.elements.sidebar.contains(e.target) &&
            !this.elements.sidebarToggle.contains(e.target)) {
            this.elements.sidebar.classList.remove('open');
        }
    }

    handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    // Utilidades
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    decodeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Funciones globales para eventos
window.copyCode = function(codeId) {
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;

    const text = codeElement.textContent || codeElement.innerText;

    navigator.clipboard.writeText(text).then(() => {
        const container = codeElement.closest('.code-block-container');
        const button = container ? container.querySelector('.copy-button') : null;

        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('copied');
            button.title = 'Copiado';

            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copied');
                button.title = 'Copiar código';
            }, 2000);
        }
    }).catch(err => {
        console.error('Error copiando código:', err);
        // Fallback para navegadores más antiguos
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        } catch (e) {
            console.error('Fallback de copia también falló:', e);
        }
    });
};

// Utilidades
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Inicialización de la aplicación
const appState = new AppState();
const UI = new UIManager();

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar detector de dispositivo
    window.deviceDetector = new DeviceDetector();
    
    // Aplicar tema guardado
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light';
    appState.applyTheme(savedTheme);

    // Verificar si hay usuario logueado
    const savedUser = appState.getUser();
    if (savedUser) {
        appState.setUser(savedUser);
        // La configuración se carga automáticamente en setUser
        if (!appState.isFirstTime) {
            UI.showChatScreen();
        }
    }

    // Configurar autosave
    setInterval(() => {
        if (appState.chatHistory.length > 0) {
            appState.saveCurrentChat();
        }
    }, CONFIG.AUTO_SAVE_INTERVAL);

    // Configurar marked.js para renderizado markdown
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    console.log('Orzion Pro inicializado correctamente');
});

// Manejo de errores globales
window.addEventListener('error', (e) => {
    console.error('Error global:', e.error);
    UI.showError('Ha ocurrido un error inesperado');
});

// Manejo de promesas rechazadas
window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesa rechazada:', e.reason);
    UI.showError('Error de conexión. Verifica tu internet.');
    e.preventDefault();
});

// Exportar para debugging
window.OrzionApp = {
    state: appState,
    ui: UI,
    config: CONFIG
};