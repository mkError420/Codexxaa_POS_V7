# type: ignore
# pyright: reportMissingImports=false, reportGeneralTypeIssues=false, reportOptionalMemberAccess=false
"""
FastAPI Microservice for POS OCR-to-Cart Vision Pipeline
Exposes REST and WebSocket endpoints so your React POS frontend can stream
frames or send Base64 snapshots to be resolved into cart items.
"""

from typing import Optional, List, Dict, Any
import base64
import json

# Safe imports for Web frameworks with complete fallback stubs
try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException  # type: ignore # pyright: ignore
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore # pyright: ignore
    from pydantic import BaseModel  # type: ignore # pyright: ignore
except ImportError:
    class DummyFastAPI:
        def add_middleware(self, middleware_class: Any, **options: Any) -> None:
            pass

        def post(self, path: str, **kwargs: Any) -> Any:
            def decorator(func: Any) -> Any:
                return func
            return decorator

        def websocket(self, path: str, **kwargs: Any) -> Any:
            def decorator(func: Any) -> Any:
                return func
            return decorator

    class DummyBaseModel:
        def __init__(self, **kwargs: Any) -> None:
            for k, v in kwargs.items():
                setattr(self, k, v)

    class DummyWebSocket:
        async def accept(self) -> None:
            pass

        async def receive_text(self) -> str:
            return ""

        async def send_json(self, data: Any) -> None:
            pass

    class DummyHTTPException(Exception):
        def __init__(self, status_code: int = 500, detail: str = "") -> None:
            self.status_code = status_code
            self.detail = detail
            super().__init__(f"{status_code}: {detail}")

    FastAPI = DummyFastAPI
    BaseModel = DummyBaseModel
    WebSocket = DummyWebSocket
    WebSocketDisconnect = Exception
    HTTPException = DummyHTTPException
    CORSMiddleware = object

try:
    import uvicorn  # type: ignore # pyright: ignore
except ImportError:
    uvicorn = None

try:
    import numpy as np  # type: ignore # pyright: ignore
    import cv2  # type: ignore # pyright: ignore
except ImportError:
    np = None
    cv2 = None

# Pipeline and Catalog imports with single-line resolution
try:
    from ocr_cart_pipeline import OCRToCartPipeline, INVENTORY_CATALOG  # type: ignore # pyright: ignore
except ImportError:
    try:
        from vision_service.ocr_cart_pipeline import OCRToCartPipeline, INVENTORY_CATALOG  # type: ignore # pyright: ignore
    except ImportError:
        class DummyPipeline:
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                self.preprocessor = Any
                self.ocr = Any
                self.matcher = Any
                self.debouncer = Any
                self.emitter = Any
        OCRToCartPipeline = DummyPipeline
        INVENTORY_CATALOG = []

# Initialize application
app = FastAPI(title="POS Vision OCR-to-Cart Engine", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize pipeline (guaranteed non-None)
pipeline = OCRToCartPipeline(
    catalog=INVENTORY_CATALOG,
    ocr_engine="pytesseract",
    min_match_score=85.0,
    consecutive_frames=3,
    cooldown_sec=2.5
)


class ScanFrameRequest(BaseModel):
    image_base64: str = ""
    catalog: Optional[List[Dict[str, Any]]] = None


@app.post("/api/vision/scan-frame")
def scan_frame(req: ScanFrameRequest):
    """
    HTTP endpoint: Process a single frame sent from the POS client.
    """
    if cv2 is None or np is None:
        raise HTTPException(status_code=500, detail="OpenCV or NumPy not installed on server")

    try:
        data = req.image_base64
        if "base64," in data:
            data = data.split("base64,")[1]

        img_bytes = base64.b64decode(data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image payload")

        # 1. Preprocess
        binarized, _ = pipeline.preprocessor.preprocess_image(frame)

        # 2. Extract OCR
        candidates = pipeline.ocr.extract_text_and_lines(binarized)

        # 3. Fuzzy Match
        match = pipeline.matcher.match_product_with_catalog(candidates)

        # 4. Debounce check
        cart_event = pipeline.debouncer.process_match(match)

        return {
            "detected_candidates": candidates,
            "immediate_match": {
                "id": match[0].id,
                "name": match[0].name,
                "price": match[0].price,
                "score": match[1],
                "snippet": match[2]
            } if match else None,
            "add_to_cart": bool(cart_event is not None),
            "cart_payload": json.loads(pipeline.emitter.emit_cart_addition(cart_event)) if cart_event else None,
            "tracking": {
                "consecutive_count": pipeline.debouncer.consecutive_count,
                "required_frames": pipeline.debouncer.required_consecutive_frames
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/vision/stream")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video stream from React webcam canvas.
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if "base64," in data:
                data = data.split("base64,")[1]

            if cv2 is None or np is None:
                continue

            img_bytes = base64.b64decode(data)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is not None:
                binarized, _ = pipeline.preprocessor.preprocess_image(frame)
                candidates = pipeline.ocr.extract_text_and_lines(binarized)
                match = pipeline.matcher.match_product_with_catalog(candidates)
                cart_event = pipeline.debouncer.process_match(match)

                if cart_event:
                    payload = json.loads(pipeline.emitter.emit_cart_addition(cart_event))
                    await websocket.send_json({"event": "ADD_TO_CART", "data": payload})
                elif match:
                    prod, score, _ = match
                    await websocket.send_json({
                        "event": "TRACKING",
                        "product_name": prod.name,
                        "score": score,
                        "count": pipeline.debouncer.consecutive_count
                    })
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    if uvicorn is not None and hasattr(uvicorn, "run"):
        uvicorn.run("api_server:app", host="0.0.0.0", port=8001, reload=True)
    else:
        print("Install uvicorn to run server: pip install uvicorn")
