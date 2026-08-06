export function createControls(canvas, state, getElapsedTime) {
  function onPointerDown(event) {
    state.dragging = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragging) return;

    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.targetRotationY += dx * 0.008;
    state.targetRotationX += dy * 0.006;
    state.targetRotationX = Math.max(-1.2, Math.min(1.2, state.targetRotationX));
    state.lastX = event.clientX;
    state.lastY = event.clientY;
  }

  function onPointerUp(event) {
    state.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  }

  function onPointerCancel() {
    state.dragging = false;
  }

  function onWheel(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    state.targetZoom = Math.max(0.9, Math.min(3.2, state.targetZoom * factor));
  }

  function onDoubleClick() {
    state.burstStartTime = getElapsedTime();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("dblclick", onDoubleClick);

  return function destroyControls() {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("dblclick", onDoubleClick);
  };
}

