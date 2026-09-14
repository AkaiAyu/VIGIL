from fastapi import APIRouter, WebSocket, WebSocketDisconnect


router = APIRouter()


class ConnectionManager:

    def __init__(self):
        self.rooms = {}

    async def connect(
        self,
        websocket: WebSocket,
        room_id: str
    ):
        await websocket.accept()

        if room_id not in self.rooms:
            self.rooms[room_id] = []

        existing_connections = self.rooms[room_id].copy()

        self.rooms[room_id].append(websocket)

        return existing_connections

    def disconnect(
        self,
        websocket: WebSocket,
        room_id: str
    ):
        if room_id not in self.rooms:
            return

        if websocket in self.rooms[room_id]:
            self.rooms[room_id].remove(websocket)

        if not self.rooms[room_id]:
            del self.rooms[room_id]

    async def send_to(
        self,
        websocket: WebSocket,
        message: dict
    ):
        await websocket.send_json(message)

    async def broadcast(
        self,
        message: dict,
        room_id: str,
        sender: WebSocket = None
    ):
        if room_id not in self.rooms:
            return

        for connection in self.rooms[room_id]:

            if connection != sender:
                await connection.send_json(message)


manager = ConnectionManager()


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str
):

    existing_connections = await manager.connect(
        websocket,
        room_id
    )

    print(
        f"WebRTC client joined room: {room_id}"
    )

    print(
        f"Clients currently in room: "
        f"{len(existing_connections) + 1}"
    )

    try:

        # -------------------------------------------------
        # Tell the new client whether another peer exists
        # -------------------------------------------------

        if existing_connections:

            await websocket.send_json({
                "type": "peer-present"
            })

            # Tell the existing peer that someone joined.
            for connection in existing_connections:

                await connection.send_json({
                    "type": "peer-joined"
                })

        else:

            await websocket.send_json({
                "type": "waiting"
            })


        # -------------------------------------------------
        # Handle signaling messages
        # -------------------------------------------------

        while True:

            message = await websocket.receive_json()

            message_type = message.get("type")

            if message_type in [
                "offer",
                "answer",
                "ice-candidate"
            ]:

                await manager.broadcast(
                    message,
                    room_id,
                    websocket
                )


    except WebSocketDisconnect:

        manager.disconnect(
            websocket,
            room_id
        )

        print(
            f"WebRTC client left room: {room_id}"
        )

        # Tell remaining peer that the call ended.
        await manager.broadcast(
            {
                "type": "peer-left"
            },
            room_id
        )