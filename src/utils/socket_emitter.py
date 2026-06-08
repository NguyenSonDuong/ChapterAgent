# Global socketio instance helper to avoid circular imports.
_socketio = None

def set_socketio(socketio_instance):
    """Register the global socketio instance."""
    global _socketio
    _socketio = socketio_instance

def emit_event(event: str, data: dict, namespace: str = "/"):
    """Emit a Socket.IO event to all clients if socketio is initialized."""
    if _socketio:
        _socketio.emit(event, data, namespace=namespace)

import time
def emit_agent_log(story_uuid: str, message: str, level: str = "info"):
    """Emit a live console/system log message to the client and print to terminal."""
    print(f"[Agent Log] {message}")
    emit_event("agent_log", {
        "story_uuid": story_uuid,
        "message": message,
        "level": level,
        "time": time.strftime("%H:%M:%S")
    })

