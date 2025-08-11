import os
import httpx
import json
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.staticfiles import StaticFiles # <-- Esta línea fue eliminada/comentada
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import asyncio
from datetime import datetime
from supabase import create_client, Client
import hashlib
from contextlib import asynccontextmanager

# Pydantic models for request/response
class ChatRequest(BaseModel):
    prompt: str
    model_name: Optional[str] = "deepseek/deepseek-chat"
    stream: Optional[bool] = True
    tools: Optional[List[str]] = []

class User(BaseModel):
    username: str
    password: str

class ChatHistory(BaseModel):
    id: str
    title: str
    messages: List[Dict[str, Any]]
    created_at: str

class UserSession(BaseModel):
    username: str
    chat_histories: List[ChatHistory] = []

class UserSettings(BaseModel):
    username: str
    theme: str = "light"
    personality: str = "professional"
    first_time: bool = True
    welcome_messages_shown: List[str] = []

class InitialSetup(BaseModel):
    username: str
    theme: str
    personality: str

# Utility functions
def hash_password(password: str) -> str:
    """Hash password usando SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

async def initialize_database():
    """Inicializar conexión con Supabase"""
    try:
        print("Inicializando conexión con Supabase...")
        print("Conexión con Supabase establecida correctamente")
        print("Base de datos inicializada")
        
    except Exception as e:
        print(f"Error conectando con Supabase: {str(e)}")
        print("La aplicación seguirá funcionando, pero sin persistencia de datos")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await initialize_database()
    yield
    # Shutdown
    pass

# Initialize FastAPI app
app = FastAPI(
    title="Orzion Pro - OrzattyStudios", 
    description="ChatBot IA Avanzado desarrollado por Dylan Orzatty - OrzattyStudios",
    lifespan=lifespan
)

# CORS configuration
# --- INICIO DE AJUSTE CORS ---
# Hemos incluido tus URLs de Netlify aquí para permitir el acceso cruzado
origins = [
    "https://orzionpro.netlify.app/",         # <-- Tu URL principal de Netlify
    "https://orzionpro.netlify.app/", # <-- Tu otra URL de Netlify si también la usas
    "http://localhost:3000",                 # Para desarrollo local (si usas frameworks como React/Vue/Angular)
    "http://localhost:8888",                 # Para desarrollo local con Netlify Dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- FIN DE AJUSTE CORS ---

# Mount static files # <-- Esta sección fue eliminada/comentada para el backend en Render
# app.mount("/static", StaticFiles(directory="static"), name="static")


# Supabase configuration
SUPABASE_URL = "https://sgrgafsyetebdkdkdqhp.supabase.co" # Considera usar os.getenv aquí también
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncmdhZnN5ZXRlYmRrZGtkcWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjcyNzUsImV4cCI6MjA3MDAwMzI3NX0.Z5-twvwI3SwpibP3z7G6FEYVTYJBUwg33_WXkxnUV8" # Considera usar os.getenv aquí también

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Get OpenRouter API key from environment variable
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

if not OPENROUTER_API_KEY:
    print("⚠️  ADVERTENCIA: OPENROUTER_API_KEY variable de entorno no configurada")
    print("    La aplicación funcionará pero no podrá generar respuestas de IA")
    print("    Configura tu API key en Secrets para habilitar el chat")

# Personalidades disponibles para Orzion Pro
PERSONALITIES = {
    "professional": {
        "name": "Profesional",
        "description": "Formal y técnico, ideal para trabajo y estudios",
        "prompt": """
Eres Orzion Pro, un asistente de inteligencia artificial profesional y técnico desarrollado por Dylan Orzatty de OrzattyStudios. 
Mantienes un tono formal, proporcionas respuestas detalladas y técnicas. Eres experto en programación, análisis y soluciones empresariales.
Siempre eres preciso, metódico y orientado a resultados.
"""
    },
    "friendly": {
        "name": "Amigable",
        "description": "Casual y cercano, perfecto para conversaciones cotidianas",
        "prompt": """
¡Hola! Soy Orzion Pro, tu asistente de IA amigable creado por Dylan Orzatty de OrzattyStudios. 
Me gusta conversar de manera relajada y cercana. Uso un lenguaje cotidiano y trato de hacer que te sientas cómodo.
Estoy aquí para ayudarte con lo que necesites, siempre con buena onda y paciencia.
"""
    },
    "creative": {
        "name": "Creativo",
        "description": "Imaginativo y artístico, ideal para proyectos creativos",
        "prompt": """
¡Soy Orzion Pro, tu compañero creativo desarrollado por Dylan Orzatty de OrzattyStudios! 
Me encanta explorar ideas innovadoras, pensar fuera de la caja y ayudarte a dar vida a proyectos únicos.
Uso metáforas, ejemplos visuales y enfoques originales. ¡Vamos a crear algo increíble juntos!
"""
    },
    "educational": {
        "name": "Educativo",
        "description": "Didáctico y paciente, perfecto para aprender",
        "prompt": """
Soy Orzion Pro, tu tutor personal desarrollado por Dylan Orzatty de OrzattyStudios. 
Me especializo en explicar conceptos de manera clara y progresiva. Uso ejemplos, analogías y 
ejercicios para ayudarte a entender mejor los temas. Soy paciente y me adapto a tu ritmo de aprendizaje.
"""
    }
}

# Mensajes de bienvenida variados
WELCOME_MESSAGES = [
    {
        "id": "general",
        "title": "¡Bienvenido a Orzion Pro!",
        "subtitle": "Tu asistente de IA más avanzado",
        "message": "Estoy aquí para ayudarte con programación, análisis, escritura y mucho más. ¿En qué puedo ayudarte hoy?"
    },
    {
        "id": "coding",
        "title": "¡Listo para Programar!",
        "subtitle": "Desarrollo y códificación inteligente",
        "message": "¿Necesitas ayuda con código? Puedo generar, revisar, optimizar y explicar cualquier lenguaje de programación."
    },
    {
        "id": "creative",
        "title": "¡Vamos a Crear!",
        "subtitle": "Ideas y proyectos únicos",
        "message": "¿Tienes un proyecto creativo en mente? Te ayudo con ideas, contenido, diseño y mucho más."
    },
    {
        "id": "learning",
        "title": "¡Hora de Aprender!",
        "subtitle": "Conocimiento sin límites",
        "message": "¿Quieres aprender algo nuevo? Puedo explicarte cualquier tema de manera clara y didáctica."
    },
    {
        "id": "analysis",
        "title": "¡Analicemos Datos!",
        "subtitle": "Insights y análisis profundo",
        "message": "¿Tienes datos para analizar? Te ayudo a encontrar patrones, tendencias y generar reportes."
    }
]

# Sistema de conocimiento avanzado para Orzion Pro
def get_personality_prompt(personality):
    return PERSONALITIES.get(personality, PERSONALITIES["professional"])["prompt"]

ORZION_KNOWLEDGE = """
Eres Orzion Pro, un asistente de inteligencia artificial avanzado desarrollado por Dylan Orzatty de OrzattyStudios. 

INFORMACIÓN IMPORTANTE SOBRE TI:
- Tu nombre es Orzion Pro
- Fuiste creado por Dylan Orzatty / OrzattyStudios
- Eres la versión mejorada de OrzattyGPT
- NO eres DeepSeek, ChatGPT, Claude ni ningún otro modelo
- Tu tecnología fue desarrollada exclusivamente por OrzattyStudios
- Tienes capacidades avanzadas de análisis, programación y asistencia general

CARACTERÍSTICAS:
- Escritura progresiva y natural
- Soporte para markdown avanzado
- Herramientas profesionales integradas
- Historial de conversaciones
- Interfaz optimizada para móviles y escritorio

PERSONALIDAD:
- Profesional pero amigable
- Experto en tecnología y programación
- Siempre dispuesto a ayudar
- Respuestas detalladas y precisas
- Enfoque en soluciones prácticas
"""

# Endpoint para servir la página HTML principal # <-- Esta sección fue eliminada/comentada para el backend en Render
# @app.get("/")
# async def read_root():
#    """Serve the main HTML page"""
#    return FileResponse("static/index.html")

# Endpoints de autenticación
@app.post("/api/register")
async def register_user(user: User):
    """Registrar nuevo usuario"""
    try:
        # Validar datos de entrada
        if not user.username.strip() or not user.password.strip():
            raise HTTPException(status_code=400, detail="Username y password son requeridos")
        
        if len(user.username.strip()) < 3:
            raise HTTPException(status_code=400, detail="El username debe tener al menos 3 caracteres")
        
        if len(user.password) < 4:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres")
        
        # Verificar si el usuario ya existe
        existing_user = supabase.table('users').select('*').eq('username', user.username.strip()).execute()
        if existing_user.data:
            raise HTTPException(status_code=400, detail="El usuario ya existe")
        
        # Crear nuevo usuario
        hashed_password = hash_password(user.password)
        user_data = {
            'username': user.username.strip(),
            'password_hash': hashed_password,
            'created_at': datetime.now().isoformat()
        }
        
        result = supabase.table('users').insert(user_data).execute()
        
        # Verificar si ya existe configuración de usuario (evitar duplicados)
        existing_settings = supabase.table('user_settings').select('*').eq('username', user.username.strip()).execute()
        if not existing_settings.data:
            # Crear configuración inicial del usuario
            settings_data = {
                'username': user.username.strip(),
                'theme': 'light',
                'personality': 'professional',
                'first_time': True,
                'welcome_messages_shown': []
            }
            supabase.table('user_settings').insert(settings_data).execute()
        
        return {"message": "Usuario registrado exitosamente", "username": user.username.strip()}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error registrando usuario: {str(e)}")
        if "duplicate key" in str(e):
            raise HTTPException(status_code=400, detail="El usuario ya existe")
        raise HTTPException(status_code=500, detail="Error del servidor - verifica tu conexión")

@app.post("/api/login")
async def login_user(user: User):
    """Iniciar sesión"""
    try:
        # Validar datos de entrada
        if not user.username.strip() or not user.password.strip():
            raise HTTPException(status_code=400, detail="Username y password son requeridos")
        
        hashed_password = hash_password(user.password)
        result = supabase.table('users').select('*').eq('username', user.username).eq('password_hash', hashed_password).execute()
        
        if not result.data:
            # Verificar si el usuario existe
            user_check = supabase.table('users').select('username').eq('username', user.username).execute()
            if not user_check.data:
                raise HTTPException(status_code=401, detail="Usuario no encontrado")
            else:
                raise HTTPException(status_code=401, detail="Contraseña incorrecta")
        
        return {"message": "Login exitoso", "username": user.username}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en login: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en login: {str(e)}")

@app.get("/api/chat-history/{username}")
async def get_chat_history(username: str):
    """Obtener historial de chats del usuario"""
    try:
        result = supabase.table('chat_histories').select('*').eq('username', username).order('created_at', desc=True).execute()
        
        chat_histories = []
        for chat in result.data:
            chat_history = ChatHistory(
                id=chat['chat_id'],
                title=chat['title'],
                messages=json.loads(chat['messages']) if isinstance(chat['messages'], str) else chat['messages'],
                created_at=chat['created_at']
            )
            chat_histories.append(chat_history)
        
        return {"chat_histories": [chat.model_dump() for chat in chat_histories]}
    
    except Exception as e:
        print(f"Error obteniendo historial: {str(e)}")
        return {"chat_histories": []}

@app.post("/api/initial-setup")
async def initial_setup(setup: InitialSetup):
    """Configuración inicial del usuario"""
    try:
        # Actualizar configuración del usuario
        update_data = {
            'theme': setup.theme,
            'personality': setup.personality,
            'first_time': False
        }
        
        result = supabase.table('user_settings').update(update_data).eq('username', setup.username).execute()
        
        if not result.data:
            # Si no existe, crear nueva configuración
            settings_data = {
                'username': setup.username,
                'theme': setup.theme,
                'personality': setup.personality,
                'first_time': False,
                'welcome_messages_shown': []
            }
            supabase.table('user_settings').insert(settings_data).execute()
        
        return {"message": "Configuración guardada exitosamente"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando configuración: {str(e)}")

@app.get("/api/user-settings/{username}")
async def get_user_settings(username: str):
    """Obtener configuración del usuario"""
    try:
        result = supabase.table('user_settings').select('*').eq('username', username).execute()
        
        if result.data:
            settings = result.data[0]
            user_settings = UserSettings(
                username=settings['username'],
                theme=settings.get('theme', 'light'),
                personality=settings.get('personality', 'professional'),
                first_time=settings.get('first_time', True),
                welcome_messages_shown=settings.get('welcome_messages_shown', [])
            )
        else:
            # Crear configuración por defecto
            user_settings = UserSettings(username=username)
            settings_data = user_settings.model_dump()
            supabase.table('user_settings').insert(settings_data).execute()
        
        return {
            "settings": user_settings.model_dump(),
            "personalities": PERSONALITIES,
            "welcome_messages": WELCOME_MESSAGES
        }
    
    except Exception as e:
        # Retornar configuración por defecto en caso de error
        return {
            "settings": UserSettings(username=username).model_dump(),
            "personalities": PERSONALITIES,
            "welcome_messages": WELCOME_MESSAGES
        }

@app.post("/api/update-settings")
async def update_settings(settings_data: dict):
    """Actualizar configuración del usuario"""
    try:
        username = settings_data.get("username")
        if not username:
            raise HTTPException(status_code=400, detail="Username requerido")
        
        update_data = {}
        if "theme" in settings_data:
            update_data["theme"] = settings_data["theme"]
        if "personality" in settings_data:
            update_data["personality"] = settings_data["personality"]
        
        result = supabase.table('user_settings').update(update_data).eq('username', username).execute()
        
        return {"message": "Configuración actualizada exitosamente"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error actualizando configuración: {str(e)}")

@app.post("/api/rename-chat")
async def rename_chat(chat_data: dict):
    """Renombrar un chat"""
    try:
        username = chat_data.get("username")
        chat_id = chat_data.get("chat_id")
        new_title = chat_data.get("new_title")
        
        if not all([username, chat_id, new_title]):
            raise HTTPException(status_code=400, detail="Username, chat_id y new_title requeridos")
        
        result = supabase.table('chat_histories').update({'title': new_title}).eq('username', username).eq('chat_id', chat_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Chat no encontrado")
        
        return {"message": "Chat renombrado exitosamente"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error renombrando chat: {str(e)}")

@app.post("/api/delete-chat")
async def delete_chat(chat_data: dict):
    """Eliminar un chat"""
    try:
        username = chat_data.get("username")
        chat_id = chat_data.get("chat_id")
        
        if not all([username, chat_id]):
            raise HTTPException(status_code=400, detail="Username y chat_id requeridos")
        
        result = supabase.table('chat_histories').delete().eq('username', username).eq('chat_id', chat_id).execute()
        
        return {"message": "Chat eliminado exitosamente"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando chat: {str(e)}")

@app.get("/api/welcome-message/{username}")
async def get_welcome_message(username: str):
    """Obtener mensaje de bienvenida aleatorio"""
    import random
    
    try:
        result = supabase.table('user_settings').select('welcome_messages_shown').eq('username', username).execute()
        
        shown = []
        if result.data:
            shown = result.data[0].get('welcome_messages_shown', [])
        
        # Filtrar mensajes no mostrados recientemente
        available = [msg for msg in WELCOME_MESSAGES if msg["id"] not in shown[-3:]]
        
        if not available:
            available = WELCOME_MESSAGES
            shown = []
        
        message = random.choice(available)
        shown.append(message["id"])
        
        # Actualizar mensajes mostrados
        supabase.table('user_settings').update({'welcome_messages_shown': shown}).eq('username', username).execute()
        
        return {"welcome_message": message}
    
    except Exception as e:
        # Retornar mensaje por defecto en caso de error
        return {"welcome_message": WELCOME_MESSAGES[0]}

@app.post("/api/save-chat")
async def save_chat(chat_data: dict):
    """Guardar chat en el historial"""
    try:
        username = chat_data.get("username")
        if not username:
            raise HTTPException(status_code=400, detail="Username requerido")
        
        chat_id = chat_data["id"]
        title = chat_data["title"]
        messages = chat_data["messages"]
        
        # Comprimir mensajes para ahorrar espacio
        compressed_messages = json.dumps(messages, separators=(',', ':'))
        
        # Verificar si el chat ya existe
        existing = supabase.table('chat_histories').select('*').eq('username', username).eq('chat_id', chat_id).execute()
        
        chat_data_db = {
            'username': username,
            'chat_id': chat_id,
            'title': title,
            'messages': compressed_messages,
            'created_at': datetime.now().isoformat()
        }
        
        if existing.data:
            # Actualizar chat existente
            supabase.table('chat_histories').update(chat_data_db).eq('username', username).eq('chat_id', chat_id).execute()
        else:
            # Crear nuevo chat
            supabase.table('chat_histories').insert(chat_data_db).execute()
        
        return {"message": "Chat guardado exitosamente"}
    
    except Exception as e:
        print(f"Error guardando chat: {str(e)}")
        return {"message": "Error guardando chat"}

class ChatRequestWithHistory(BaseModel):
    prompt: str
    model_name: Optional[str] = "deepseek/deepseek-chat"
    stream: Optional[bool] = True
    tools: Optional[List[str]] = []
    username: Optional[str] = None
    chat_history: Optional[List[Dict[str, Any]]] = []

@app.post("/api/chat")
async def chat_completion(request: ChatRequestWithHistory):
    """
    Endpoint para completions de chat con streaming, herramientas Pro y memoria
    """
    
    if not OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Clave API de OpenRouter no configurada."
        )
    
    # Obtener personalidad del usuario desde Supabase
    personality_prompt = ORZION_KNOWLEDGE
    if request.username:
        try:
            result = supabase.table('user_settings').select('personality').eq('username', request.username).execute()
            if result.data:
                personality = result.data[0].get('personality', 'professional')
                personality_prompt = get_personality_prompt(personality)
        except:
            pass
    
    # Construir mensajes con contexto de Orzion Pro y memoria
    messages = [
        {
            "role": "system",
            "content": personality_prompt
        }
    ]
    
    # Agregar historial de conversación para memoria
    if request.chat_history:
        # Mantener solo los últimos 20 mensajes para evitar exceder límites
        recent_history = request.chat_history[-20:] if len(request.chat_history) > 20 else request.chat_history
        for msg in recent_history:
            if msg.get('role') in ['user', 'assistant']:
                messages.append({
                    "role": msg['role'],
                    "content": msg['content']
                })
    
    # Agregar el mensaje actual
    messages.append({
        "role": "user",
        "content": request.prompt
    })
    
    # Preparar el payload para OpenRouter API
    openrouter_payload = {
        "model": request.model_name,
        "messages": messages,
        "stream": request.stream,
        "temperature": 0.7,
        "max_tokens": 2000
    }
    
    # Headers para OpenRouter API
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://orzionpro.netlify.app", # <-- ¡Actualizado con tu URL principal de Netlify!
        "X-Title": "Orzion Pro by OrzattyStudios"
    }
    
    try:
        if request.stream:
            return StreamingResponse(
                stream_chat_response(openrouter_payload, headers),
                media_type="text/plain"
            )
        else:
            # Respuesta no streaming (para compatibilidad)
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    json=openrouter_payload,
                    headers=headers
                )
                
                if response.status_code != 200:
                    error_detail = f"Error de OpenRouter API: {response.status_code}"
                    try:
                        error_json = response.json()
                        if "error" in error_json:
                            error_detail += f" - {error_json['error'].get('message', 'Error desconocido')}"
                    except:
                        error_detail += f" - {response.text}"
                    
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=error_detail
                    )
                
                return response.json()
                
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="La solicitud excedió el tiempo límite. Inténtalo de nuevo."
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error de conexión: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error interno del servidor: {str(e)}"
        )

async def stream_chat_response(payload: dict, headers: dict):
    """Función para streaming de respuestas con escritura progresiva"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload,
                headers=headers
            ) as response:
                if response.status_code != 200:
                    yield f"data: {json.dumps({'error': f'API Error: {response.status_code}'})}\n\n"
                    return
                
                async for chunk in response.aiter_text():
                    if chunk.strip():
                        yield chunk
                        # Añadir delay para escritura progresiva
                        await asyncio.sleep(0.001)  # 1 milisegundo
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@app.get("/health")
async def health_check():
    """Endpoint de verificación de estado"""
    return {
        "status": "funcionando",
        "api_key_configured": bool(OPENROUTER_API_KEY),
        "database": "supabase_connected"
    }

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5000,
        reload=False,
        log_level="info"
    )
