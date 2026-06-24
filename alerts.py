import asyncio
from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sse_starlette.sse import EventSourceResponse
from backend.auth import get_current_user

router = APIRouter()

# In‑memory list of subscribers (queues)
_subscribers: list[asyncio.Queue] = []

@router.get("/api/alerts/stream", response_class=EventSourceResponse)
async def alerts_stream(current_user: object = Depends(get_current_user)):
    """Server‑Sent Events endpoint that pushes alert messages to the client.
    Each client gets its own asyncio.Queue; the server puts messages into all queues.
    """
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.append(queue)
    async def event_generator():
        try:
            while True:
                # Wait for a new alert message
                data = await queue.get()
                yield {"event": "message", "data": data}
        finally:
            # Cleanup when client disconnects
            _subscribers.remove(queue)
    return EventSourceResponse(event_generator())

@router.post("/api/alerts/publish", status_code=status.HTTP_202_ACCEPTED)
async def publish_alert(message: str, current_user: object = Depends(get_current_user)):
    """Publish a new alert to all connected SSE clients. Protected endpoint.
    In a real app this would be called by background jobs or threat detection services.
    """
    if not _subscribers:
        raise HTTPException(status_code=404, detail="No subscribers connected")
    for q in list(_subscribers):
        await q.put(message)
    return {"detail": "Alert broadcasted"}
