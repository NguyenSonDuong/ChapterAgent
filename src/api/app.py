import eventlet
eventlet.monkey_patch()

import sys
from pathlib import Path

# Add project root directory to sys.path to allow absolute imports under src
_root_dir = str(Path(__file__).resolve().parent.parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import os
import uuid
import json
import threading
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

import src.core.config as config
import src.models.story as models
from src.agent.graph import app as graph_app
from src.core.state import AgentState
from src.utils.session_manager import session_manager, SessionCancelledError
from src.utils.socket_emitter import set_socketio, emit_event

def parse_request_cultivation_stages(raw_stages):
    parsed = []
    if isinstance(raw_stages, list):
        for s in raw_stages:
            if isinstance(s, dict):
                parsed.append({
                    'name': s.get('name', '').strip(),
                    'description': s.get('description', '').strip()
                })
            elif isinstance(s, str) and s.strip():
                parsed.append({
                    'name': s.strip(),
                    'description': ''
                })
    elif isinstance(raw_stages, str):
        for s in raw_stages.split(','):
            if s.strip():
                parsed.append({
                    'name': s.strip(),
                    'description': ''
                })
    return parsed

app = Flask(__name__)
# Enable CORS for all routes (important for ReactJS frontend connection)
CORS(app)

# Initialize Socket.IO with auto-detected async mode
socketio = SocketIO(app, cors_allowed_origins="*")
set_socketio(socketio)

# ----------------------------------------------------
# Real-time Websocket event handlers
# ----------------------------------------------------

@socketio.on('connect')
def handle_connect():
    print("Socket.IO client connected")
    emit('connection_response', {'data': 'Connected successfully'})

@socketio.on('disconnect')
def handle_disconnect():
    print("Socket.IO client disconnected")

@socketio.on('submit_clarification')
def handle_submit_clarification(data):
    """Client provides clarification answers for requirement analyzer."""
    story_uuid = data.get('story_uuid')
    answers = data.get('answers')
    print(f"Received clarification for story {story_uuid}: {answers}")
    session = session_manager.get_session(story_uuid)
    if session:
        session.input_data = answers
        session.input_event.set()
        emit('response_status', {'status': 'acknowledged', 'story_uuid': story_uuid})
    else:
        emit('response_status', {'status': 'error', 'message': 'Session not found'})

@socketio.on('submit_review_feedback')
def handle_submit_review_feedback(data):
    """Client provides review feedback (or 'Done') for the chapter draft."""
    story_uuid = data.get('story_uuid')
    feedback = data.get('feedback')
    print(f"Received review feedback for story {story_uuid}: {feedback}")
    session = session_manager.get_session(story_uuid)
    if session:
        session.input_data = feedback
        session.input_event.set()
        emit('response_status', {'status': 'acknowledged', 'story_uuid': story_uuid})
    else:
        emit('response_status', {'status': 'error', 'message': 'Session not found'})

@socketio.on('submit_model_change')
def handle_submit_model_change(data):
    """Client provides a new model selection on LLM error/rate limit."""
    story_uuid = data.get('story_uuid')
    model_name = data.get('model_name')
    print(f"Received model change for story {story_uuid}: {model_name}")
    session = session_manager.get_session(story_uuid)
    if session:
        session.input_data = model_name
        session.input_event.set()
        emit('response_status', {'status': 'acknowledged', 'story_uuid': story_uuid})
    else:
        emit('response_status', {'status': 'error', 'message': 'Session not found'})



# ----------------------------------------------------
# Story HTTP APIs (CRUD)
# ----------------------------------------------------

@app.route('/api/stories', methods=['GET'])
def get_stories():
    """List all stories in STORIES_DIR."""
    meta_files = list(config.STORIES_DIR.glob("*_meta.json"))
    stories_list = []
    for f in meta_files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            stories_list.append(data)
        except Exception as e:
            print(f"Error reading {f.name}: {e}")
    return jsonify(stories_list)

@app.route('/api/stories/<story_uuid>', methods=['GET'])
def get_story(story_uuid):
    """Get metadata for a specific story."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story not found'}), 404
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Failed to read story: {str(e)}'}), 500

@app.route('/api/stories', methods=['POST'])
def create_story():
    """Create a new story and initialize its ledger."""
    data = request.json
    if not data or not data.get('name') or not data.get('context') or not data.get('style'):
        return jsonify({'error': 'Missing required fields (name, context, style)'}), 400

    story_uuid = str(uuid.uuid4())
    
    # Structure characters list
    characters = []
    for c in data.get('characters', []):
        characters.append(models.CharacterInfo(
            name=c.get('name'),
            role=c.get('role'),
            description=c.get('description'),
            first_chapter=c.get('first_chapter'),
            appearance_context=c.get('appearance_context'),
            current_cultivation=c.get('current_cultivation'),
            active_weapon=c.get('active_weapon'),
            weapons_owned=[w.strip() for w in c.get('weapons_owned', []) if w.strip()] if isinstance(c.get('weapons_owned'), list) else ([w.strip() for w in c.get('weapons_owned', '').split(',') if w.strip()] if isinstance(c.get('weapons_owned'), str) else []),
            active_technique=c.get('active_technique'),
            techniques_owned=[t.strip() for t in c.get('techniques_owned', []) if t.strip()] if isinstance(c.get('techniques_owned'), list) else ([t.strip() for t in c.get('techniques_owned', '').split(',') if t.strip()] if isinstance(c.get('techniques_owned'), str) else []),
            visited_locations=[l.strip() for l in c.get('visited_locations', []) if l.strip()] if isinstance(c.get('visited_locations'), list) else ([l.strip() for l in c.get('visited_locations', '').split(',') if l.strip()] if isinstance(c.get('visited_locations'), str) else []),
            current_location=c.get('current_location'),
            status=c.get('status', 'Mới xuất hiện')
        ))

    meta = models.StoryMeta(
        uuid=story_uuid,
        name=data.get('name'),
        characters=characters,
        context=data.get('context'),
        style=data.get('style'),
        tags=[t.strip() for t in data.get('tags', []) if t.strip()],
        max_chapters=data.get('max_chapters', 10),
        max_words_per_chapter=data.get('max_words_per_chapter', 2000),
        model=data.get('model', 'gemini-2.5-flash'),
        cultivation_stages=parse_request_cultivation_stages(data.get('cultivation_stages', []))
    )

    ledger = models.GlobalLedger(
        timeline=[],
        unresolved_threads=data.get('unresolved_threads') or ["Bắt đầu cuộc phiêu lưu của nhân vật."],
        resolved_threads=[],
        locations=[],
        weapons=[],
        techniques=[]
    )

    # Save to files
    meta_path = config.get_meta_path(story_uuid)
    ledger_path = config.get_ledger_path(story_uuid)
    
    try:
        config.get_chapters_dir(story_uuid)
        config.get_states_dir(story_uuid)
        
        meta_path.write_text(meta.model_dump_json(indent=2), encoding="utf-8")
        ledger_path.write_text(ledger.model_dump_json(indent=2), encoding="utf-8")
        
        return jsonify({
            'message': 'Story created successfully',
            'uuid': story_uuid,
            'meta': meta.model_dump()
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to write story data: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>', methods=['PUT'])
def update_story(story_uuid):
    """Update story metadata."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story not found'}), 404

    data = request.json
    try:
        existing_meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        return jsonify({'error': f'Failed to read existing metadata: {str(e)}'}), 500

    # Update fields from request
    existing_meta['name'] = data.get('name', existing_meta.get('name'))
    existing_meta['context'] = data.get('context', existing_meta.get('context'))
    existing_meta['style'] = data.get('style', existing_meta.get('style'))
    existing_meta['tags'] = data.get('tags', existing_meta.get('tags', []))
    existing_meta['max_chapters'] = data.get('max_chapters', existing_meta.get('max_chapters', 10))
    existing_meta['max_words_per_chapter'] = data.get('max_words_per_chapter', existing_meta.get('max_words_per_chapter', 2000))
    existing_meta['model'] = data.get('model', existing_meta.get('model', 'gemini-2.5-flash'))
    
    if 'cultivation_stages' in data:
        existing_meta['cultivation_stages'] = parse_request_cultivation_stages(data.get('cultivation_stages', []))
    
    # Handle characters update
    if 'characters' in data:
        existing_meta['characters'] = data['characters']

    try:
        # Validate metadata model
        validated_meta = models.StoryMeta(**existing_meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({'message': 'Story updated successfully', 'meta': validated_meta.model_dump()})
    except Exception as e:
        return jsonify({'error': f'Validation or saving failed: {str(e)}'}), 400

@app.route('/api/stories/<story_uuid>/ledger', methods=['GET'])
def get_story_ledger(story_uuid):
    """Get global ledger timeline & unresolved threads."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    try:
        data = json.loads(ledger_path.read_text(encoding="utf-8"))
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Failed to read ledger: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger', methods=['PUT'])
def update_story_ledger(story_uuid):
    """Update global ledger."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json
    try:
        validated_ledger = models.GlobalLedger(**data)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({'message': 'Ledger updated successfully', 'ledger': validated_ledger.model_dump()})
    except Exception as e:
        return jsonify({'error': f'Validation or saving failed: {str(e)}'}), 400


# ----------------------------------------------------
# Global Ledger & Meta Details management APIs
# ----------------------------------------------------

def is_main_character(role: str) -> bool:
    if not role:
        return False
    return role.strip().lower() in ["chính", "nhân vật chính", "main", "protagonist"]

@app.route('/api/stories/<story_uuid>/model', methods=['PUT'])
def update_story_model(story_uuid):
    """Update only the default AI model for a story."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story not found'}), 404

    data = request.json
    if not data or 'model' not in data:
        return jsonify({'error': 'Missing model field in request body'}), 400

    new_model = data['model'].strip()
    if not new_model:
        return jsonify({'error': 'Model name cannot be empty'}), 400

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta['model'] = new_model
        # Validate and save
        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({'message': 'Model updated successfully', 'model': validated_meta.model})
    except Exception as e:
        return jsonify({'error': f'Failed to update model: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads', methods=['POST'])
def add_ledger_thread(story_uuid):
    """Add a new unresolved thread to the ledger."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json
    if not data or 'thread' not in data:
        return jsonify({'error': 'Missing thread field in request body'}), 400

    new_thread = data['thread'].strip()
    if not new_thread:
        return jsonify({'error': 'Thread text cannot be empty'}), 400

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        if 'unresolved_threads' not in ledger:
            ledger['unresolved_threads'] = []
            
        new_chapter = data.get('chapter')
        thread_item = {
            'thread': new_thread,
            'chapter': int(new_chapter) if new_chapter is not None and str(new_chapter).strip() != "" else None
        }
        ledger['unresolved_threads'].append(thread_item)

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread added successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to add thread: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads/<int:index>', methods=['PUT'])
def edit_ledger_thread(story_uuid, index):
    """Edit an unresolved thread in the ledger by index."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json
    if not data or 'thread' not in data:
        return jsonify({'error': 'Missing thread field in request body'}), 400

    updated_thread = data['thread'].strip()
    if not updated_thread:
        return jsonify({'error': 'Thread text cannot be empty'}), 400

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        threads = ledger.get('unresolved_threads', [])
        if index < 0 or index >= len(threads):
            return jsonify({'error': f'Invalid thread index {index}'}), 400

        updated_chapter = data.get('chapter')
        threads[index] = {
            'thread': updated_thread,
            'chapter': int(updated_chapter) if updated_chapter is not None and str(updated_chapter).strip() != "" else None
        }
        ledger['unresolved_threads'] = threads

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread updated successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to update thread: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads/<int:index>', methods=['DELETE'])
def delete_ledger_thread(story_uuid, index):
    """Delete an unresolved thread from the ledger by index."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        threads = ledger.get('unresolved_threads', [])
        if index < 0 or index >= len(threads):
            return jsonify({'error': f'Invalid thread index {index}'}), 400

        threads.pop(index)
        ledger['unresolved_threads'] = threads

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread deleted successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete thread: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/resolved-threads', methods=['GET'])
def get_ledger_resolved_threads(story_uuid):
    """Get the list of resolved threads."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify([])
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        return jsonify(ledger.get('resolved_threads', []))
    except Exception as e:
        return jsonify({'error': f'Failed to read resolved threads: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/threads/<int:index>/resolve', methods=['POST'])
def resolve_ledger_thread(story_uuid, index):
    """Manually move an unresolved thread to resolved threads list by index."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404

    data = request.json or {}
    chap_resolved = data.get('chapter_resolved')
    res_note = data.get('resolution_note', '').strip()

    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        unresolved = ledger.get('unresolved_threads', [])
        if index < 0 or index >= len(unresolved):
            return jsonify({'error': f'Invalid thread index {index}'}), 400

        # Extract the unresolved thread
        thread_to_resolve = unresolved.pop(index)
        
        # Get thread contents (could be dict or string)
        thread_text = ""
        thread_chap_intro = None
        if isinstance(thread_to_resolve, dict):
            thread_text = thread_to_resolve.get('thread', '')
            thread_chap_intro = thread_to_resolve.get('chapter')
        else:
            thread_text = str(thread_to_resolve)

        if 'resolved_threads' not in ledger:
            ledger['resolved_threads'] = []

        # Add to resolved threads
        ledger['resolved_threads'].append({
            'thread': thread_text,
            'chapter_introduced': thread_chap_intro,
            'chapter_resolved': int(chap_resolved) if chap_resolved is not None and str(chap_resolved).strip() != "" else None,
            'resolution_note': res_note if res_note else "Giải quyết thủ công."
        })

        ledger['unresolved_threads'] = unresolved

        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Thread resolved successfully',
            'unresolved_threads': [t.model_dump() for t in validated_ledger.unresolved_threads],
            'resolved_threads': [t.model_dump() for t in validated_ledger.resolved_threads]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to resolve thread: {str(e)}'}), 500

# World Ledger Entity CRUD endpoints
# ----------------------------------------------------

@app.route('/api/stories/<story_uuid>/ledger/locations', methods=['POST'])
def add_ledger_location(story_uuid):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    data = request.json or {}
    name = data.get('name', '').strip()
    chapter = data.get('chapter')
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Tên địa điểm là bắt buộc'}), 400
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        locations = ledger.get('locations', [])
        if any(l.get('name', '').strip().lower() == name.lower() for l in locations):
            return jsonify({'error': f'Địa điểm {name} đã tồn tại'}), 400
        locations.append({
            'name': name,
            'chapter': int(chapter) if chapter is not None and str(chapter).strip() != "" else None,
            'description': description
        })
        ledger['locations'] = locations
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Location added successfully',
            'locations': [l.model_dump() for l in validated_ledger.locations]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to add location: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/locations/<int:index>', methods=['PUT'])
def edit_ledger_location(story_uuid, index):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    data = request.json or {}
    name = data.get('name', '').strip()
    chapter = data.get('chapter')
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Tên địa điểm là bắt buộc'}), 400
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        locations = ledger.get('locations', [])
        if index < 0 or index >= len(locations):
            return jsonify({'error': 'Index không hợp lệ'}), 400
        if any(i != index and l.get('name', '').strip().lower() == name.lower() for i, l in enumerate(locations)):
            return jsonify({'error': f'Địa điểm {name} đã tồn tại ở vị trí khác'}), 400
        locations[index] = {
            'name': name,
            'chapter': int(chapter) if chapter is not None and str(chapter).strip() != "" else None,
            'description': description
        }
        ledger['locations'] = locations
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Location updated successfully',
            'locations': [l.model_dump() for l in validated_ledger.locations]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to update location: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/locations/<int:index>', methods=['DELETE'])
def delete_ledger_location(story_uuid, index):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        locations = ledger.get('locations', [])
        if index < 0 or index >= len(locations):
            return jsonify({'error': 'Index không hợp lệ'}), 400
        locations.pop(index)
        ledger['locations'] = locations
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Location deleted successfully',
            'locations': [l.model_dump() for l in validated_ledger.locations]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete location: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/weapons', methods=['POST'])
def add_ledger_weapon(story_uuid):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    data = request.json or {}
    name = data.get('name', '').strip()
    chapter = data.get('chapter')
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Tên binh khí là bắt buộc'}), 400
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        weapons = ledger.get('weapons', [])
        if any(w.get('name', '').strip().lower() == name.lower() for w in weapons):
            return jsonify({'error': f'Binh khí {name} đã tồn tại'}), 400
        weapons.append({
            'name': name,
            'chapter': int(chapter) if chapter is not None and str(chapter).strip() != "" else None,
            'description': description
        })
        ledger['weapons'] = weapons
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Weapon added successfully',
            'weapons': [w.model_dump() for w in validated_ledger.weapons]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to add weapon: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/weapons/<int:index>', methods=['PUT'])
def edit_ledger_weapon(story_uuid, index):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    data = request.json or {}
    name = data.get('name', '').strip()
    chapter = data.get('chapter')
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Tên binh khí là bắt buộc'}), 400
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        weapons = ledger.get('weapons', [])
        if index < 0 or index >= len(weapons):
            return jsonify({'error': 'Index không hợp lệ'}), 400
        if any(i != index and w.get('name', '').strip().lower() == name.lower() for i, w in enumerate(weapons)):
            return jsonify({'error': f'Binh khí {name} đã tồn tại ở vị trí khác'}), 400
        weapons[index] = {
            'name': name,
            'chapter': int(chapter) if chapter is not None and str(chapter).strip() != "" else None,
            'description': description
        }
        ledger['weapons'] = weapons
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Weapon updated successfully',
            'weapons': [w.model_dump() for w in validated_ledger.weapons]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to update weapon: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/weapons/<int:index>', methods=['DELETE'])
def delete_ledger_weapon(story_uuid, index):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        weapons = ledger.get('weapons', [])
        if index < 0 or index >= len(weapons):
            return jsonify({'error': 'Index không hợp lệ'}), 400
        weapons.pop(index)
        ledger['weapons'] = weapons
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Weapon deleted successfully',
            'weapons': [w.model_dump() for w in validated_ledger.weapons]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete weapon: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/techniques', methods=['POST'])
def add_ledger_technique(story_uuid):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    data = request.json or {}
    name = data.get('name', '').strip()
    chapter = data.get('chapter')
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Tên công pháp là bắt buộc'}), 400
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        techniques = ledger.get('techniques', [])
        if any(t.get('name', '').strip().lower() == name.lower() for t in techniques):
            return jsonify({'error': f'Công pháp {name} đã tồn tại'}), 400
        techniques.append({
            'name': name,
            'chapter': int(chapter) if chapter is not None and str(chapter).strip() != "" else None,
            'description': description
        })
        ledger['techniques'] = techniques
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Technique added successfully',
            'techniques': [t.model_dump() for t in validated_ledger.techniques]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to add technique: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/techniques/<int:index>', methods=['PUT'])
def edit_ledger_technique(story_uuid, index):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    data = request.json or {}
    name = data.get('name', '').strip()
    chapter = data.get('chapter')
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Tên công pháp là bắt buộc'}), 400
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        techniques = ledger.get('techniques', [])
        if index < 0 or index >= len(techniques):
            return jsonify({'error': 'Index không hợp lệ'}), 400
        if any(i != index and t.get('name', '').strip().lower() == name.lower() for i, t in enumerate(techniques)):
            return jsonify({'error': f'Công pháp {name} đã tồn tại ở vị trí khác'}), 400
        techniques[index] = {
            'name': name,
            'chapter': int(chapter) if chapter is not None and str(chapter).strip() != "" else None,
            'description': description
        }
        ledger['techniques'] = techniques
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Technique updated successfully',
            'techniques': [t.model_dump() for t in validated_ledger.techniques]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to update technique: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/ledger/techniques/<int:index>', methods=['DELETE'])
def delete_ledger_technique(story_uuid, index):
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({'error': 'Ledger not found'}), 404
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        techniques = ledger.get('techniques', [])
        if index < 0 or index >= len(techniques):
            return jsonify({'error': 'Index không hợp lệ'}), 400
        techniques.pop(index)
        ledger['techniques'] = techniques
        validated_ledger = models.GlobalLedger(**ledger)
        ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Technique deleted successfully',
            'techniques': [t.model_dump() for t in validated_ledger.techniques]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete technique: {str(e)}'}), 500


# Character APIs
# ----------------------------------------------------

@app.route('/api/stories/<story_uuid>/characters', methods=['POST'])
def add_story_character(story_uuid):
    """Add a new character to the story (excluding main character roles)."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    data = request.json or {}
    char_name = data.get('name', '').strip()
    char_role = data.get('role', '').strip()
    char_description = data.get('description', '').strip()

    if not char_name:
        return jsonify({'error': 'Character name is required'}), 400
    if not char_role:
        return jsonify({'error': 'Character role is required'}), 400

    if is_main_character(char_role):
        return jsonify({'error': 'Không thể thêm nhân vật chính mới tại đây'}), 400

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        characters = meta.get('characters', [])

        # Check if name duplicate (case-insensitive)
        if any(c.get('name', '').strip().lower() == char_name.lower() for c in characters):
            return jsonify({'error': f'Nhân vật có tên {char_name} đã tồn tại'}), 400

        new_char = {
            'name': char_name,
            'role': char_role,
            'description': char_description,
            'first_chapter': data.get('first_chapter'),
            'appearance_context': data.get('appearance_context', ''),
            'current_cultivation': data.get('current_cultivation', ''),
            'active_weapon': data.get('active_weapon', ''),
            'weapons_owned': [w.strip() for w in data.get('weapons_owned', []) if w.strip()] if isinstance(data.get('weapons_owned'), list) else ([w.strip() for w in data.get('weapons_owned', '').split(',') if w.strip()] if isinstance(data.get('weapons_owned'), str) else []),
            'active_technique': data.get('active_technique', ''),
            'techniques_owned': [t.strip() for t in data.get('techniques_owned', []) if t.strip()] if isinstance(data.get('techniques_owned'), list) else ([t.strip() for t in data.get('techniques_owned', '').split(',') if t.strip()] if isinstance(data.get('techniques_owned'), str) else []),
            'visited_locations': [l.strip() for l in data.get('visited_locations', []) if l.strip()] if isinstance(data.get('visited_locations'), list) else ([l.strip() for l in data.get('visited_locations', '').split(',') if l.strip()] if isinstance(data.get('visited_locations'), str) else []),
            'current_location': data.get('current_location'),
            'status': data.get('status', 'Mới xuất hiện')
        }
        characters.append(new_char)
        meta['characters'] = characters

        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Character added successfully',
            'characters': [c.model_dump() for c in validated_meta.characters]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to add character: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/characters/<name>', methods=['PUT'])
def edit_story_character(story_uuid, name):
    """Edit a character by their name (excluding main character roles)."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    data = request.json or {}
    new_name = data.get('name', '').strip()
    new_role = data.get('role', '').strip()
    new_description = data.get('description', '').strip()

    if not new_name:
        return jsonify({'error': 'Character name is required'}), 400
    if not new_role:
        return jsonify({'error': 'Character role is required'}), 400

    if is_main_character(new_role):
        return jsonify({'error': 'Không thể thay đổi vai trò thành nhân vật chính'}), 400

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        characters = meta.get('characters', [])

        # Find character to update
        char_index = -1
        for i, c in enumerate(characters):
            if c.get('name', '').strip().lower() == name.lower():
                char_index = i
                break

        if char_index == -1:
            return jsonify({'error': f'Không tìm thấy nhân vật {name}'}), 404

        existing_char = characters[char_index]
        if is_main_character(existing_char.get('role', '')):
            return jsonify({'error': 'Không thể chỉnh sửa thông tin của nhân vật chính'}), 400

        # Check name conflict if name changed
        if new_name.lower() != name.lower():
            if any(c.get('name', '').strip().lower() == new_name.lower() for i, c in enumerate(characters) if i != char_index):
                return jsonify({'error': f'Tên nhân vật {new_name} đã bị trùng'}), 400

        existing_char['name'] = new_name
        existing_char['role'] = new_role
        existing_char['description'] = new_description
        if 'first_chapter' in data:
            existing_char['first_chapter'] = data.get('first_chapter')
        if 'appearance_context' in data:
            existing_char['appearance_context'] = data.get('appearance_context')
        if 'current_cultivation' in data:
            existing_char['current_cultivation'] = data.get('current_cultivation')
        if 'active_weapon' in data:
            existing_char['active_weapon'] = data.get('active_weapon')
        if 'weapons_owned' in data:
            existing_char['weapons_owned'] = [w.strip() for w in data.get('weapons_owned', []) if w.strip()] if isinstance(data.get('weapons_owned'), list) else ([w.strip() for w in data.get('weapons_owned', '').split(',') if w.strip()] if isinstance(data.get('weapons_owned'), str) else [])
        if 'active_technique' in data:
            existing_char['active_technique'] = data.get('active_technique')
        if 'techniques_owned' in data:
            existing_char['techniques_owned'] = [t.strip() for t in data.get('techniques_owned', []) if t.strip()] if isinstance(data.get('techniques_owned'), list) else ([t.strip() for t in data.get('techniques_owned', '').split(',') if t.strip()] if isinstance(data.get('techniques_owned'), str) else [])
        if 'visited_locations' in data:
            existing_char['visited_locations'] = [l.strip() for l in data.get('visited_locations', []) if l.strip()] if isinstance(data.get('visited_locations'), list) else ([l.strip() for l in data.get('visited_locations', '').split(',') if l.strip()] if isinstance(data.get('visited_locations'), str) else [])
        if 'current_location' in data:
            existing_char['current_location'] = data.get('current_location')
        if 'status' in data:
            existing_char['status'] = data.get('status')

        characters[char_index] = existing_char
        meta['characters'] = characters

        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Character updated successfully',
            'characters': [c.model_dump() for c in validated_meta.characters]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to update character: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/characters/<name>', methods=['DELETE'])
def delete_story_character(story_uuid, name):
    """Delete a character by name (excluding main character roles)."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        characters = meta.get('characters', [])

        # Find character
        char_index = -1
        for i, c in enumerate(characters):
            if c.get('name', '').strip().lower() == name.lower():
                char_index = i
                break

        if char_index == -1:
            return jsonify({'error': f'Không tìm thấy nhân vật {name}'}), 404

        existing_char = characters[char_index]
        if is_main_character(existing_char.get('role', '')):
            return jsonify({'error': 'Không thể xóa nhân vật chính'}), 400

        characters.pop(char_index)
        meta['characters'] = characters

        validated_meta = models.StoryMeta(**meta)
        meta_path.write_text(validated_meta.model_dump_json(indent=2), encoding="utf-8")
        return jsonify({
            'message': 'Character deleted successfully',
            'characters': [c.model_dump() for c in validated_meta.characters]
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete character: {str(e)}'}), 500


# ----------------------------------------------------
# Chapter HTTP APIs (CRUD)
# ----------------------------------------------------

@app.route('/api/stories/<story_uuid>/chapters', methods=['GET'])
def get_story_chapters(story_uuid):
    """List all created chapters from ledger and verify file existence."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify([])
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        timeline = ledger.get('timeline', [])
        
        # Verify if content file exists, attach flags
        for chap in timeline:
            chap_num = chap.get('chapter')
            content_path = config.get_chapter_content_path(story_uuid, chap_num)
            state_path = config.get_chapter_state_path(story_uuid, chap_num)
            chap['has_content'] = content_path.exists()
            chap['has_state'] = state_path.exists()
            
        return jsonify(timeline)
    except Exception as e:
        return jsonify({'error': f'Failed to read chapters: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>', methods=['GET'])
def get_chapter(story_uuid, chapter_num):
    """Get the written content and state logic of a specific chapter."""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    state_path = config.get_chapter_state_path(story_uuid, chapter_num)

    if not content_path.exists():
        return jsonify({'error': f'Chapter {chapter_num} content not found'}), 404

    content = ""
    state_desc = ""
    try:
        content = content_path.read_text(encoding="utf-8")
        if state_path.exists():
            state_desc = state_path.read_text(encoding="utf-8")
    except Exception as e:
        return jsonify({'error': f'Failed to read chapter files: {str(e)}'}), 500

    return jsonify({
        'story_uuid': story_uuid,
        'chapter': chapter_num,
        'content': content,
        'state': state_desc
    })

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/nodes', methods=['GET'])
def get_chapter_nodes(story_uuid, chapter_num):
    """Get the event nodes & connections for a specific chapter."""
    nodes_path = config.get_chapter_nodes_path(story_uuid, chapter_num)
    if not nodes_path.exists():
        # Try to find it in timeline if not separate file (fallback)
        ledger_path = config.get_ledger_path(story_uuid)
        if ledger_path.exists():
            try:
                ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
                for item in ledger.get("timeline", []):
                    if item.get("chapter") == chapter_num and "nodes" in item:
                        return jsonify({
                            "nodes": item.get("nodes", []),
                            "connections": item.get("connections", [])
                        })
            except Exception:
                pass
        return jsonify({"nodes": [], "connections": []})
    try:
        data = json.loads(nodes_path.read_text(encoding="utf-8"))
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Failed to read nodes: {str(e)}'}), 500


@app.route('/api/stories/<story_uuid>/all-nodes', methods=['GET'])
def get_all_story_nodes(story_uuid):
    """Get all event nodes & connections for all chapters in a story."""
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        return jsonify({})
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        timeline = ledger.get('timeline', [])
        
        all_nodes_data = {}
        for chap in timeline:
            chap_num = chap.get('chapter')
            nodes_path = config.get_chapter_nodes_path(story_uuid, chap_num)
            if nodes_path.exists():
                try:
                    data = json.loads(nodes_path.read_text(encoding="utf-8"))
                    if data.get("nodes"):
                        all_nodes_data[str(chap_num)] = {
                            "nodes": data.get("nodes", []),
                            "connections": data.get("connections", []),
                            "chapter_title": chap.get("title", ""),
                            "chapter_summary": chap.get("summary", "")
                        }
                except Exception:
                    pass
        return jsonify(all_nodes_data)
    except Exception as e:
        return jsonify({'error': f'Failed to read all nodes: {str(e)}'}), 500


@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/suggest-nodes', methods=['POST'])
def suggest_chapter_nodes(story_uuid, chapter_num):
    """Call Gemini to get suggestions for the next chapter's event nodes."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8") if meta_path.exists() else '{}')
        model_name = meta_data.get('model', 'gemini-2.5-flash')
    except Exception as e:
        return jsonify({'error': f'Failed to read metadata: {str(e)}'}), 500

    ledger_path = config.get_ledger_path(story_uuid)
    ledger_data = {}
    if ledger_path.exists():
        try:
            ledger_data = json.loads(ledger_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    req_data = request.json or {}
    num_nodes = int(req_data.get('num_nodes', 3))
    linked_chapters = req_data.get('linked_chapters', [])
    characters = req_data.get('characters', [])
    resolved_threads = req_data.get('resolved_threads', [])
    techniques = req_data.get('techniques', [])
    locations = req_data.get('locations', [])
    weapons = req_data.get('weapons', [])
    notes = req_data.get('notes', '').strip()

    # Build context of previous nodes
    prev_nodes_ctx = ""
    # 1. Load immediate previous chapter N-1
    if chapter_num > 1:
        prev_nodes_path = config.get_chapter_nodes_path(story_uuid, chapter_num - 1)
        if prev_nodes_path.exists():
            try:
                prev_nodes_data = json.loads(prev_nodes_path.read_text(encoding="utf-8"))
                prev_nodes_ctx += f"\nSơ đồ sự kiện chương trước (Chương {chapter_num - 1}):\n"
                for node in prev_nodes_data.get("nodes", []):
                    node_text = node.get("content") or node.get("description") or ""
                    prev_nodes_ctx += f"- Node ID: `{node['id']}` | Tiêu đề: \"{node['title']}\" | Nội dung/Mô tả: {node_text}\n"
            except Exception:
                pass

    # 2. Load other linked chapters
    for chap in linked_chapters:
        try:
            chap_num = int(chap)
            if chap_num != chapter_num - 1:
                nodes_path = config.get_chapter_nodes_path(story_uuid, chap_num)
                if nodes_path.exists():
                    nodes_data = json.loads(nodes_path.read_text(encoding="utf-8"))
                    prev_nodes_ctx += f"\nSơ đồ sự kiện Chương {chap_num} (Chương liên kết):\n"
                    for node in nodes_data.get("nodes", []):
                        node_text = node.get("content") or node.get("description") or ""
                        prev_nodes_ctx += f"- Node ID: `{node['id']}` | Tiêu đề: \"{node['title']}\" | Nội dung/Mô tả: {node_text}\n"
        except Exception:
            pass

    # Build system prompt and user query
    prompt = f"""
Bạn là một chuyên gia xây dựng kịch bản và sơ đồ sự kiện cho tiểu thuyết dài kỳ. Nhiệm vụ của bạn là thiết lập danh sách {num_nodes} node sự kiện tuần tự nối tiếp nhau cho Chương {chapter_num} của câu chuyện dưới đây.

THÔNG TIN TÁC PHẨM:
- Tên truyện: {meta_data.get('name')}
- Bối cảnh chính: {meta_data.get('context')}
- Phong cách hành văn: {meta_data.get('style')}

SỔ CÁI TOÀN CỤC (GLOBAL LEDGER):
- Lịch sử cốt truyện: {json.dumps(ledger_data.get('timeline', []), ensure_ascii=False)}
- Các nút thắt chưa giải quyết: {json.dumps(ledger_data.get('unresolved_threads', []), ensure_ascii=False)}

BỐI CẢNH SỰ KIỆN CHƯƠNG TRƯỚC / CHƯƠNG LIÊN KẾT ĐỂ TẠO SỰ LIỀN MẠCH:
{prev_nodes_ctx or "Chưa có chương cũ hoặc chưa viết sơ đồ sự kiện cho chương cũ."}

YÊU CẦU CHO CHƯƠNG {chapter_num}:
- Tạo chính xác {num_nodes} node sự kiện được nối kết tuần tự.
- Các nhân vật sẽ xuất hiện trong chương này: {', '.join(characters) if characters else 'Không chỉ định'}
- Các địa điểm nhân vật sẽ tới hoặc ở: {', '.join(locations) if locations else 'Không chỉ định'}
- Các công pháp sẽ sử dụng: {', '.join(techniques) if techniques else 'Không chỉ định'}
- Binh khí/Pháp khí sử dụng: {', '.join(weapons) if weapons else 'Không chỉ định'}
- Nút thắt sẽ giải quyết (nếu có, hãy tự nghĩ phương án giải quyết và điền vào resolution_note): {', '.join(resolved_threads) if resolved_threads else 'Không chỉ định'}
- Lưu ý/chú thích của tác giả: "{notes}"

HƯỚNG DẪN TẠO SƠ ĐỒ NODE:
1. Đảm bảo luồng kể truyện mạch lạc. Node đầu tiên của Chương {chapter_num} nên liên kết logic (qua trường `links`) với node cuối cùng của Chương {chapter_num-1} (nếu có ở danh sách bối cảnh phía trên).
2. Hãy phân bổ đều các nhân vật, địa điểm, công pháp, binh khí vào các node sao cho tự nhiên nhất.
3. Nếu có giải quyết nút thắt, hãy chọn đúng nút thắt đó và mô tả cách giải quyết chi tiết trong trường `resolved_thread.resolution_note`.
4. Mỗi node bắt buộc phải có Tiêu đề / Tiến trình (title) ngắn gọn, súc tích và Mô tả kịch bản (description) chi tiết diễn biến.
"""

    try:
        from src.utils.llm import invoke_with_retry
        state = {
            "story_uuid": story_uuid,
            "model": model_name
        }
        
        # Invoke LLM with structured output schema
        suggested_data = invoke_with_retry(
            state, 
            prompt, 
            temperature=0.7, 
            output_schema=models.SuggestedChapterNodes
        )
        
        # Transform temp IDs to unique IDs and add coordinate layouts
        import time
        timestamp = int(time.time() * 1000)
        
        node_id_map = {}
        transformed_nodes = []
        
        for idx, node in enumerate(suggested_data.nodes):
            new_id = f"node-{timestamp + idx}"
            node_id_map[node.id] = new_id
            
            # Map resolved thread
            res_thread = {
                "thread": "",
                "resolution_note": ""
            }
            if node.resolved_thread and node.resolved_thread.thread.strip():
                res_thread = {
                    "thread": node.resolved_thread.thread.strip(),
                    "resolution_note": node.resolved_thread.resolution_note.strip()
                }
                
            # Map old chapter links
            links = []
            if node.links:
                for l in node.links:
                    links.append({
                        "chapter": l.chapter,
                        "nodes": l.nodes or []
                    })
                    
            transformed_nodes.append({
                "id": new_id,
                "title": node.title.strip(),
                "description": node.description.strip(),
                "characters": node.characters or [],
                "locations": node.locations or [],
                "weapons": node.weapons or [],
                "techniques": node.techniques or [],
                "resolved_thread": res_thread,
                "links": links,
                "x": 150 + idx * 300,
                "y": 200 + (idx % 2) * 60
            })
            
        transformed_connections = []
        for conn in suggested_data.connections:
            from_new = node_id_map.get(conn.from_node)
            to_new = node_id_map.get(conn.to_node)
            if from_new and to_new:
                transformed_connections.append({
                    "from": from_new,
                    "to": to_new
                })
        # If there are no connections generated but multiple nodes, construct sequential ones
        if not transformed_connections and len(transformed_nodes) > 1:
            for idx in range(len(transformed_nodes) - 1):
                transformed_connections.append({
                    "from": transformed_nodes[idx]["id"],
                    "to": transformed_nodes[idx + 1]["id"]
                })
                
        return jsonify({
            "nodes": transformed_nodes,
            "connections": transformed_connections
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to generate suggested nodes: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/suggest-node-details', methods=['POST'])
def suggest_node_details(story_uuid, chapter_num):
    """Call Gemini to get suggestions (title & description) for a single event node."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8") if meta_path.exists() else '{}')
        model_name = meta_data.get('model', 'gemini-2.5-flash')
    except Exception as e:
        return jsonify({'error': f'Failed to read metadata: {str(e)}'}), 500

    ledger_path = config.get_ledger_path(story_uuid)
    ledger_data = {}
    if ledger_path.exists():
        try:
            ledger_data = json.loads(ledger_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    req_data = request.json or {}
    characters = req_data.get('characters', [])
    locations = req_data.get('locations', [])
    weapons = req_data.get('weapons', [])
    techniques = req_data.get('techniques', [])
    resolved_thread = req_data.get('resolved_thread', {})
    notes = req_data.get('notes', '').strip()
    linked_nodes = req_data.get('linked_nodes', [])

    # Build context of linked nodes in this chapter
    linked_nodes_ctx = ""
    if linked_nodes:
        linked_nodes_ctx += "\nCác sự kiện liên kết trực tiếp trong chương này:\n"
        for idx, ln in enumerate(linked_nodes):
            rel = ln.get('relationship', 'liên kết')
            rel_str = "Sự kiện diễn ra trước" if rel == 'before' else ("Sự kiện diễn ra sau" if rel == 'after' else "Sự kiện liên quan")
            linked_nodes_ctx += f"- [{rel_str}] Tiêu đề: \"{ln.get('title')}\" | Mô tả kịch bản: {ln.get('description', '')}\n"

    resolved_thread_str = ""
    if resolved_thread and resolved_thread.get('thread'):
        resolved_thread_str = f"- Nút thắt sẽ giải quyết: {resolved_thread.get('thread')}"
        if resolved_thread.get('resolution_note'):
            resolved_thread_str += f" (Gợi ý cách giải quyết: {resolved_thread.get('resolution_note')})"

    # Build system prompt and user query
    prompt = f"""
Bạn là một chuyên gia xây dựng kịch bản tiểu thuyết dài kỳ. Hãy gợi ý Tiêu đề (title) ngắn gọn và Mô tả kịch bản (description) chi tiết diễn biến cho một sự kiện (node) cụ thể trong Chương {chapter_num} của câu chuyện dưới đây.

THÔNG TIN TÁC PHẨM:
- Tên truyện: {meta_data.get('name')}
- Bối cảnh chính: {meta_data.get('context')}
- Phong cách hành văn: {meta_data.get('style')}

SỔ CÁI TOÀN CỤC (GLOBAL LEDGER) THAM KHẢO:
- Các nút thắt chưa giải quyết: {json.dumps(ledger_data.get('unresolved_threads', []), ensure_ascii=False)}

CÁC THÔNG SỐ ĐẦU VÀO CỦA SỰ KIỆN NÀY (BẮT BUỘC PHẢI DỰA VÀO ĐỂ TẠO NỘI DUNG):
- Nhân vật tham gia: {', '.join(characters) if characters else 'Không chỉ định'}
- Địa điểm diễn ra: {', '.join(locations) if locations else 'Không chỉ định'}
- Công pháp thi triển: {', '.join(techniques) if techniques else 'Không chỉ định'}
- Binh khí sử dụng: {', '.join(weapons) if weapons else 'Không chỉ định'}
{resolved_thread_str}
- Ghi chú thêm từ tác giả: "{notes if notes else 'Không có'}"

BỐI CẢNH CỦA CÁC SỰ KIỆN LIÊN KẾT TRONG CÙNG CHƯƠNG (BẮT BUỘC PHẢI ĐẢM BẢO TÍNH LIỀN MẠCH):
{linked_nodes_ctx or "Không có sự kiện liên kết trực tiếp trong chương."}

YÊU CẦU:
1. Tạo tiêu đề (title) ngắn gọn, súc tích (dưới 10 từ).
2. Tạo mô tả kịch bản (description) chi tiết diễn biến (khoảng 50-150 từ), viết mạch lạc và hấp dẫn, kết nối hợp lý với bối cảnh sự kiện trước/sau (nếu có).
3. Sử dụng đúng các nhân vật, địa điểm, công pháp, binh khí đầu vào đã được chỉ định.
4. Trả về đúng định dạng có cấu trúc chứa title và description.
"""

    try:
        from src.utils.llm import invoke_with_retry
        state = {
            "story_uuid": story_uuid,
            "model": model_name
        }
        
        # Invoke LLM with structured output schema
        suggested_data = invoke_with_retry(
            state, 
            prompt, 
            temperature=0.7, 
            output_schema=models.SuggestedSingleNodeDetails
        )
        
        return jsonify({
            "title": suggested_data.title.strip(),
            "description": suggested_data.description.strip()
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to generate suggested node details: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/nodes', methods=['PUT'])
def update_chapter_nodes(story_uuid, chapter_num):
    """Save/update the event nodes and connections for a specific chapter."""
    nodes_path = config.get_chapter_nodes_path(story_uuid, chapter_num)
    data = request.json or {}
    
    # Save the updated nodes and connections to chap_X_nodes.json
    try:
        nodes_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        return jsonify({'error': f'Failed to write nodes file: {str(e)}'}), 500

    # Parse newly resolved threads from the updated nodes
    new_resolved = []
    for n in data.get('nodes', []):
        res_thread = n.get('resolved_thread', {})
        if isinstance(res_thread, dict):
            t_text = res_thread.get('thread', '').strip()
            if t_text:
                new_resolved.append(t_text)

    # Sync and update states/chap_X_state.md (Nút thắt đã giải quyết)
    state_path = config.get_chapter_state_path(story_uuid, chapter_num)
    if state_path.exists():
        try:
            state_content = state_path.read_text(encoding="utf-8")
            lines = state_content.splitlines()
            new_lines = []
            in_resolved_section = False
            for line in lines:
                if line.strip() == "## Nút thắt đã giải quyết":
                    new_lines.append(line)
                    for tr in new_resolved:
                        new_lines.append(f"- {tr}")
                    in_resolved_section = True
                elif line.strip() == "## Nút thắt mới mở ra" or line.strip().startswith("## "):
                    if in_resolved_section:
                        new_lines.append("")
                        in_resolved_section = False
                    new_lines.append(line)
                else:
                    if not in_resolved_section:
                        new_lines.append(line)
            
            state_path.write_text("\n".join(new_lines), encoding="utf-8")
        except Exception:
            pass

    # Update Ledger
    ledger_path = config.get_ledger_path(story_uuid)
    if ledger_path.exists():
        try:
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            timeline = ledger.get('timeline', [])
            
            # Find the chapter entry in the timeline
            updated = False
            for item in timeline:
                if item.get('chapter') == chapter_num:
                    item['nodes'] = data.get('nodes', [])
                    item['connections'] = data.get('connections', [])
                    updated = True
                    break
            
            if updated:
                ledger['timeline'] = timeline
                
                # Align ledger unresolved vs resolved threads if nodes resolved them
                ledger_model = models.GlobalLedger(**ledger)
                
                # Process explicit user-selected resolutions from the canvas nodes
                for n in data.get("nodes", []):
                    res_thread = n.get("resolved_thread", {})
                    if isinstance(res_thread, dict):
                        res_text = res_thread.get("thread", "").strip()
                        res_note = res_thread.get("resolution_note", "").strip()
                        if res_text:
                            # Look up in unresolved_threads to remove it and put in resolved_threads
                            matched_unresolved = None
                            for ut in ledger_model.unresolved_threads:
                                if ut.thread.strip().lower() == res_text.lower():
                                    matched_unresolved = ut
                                    break
                            
                            if matched_unresolved:
                                ledger_model.unresolved_threads.remove(matched_unresolved)
                                if not any(rt.thread.strip().lower() == res_text.lower() for rt in ledger_model.resolved_threads):
                                    ledger_model.resolved_threads.append(models.ResolvedThread(
                                        thread=matched_unresolved.thread,
                                        chapter_introduced=matched_unresolved.chapter,
                                        chapter_resolved=chapter_num,
                                        resolution_note=res_note if res_note else "Giải quyết qua sơ đồ sự kiện (sửa đổi)."
                                    ))
                            else:
                                if not any(rt.thread.strip().lower() == res_text.lower() for rt in ledger_model.resolved_threads):
                                    ledger_model.resolved_threads.append(models.ResolvedThread(
                                        thread=res_text,
                                        chapter_introduced=None,
                                        chapter_resolved=chapter_num,
                                        resolution_note=res_note if res_note else "Giải quyết qua sơ đồ sự kiện (sửa đổi)."
                                    ))
                                    
                # Write updated ledger back
                ledger_path.write_text(ledger_model.model_dump_json(indent=2), encoding="utf-8")
        except Exception as e:
            return jsonify({
                'warning': f'Nodes file updated, but ledger sync failed: {str(e)}',
                'message': 'Nodes updated partially'
            }), 200

    return jsonify({'message': f'Chapter {chapter_num} nodes updated successfully'})


@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/align-nodes', methods=['POST'])
def align_chapter_nodes(story_uuid, chapter_num):
    """Align/partition the finalized chapter markdown content into its event nodes using AI."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8") if meta_path.exists() else '{}')
        model_name = meta_data.get('model', 'gemini-2.5-flash')
    except Exception as e:
        return jsonify({'error': f'Failed to read metadata: {str(e)}'}), 500

    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    if not content_path.exists():
        return jsonify({'error': f'Không tìm thấy nội dung chương {chapter_num}. Vui lòng viết truyện trước khi thực hiện cập nhật nội dung vào node.'}), 404

    nodes_path = config.get_chapter_nodes_path(story_uuid, chapter_num)
    if not nodes_path.exists():
        return jsonify({'error': f'Chương {chapter_num} chưa có sơ đồ sự kiện (nodes). Vui lòng tạo sơ đồ sự kiện trước.'}), 400

    try:
        nodes_data = json.loads(nodes_path.read_text(encoding="utf-8"))
    except Exception as e:
        return jsonify({'error': f'Failed to read chapter nodes: {str(e)}'}), 500

    nodes_list = nodes_data.get('nodes', [])
    if not nodes_list:
        return jsonify({'error': f'Sơ đồ sự kiện của Chương {chapter_num} đang trống. Vui lòng thêm các node sự kiện trước.'}), 400

    # Build nodes list context for LLM
    nodes_info = []
    for n in nodes_list:
        nodes_info.append({
            "id": n.get("id"),
            "title": n.get("title"),
            "description": n.get("description")
        })

    try:
        chapter_content = content_path.read_text(encoding="utf-8")
    except Exception as e:
        return jsonify({'error': f'Failed to read chapter content: {str(e)}'}), 500

    prompt = f"""
Hãy đọc nội dung Chương {chapter_num} dưới đây và phân tách/ánh xạ các đoạn văn (hoặc nội dung câu chữ thực tế) tương ứng với từng sự kiện (node) đã được lên kịch bản.

DANH SÁCH CÁC SỰ KIỆN (NODES) KỊCH BẢN:
{json.dumps(nodes_info, ensure_ascii=False, indent=2)}

NỘI DUNG CHƯƠNG {chapter_num}:
---
{chapter_content}
---

YÊU CẦU:
1. Phân tách chính xác nội dung chương truyện đã hoàn thiện ở trên thành các phần tương ứng với danh sách sự kiện (nodes) kịch bản.
2. Với mỗi sự kiện, trích xuất nguyên văn hoặc đầy đủ đoạn câu chữ trong truyện mô tả sự kiện đó. Nội dung phải là văn bản truyện thực tế (câu kể, thoại, miêu tả cảnh vật/nội tâm...), không phải là mô tả kịch bản tóm tắt.
3. Nếu một sự kiện không có nội dung trực tiếp tương ứng (hoặc bị gộp), hãy gán nội dung phù hợp nhất hoặc để trống.
4. Trả về dưới cấu trúc dữ liệu JSON chứa mảng các đối tượng có trường "node_id" và "content" (nội dung câu chữ thực tế).
"""

    try:
        from src.utils.llm import invoke_with_retry
        state = {
            "story_uuid": story_uuid,
            "model": model_name
        }
        
        # Call LLM with output schema ChapterNodeContentExtraction
        mapping_result = invoke_with_retry(
            state, 
            prompt, 
            temperature=0.2, 
            output_schema=models.ChapterNodeContentExtraction
        )
        
        # Map back to nodes
        mapping_dict = {m.node_id: m.content for m in mapping_result.mappings}
        for n in nodes_list:
            node_id = n.get("id")
            if node_id in mapping_dict:
                n["content"] = mapping_dict[node_id]
            else:
                n["content"] = None

        # Write updated nodes back to disk
        nodes_path.write_text(json.dumps(nodes_data, ensure_ascii=False, indent=2), encoding="utf-8")

        # Sync and update global ledger (timeline nodes MUST NOT have "content")
        ledger_path = config.get_ledger_path(story_uuid)
        if ledger_path.exists():
            try:
                ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
                timeline = ledger.get('timeline', [])
                updated = False
                for item in timeline:
                    if item.get('chapter') == chapter_num:
                        # Clean content attribute from nodes copy
                        timeline_nodes = []
                        for n in nodes_list:
                            n_copy = n.copy()
                            n_copy.pop("content", None)
                            timeline_nodes.append(n_copy)
                        item['nodes'] = timeline_nodes
                        item['connections'] = nodes_data.get('connections', [])
                        updated = True
                        break
                if updated:
                    ledger['timeline'] = timeline
                    validated_ledger = models.GlobalLedger(**ledger)
                    ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
            except Exception as e:
                return jsonify({
                    'warning': f'Đã cập nhật nội dung vào node trên đĩa, nhưng đồng bộ sổ cái thất bại: {str(e)}',
                    'nodes': nodes_list,
                    'connections': nodes_data.get('connections', [])
                }), 200

        return jsonify({
            'message': f'Cập nhật nội dung vào các node của Chương {chapter_num} thành công.',
            'nodes': nodes_list,
            'connections': nodes_data.get('connections', [])
        })

    except Exception as e:
        return jsonify({'error': f'Failed to align nodes with AI: {str(e)}'}), 500


@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>', methods=['PUT'])

def update_chapter(story_uuid, chapter_num):
    """Edit the chapter content manually."""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    if not content_path.exists():
        return jsonify({'error': f'Chapter {chapter_num} content not found'}), 404

    data = request.json
    if not data or 'content' not in data:
        return jsonify({'error': 'Missing content in payload'}), 400

    try:
        content_path.write_text(data['content'], encoding="utf-8")
        return jsonify({'message': f'Chapter {chapter_num} content updated successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to update chapter: {str(e)}'}), 500

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>', methods=['DELETE'])
def delete_chapter(story_uuid, chapter_num):
    """Delete a chapter from disk and remove its record in global ledger timeline."""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    state_path = config.get_chapter_state_path(story_uuid, chapter_num)
    nodes_path = config.get_chapter_nodes_path(story_uuid, chapter_num)
    ledger_path = config.get_ledger_path(story_uuid)

    deleted_files = []
    # Delete files
    try:
        if content_path.exists():
            content_path.unlink()
            deleted_files.append('content')
        if state_path.exists():
            state_path.unlink()
            deleted_files.append('state')
        if nodes_path.exists():
            nodes_path.unlink()
            deleted_files.append('nodes')
    except Exception as e:
        return jsonify({'error': f'Failed to delete chapter files: {str(e)}'}), 500

    # Update Ledger
    if ledger_path.exists():
        try:
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            timeline = ledger.get('timeline', [])
            
            # Filter out deleted chapter
            new_timeline = [item for item in timeline if item.get('chapter') != chapter_num]
            ledger['timeline'] = new_timeline
            
            validated_ledger = models.GlobalLedger(**ledger)
            ledger_path.write_text(validated_ledger.model_dump_json(indent=2), encoding="utf-8")
        except Exception as e:
            return jsonify({
                'warning': f'Chapter files deleted, but ledger update failed: {str(e)}',
                'deleted_files': deleted_files
            }), 200

    return jsonify({
        'message': f'Chapter {chapter_num} deleted successfully',
        'deleted_files': deleted_files
    })

@app.route('/api/stories/<story_uuid>/chapters/<int:chapter_num>/edit-paragraph', methods=['POST'])
def edit_chapter_paragraph(story_uuid, chapter_num):
    """AI-assisted editing of a single paragraph in a chapter."""
    data = request.json or {}
    original_paragraph = data.get('paragraph', '').strip()
    instruction = data.get('instruction', '').strip()
    
    if not original_paragraph:
        return jsonify({'error': 'Original paragraph text is required.'}), 400
    if not instruction:
        return jsonify({'error': 'Instruction description is required.'}), 400

    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found.'}), 404
        
    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
        model_name = meta_data.get('model', 'gemini-2.5-flash')
    except Exception as e:
        return jsonify({'error': f'Failed to read metadata: {str(e)}'}), 500

    # Try to load chapter content for context
    chapter_content = ""
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    if content_path.exists():
        try:
            chapter_content = content_path.read_text(encoding="utf-8")
        except Exception:
            pass

    # Build prompt and call Gemini LLM
    try:
        from src.utils.llm import get_llm
        llm = get_llm(model_name=model_name, temperature=0.7)
        
        # Format characters list
        characters_list = meta_data.get('characters', [])
        characters_str = ", ".join([f"{c.get('name')} ({c.get('role')}): {c.get('description')}" for c in characters_list])
        
        # Extract context
        context_str = "..."
        if chapter_content:
            context_str = chapter_content[:3000] # Limit to 3000 chars

        prompt = f"""
Bạn là một biên tập viên văn học chuyên nghiệp. Hãy hỗ trợ tác giả chỉnh sửa một đoạn văn cụ thể trong chương truyện theo yêu cầu chi tiết của họ, đảm bảo giữ vững văn phong và nhất quán logic của toàn bộ tác phẩm.

THÔNG TIN TÁC PHẨM:
- Tên truyện: {meta_data.get('name')}
- Phong cách hành văn: {meta_data.get('style')}
- Bối cảnh chung: {meta_data.get('context')}
- Nhân vật đã biết: {characters_str}

NỘI DUNG CHƯƠNG {chapter_num} ĐỂ THAM KHẢO BỐI CẢNH:
---
{context_str}
---

ĐOẠN VĂN GỐC CẦN CHỈNH SỬA:
---
{original_paragraph}
---

YÊU CẦU CHỈNH SỬA CỦA TÁC GIẢ:
"{instruction}"

HƯỚNG DẪN VIẾT:
1. Chỉnh sửa và viết lại đoạn văn gốc sao cho đáp ứng hoàn hảo yêu cầu của tác giả.
2. Giữ nguyên bối cảnh, ngôi kể và các thông tin logic đã có của tác phẩm trừ khi tác giả có yêu cầu thay đổi chúng cụ thể.
3. Chỉ trả về nội dung đoạn văn mới đã được chỉnh sửa. Tuyệt đối không thêm bất kỳ lời bình luận, lời giới thiệu hay định dạng markdown rườm rà nào khác ngoài đoạn văn chính.
"""
        from src.utils.helpers import ensure_string
        response = llm.invoke(prompt)
        revised_paragraph = ensure_string(response.content).strip()
        
        # Clean up any potential markdown wraps if the model returned them
        if revised_paragraph.startswith("```"):
            lines = revised_paragraph.splitlines()
            if len(lines) >= 2:
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                revised_paragraph = "\n".join(lines).strip()

        return jsonify({
            'original_paragraph': original_paragraph,
            'revised_paragraph': revised_paragraph
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to call LLM: {str(e)}'}), 500



# ----------------------------------------------------
# Real-time Chapter Generation API (LangGraph trigger)
# ----------------------------------------------------

@app.route('/api/stories/<story_uuid>/chapters/generate', methods=['POST'])
def generate_chapter(story_uuid):
    """Trigger the LangGraph workflow to write the next chapter in a background thread."""
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        return jsonify({'error': 'Story metadata not found'}), 404

    data = request.json or {}
    user_idea = data.get('user_idea')
    if not user_idea:
        return jsonify({'error': 'Missing user_idea in payload'}), 400
    if isinstance(user_idea, str) and not user_idea.strip():
        return jsonify({'error': 'Missing user_idea in payload'}), 400

    # Resolve story metadata and ledger
    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        return jsonify({'error': f'Failed to read meta: {str(e)}'}), 500

    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        ledger_data = {"timeline": [], "unresolved_threads": ["Khởi đầu cốt truyện"]}
    else:
        try:
            ledger_data = json.loads(ledger_path.read_text(encoding="utf-8"))
        except Exception as e:
            return jsonify({'error': f'Failed to read ledger: {str(e)}'}), 500

    # Determine next chapter number
    chapters_dir = config.get_chapters_dir(story_uuid)
    existing_chapters = list(chapters_dir.glob("chap_*_content.md"))
    chap_nums = []
    for c in existing_chapters:
        try:
            num = int(c.name.split("_")[1])
            chap_nums.append(num)
        except Exception:
            pass
    next_chap_num = max(chap_nums) + 1 if chap_nums else 1

    # Check for active session
    if session_manager.get_session(story_uuid):
        return jsonify({'error': 'Tiến trình sáng tác đang hoạt động cho truyện này.'}), 400

    selected_model = data.get('model') or meta_data.get('model') or 'gemini-2.5-flash'

    # Create background thread to run LangGraph
    def run_graph_flow():
        print(f"Background thread started for story {story_uuid}, Chapter {next_chap_num}")
        # Create API session
        session = session_manager.create_session(story_uuid, next_chap_num)
        
        initial_state: AgentState = {
            "story_uuid": story_uuid,
            "chapter_num": next_chap_num,
            "user_idea": user_idea,
            "original_user_idea": user_idea,
            "model": selected_model,
            "meta": meta_data,
            "ledger": ledger_data,
            "analyzed_requirements": "",
            "draft_content": "",
            "revision_feedback": "",
            "auditor_feedback": "",
            "warnings": [],
            "is_done": False
        }
        
        try:
            # Execute graph app
            graph_app.invoke(initial_state)
            print(f"Background thread finished successfully for story {story_uuid}")
        except SessionCancelledError as e:
            print(f"LangGraph execution cancelled for story {story_uuid}: {e}")
            # Clean up temp_draft.md
            temp_draft_path = config.get_temp_draft_path(story_uuid)
            if temp_draft_path.exists():
                try:
                    temp_draft_path.unlink()
                    print("✓ Dọn dẹp file nháp tạm temp_draft.md sau khi hủy.")
                except Exception as ex:
                    print(f"Warning: Không thể xóa file nháp tạm: {ex}")
            emit_event("agent_status", {
                "story_uuid": story_uuid,
                "chapter_num": next_chap_num,
                "status": "cancelled",
                "message": "Tiến trình sáng tác đã bị hủy bởi tác giả."
            })
            session_manager.remove_session(story_uuid)
        except Exception as e:
            print(f"Error in background LangGraph execution: {e}")
            emit_event("agent_status", {
                "story_uuid": story_uuid,
                "chapter_num": next_chap_num,
                "status": "error",
                "message": f"Gặp lỗi trong quá trình sáng tác: {str(e)}"
            })
            session_manager.remove_session(story_uuid)

    # Launch background task via socketio to ensure compatibility with eventlet/gevent
    socketio.start_background_task(run_graph_flow)

    return jsonify({
        'status': 'started',
        'chapter': next_chap_num,
        'message': f"Đã bắt đầu tiến trình sáng tác Chương {next_chap_num} ngầm."
    })

@app.route('/api/stories/<story_uuid>/chapters/cancel', methods=['POST'])
def cancel_chapter_generation(story_uuid):
    """Cancel the active chapter generation session."""
    session = session_manager.get_session(story_uuid)
    if not session:
        return jsonify({'error': 'Không có tiến trình sáng tác nào đang chạy cho truyện này.'}), 404
        
    session.cancel()
    return jsonify({
        'status': 'cancelled',
        'message': 'Đã gửi yêu cầu hủy tiến trình sáng tác.'
    })

if __name__ == '__main__':
    socketio.run(app, host='127.0.0.1', port=5000, debug=True, allow_unsafe_werkzeug=True)
