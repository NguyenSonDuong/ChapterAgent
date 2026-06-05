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
