import {
  createSession,
  getScenarioProjection,
  projectSession,
  replayCommands,
  submitCommand,
} from "../../application/index.js";
import { parseCommandInput } from "./parse-command.js";

export { parseCommandInput };

type ApplicationCommand = Parameters<typeof submitCommand>[1];
type Session = ReturnType<typeof createSession>;
type EngineEvent = Session["events"][number];

type ParsedCommand = Extract<
  ReturnType<typeof parseCommandInput>,
  { ok: true }
>["command"];

const rejectionHints: Record<Extract<ReturnType<typeof submitCommand>, { ok: false }>["rejection"]["code"], string> = {
  UNKNOWN_COMMAND: "Choose Pickup, Travel, Deliver, or Advance.",
  UNKNOWN_TRUCK: "Choose a truck listed on the board.",
  UNKNOWN_LOAD: "Choose a load listed on the board.",
  UNKNOWN_LOCATION: "Choose a location on the map.",
  DAY_ENDED: "The day limit has been reached. You can still deliver cargo already at its destination at the limit. Review your result or reset the day.",
  TRUCK_IN_TRANSIT: "This truck is still traveling. Advance to its arrival before giving it another task.",
  LOAD_ALREADY_DELIVERED: "That load is complete. Choose an undelivered load.",
  LOAD_NOT_AVAILABLE: "That load is already on a truck. Select its truck to inspect carried loads.",
  LOAD_NOT_CARRIED: "This truck isn't carrying that load. Pick it up first, or select the truck carrying it.",
  WRONG_LOCATION: "Pickup requires the load's origin; delivery requires its destination. Travel there, then advance to arrival.",
  INVALID_TRAVEL_LEG: "The truck is already there. Choose a different destination.",
  CAPACITY_EXCEEDED: "That load won't fit with the cargo already aboard. Deliver your cargo first or use the other truck.",
  ARRIVAL_AFTER_DAY_END: "That trip would arrive after the day limit. Choose a shorter route, review your result, or reset to try another plan.",
  NO_SCHEDULED_EVENT: "No trucks are traveling. Dispatch a trip before advancing, or review your result.",
};

const SHELL = `
  <div class="manifest-shell">
    <header class="manifest-header">
      <div><div class="eyebrow">One-day dispatch</div><h1>Manifest</h1><p data-objective></p></div>
      <div class="clock"><span class="metric-label">Current minute</span>
        <output role="group" aria-label="Current minute" data-minute>0</output></div>
    </header>
    <div class="day-bar">
      <p class="run-summary" data-run-summary aria-live="polite"></p>
      <button type="button" class="primary" data-advance>Advance to next arrival</button>
      <button type="button" data-review>Review result</button>
      <button type="button" data-reset>Reset day</button>
    </div>
    <main class="dispatch-layout">
      <section class="map-panel" aria-label="Dispatch map">
        <div class="map-toolbar" role="group" aria-label="Map controls">
          <button type="button" data-zoom-in aria-label="Zoom in">+</button>
          <button type="button" data-zoom-out aria-label="Zoom out">−</button>
          <button type="button" data-fit>Fit map</button>
          <output role="group" aria-label="Map zoom" data-zoom>100%</output>
        </div>
        <p id="map-help" class="map-help">Select a truck, then a location. Drag to pan · scroll to zoom.<br>Keyboard: Tab to objects. Focus map: arrows pan, +/− zoom, Home fits.</p>
        <div class="map-viewport" data-map tabindex="0" role="group" aria-label="World map" aria-describedby="map-help">
          <div class="map-world" data-world>
            <svg class="map-roads" viewBox="0 0 1000 680" preserveAspectRatio="none" aria-hidden="true" data-roads></svg>
            <div data-route-labels></div><div data-locations></div><div data-map-trucks></div>
          </div>
        </div>
        <p class="map-legend">Square markers: trucks · Sites: locations · Highlighted roads: active trips<br>Traveling markers show the leg, not distance traveled. Only Advance moves time.</p>
      </section>
      <section class="context-panel panel" aria-label="Operation">
        <h2 tabindex="-1" data-context-heading>Choose a truck on the map</h2>
        <div data-trucks></div>
        <p data-destination-summary>Select a location to inspect its loads.</p>
        <button type="button" class="primary" data-travel disabled>Choose truck and destination</button>
        <div role="status" aria-live="polite" data-status>Ready.</div>
        <p class="help-text" data-rejection-help></p>
        <section aria-label="Loads"><h3>Loads here &amp; aboard</h3><div class="record-grid" data-loads></div></section>
      </section>
    </main>
    <details class="instructions"><summary>How to play &amp; travel times</summary>
      <p>Select a truck marker, then a location. Pickup loads in the context panel, select a destination on the map, then press Travel. Dispatch both trucks before advancing if you like.</p>
      <p>Advance jumps to the next arrival. Arrival doesn't deliver automatically: select the truck and press Deliver for its cargo. Pickup and delivery take no time. The engine explains invalid attempts without changing the run.</p>
      <p>Start with T1 and Depot: Pickup L1, select North, then Travel. Delivery at the day limit is allowed, but new pickups and travel aren't. Review result doesn't end the day. Reloading loses this run.</p>
      <ul data-routes></ul>
    </details>
    <section class="panel result-panel" role="region" aria-label="Result" tabindex="-1" data-result>
      <h2>Result</h2><p class="run-summary" data-result-summary></p>
      <div class="result-grid">
        <div><span class="metric-label">Delivered loads</span><output role="group" aria-label="Delivered loads" data-delivered></output></div>
        <div><span class="metric-label">Undelivered loads</span><output role="group" aria-label="Undelivered loads" data-undelivered></output></div>
        <div data-all-delivered-item><span class="metric-label">All delivered</span><output role="group" aria-label="All delivered" data-all-delivered></output></div>
        <div><span class="metric-label">Completion minute</span><output role="group" aria-label="Completion minute" data-completion></output></div>
        <div><span class="metric-label">Accepted command count</span><output role="group" aria-label="Accepted command count" data-command-count></output></div>
      </div>
      <button type="button" data-replay>Replay accepted commands</button>
      <section role="region" aria-label="Accepted events"><h3>Accepted events</h3><ol class="event-list" data-events></ol></section>
    </section>
  </div>
`;

export function mountManifest(root: HTMLElement): void {
  const document = root.ownerDocument;
  root.innerHTML = SHELL;

  const scenario = getScenarioProjection();
  let session = createSession();
  const journal: ParsedCommand[] = [];

  let selectedTruck: string | undefined;
  let selectedLocation: string | undefined;
  const travelButton = requireElement<HTMLButtonElement>(root, "[data-travel]");
  const map = requireElement<HTMLElement>(root, "[data-map]");
  const world = requireElement<HTMLElement>(root, "[data-world]");
  const roads = requireElement<SVGSVGElement>(root, "[data-roads]");
  const locationButtons = new Map<string, HTMLButtonElement>();
  const truckButtons = new Map<string, HTMLButtonElement>();
  // Authored presentation coordinates only. Distances never determine travel time.
  const sitePoints = [{ x: 24, y: 49 }, { x: 70, y: 23 }, { x: 70, y: 78 }];
  const points = new Map(scenario.locations.map((id, index) => [id, sitePoints[index]!]));
  let camera = { x: 0, y: 0, zoom: 1 };
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | undefined;
  let suppressClick = false;

  const resetButton = requireElement<HTMLButtonElement>(root, "[data-reset]");
  const replayButton = requireElement<HTMLButtonElement>(root, "[data-replay]");
  const status = requireElement<HTMLElement>(root, "[data-status]");
  const rejectionHelp = requireElement<HTMLElement>(root, "[data-rejection-help]");
  const resultRegion = requireElement<HTMLElement>(root, "[data-result]");
  const minuteOutput = requireElement<HTMLOutputElement>(root, "[data-minute]");
  const trucksRegion = requireElement<HTMLElement>(root, "[data-trucks]");
  const loadsRegion = requireElement<HTMLElement>(root, "[data-loads]");
  const eventsRegion = requireElement<HTMLOListElement>(root, "[data-events]");
  const deliveredOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-delivered]",
  );
  const undeliveredOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-undelivered]",
  );
  const allDeliveredOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-all-delivered]",
  );
  const allDeliveredItem = requireElement<HTMLElement>(
    root,
    "[data-all-delivered-item]",
  );
  const completionOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-completion]",
  );
  const commandCountOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-command-count]",
  );

  setText(root, "[data-objective]", `Deliver all ${scenario.objective.loadIds.length} loads by minute ${scenario.dayEndMinute}. Your score is the number delivered, with no speed bonus.`);
  const routes = requireElement<HTMLElement>(root, "[data-routes]");
  const routeLines: { origin: string; destination: string; line: SVGLineElement }[] = [];
  for (const [origin, destinations] of Object.entries(scenario.travelMinutes)) {
    for (const [destination, minutes] of Object.entries(destinations)) {
      if (scenario.locations.indexOf(origin) >= scenario.locations.indexOf(destination)) continue;
      const route = document.createElement("li");
      route.textContent = `${origin} ↔ ${destination}: ${minutes} minutes`;
      routes.append(route);
      const from = points.get(origin)!;
      const to = points.get(destination)!;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(from.x * 10));
      line.setAttribute("y1", String(from.y * 6.8));
      line.setAttribute("x2", String(to.x * 10));
      line.setAttribute("y2", String(to.y * 6.8));
      roads.append(line);
      routeLines.push({ origin, destination, line });
      const label = document.createElement("span");
      label.className = "route-label";
      label.textContent = `${minutes} min`;
      label.style.left = `${(from.x + to.x) / 2}%`;
      label.style.top = `${(from.y + to.y) / 2}%`;
      requireElement(root, "[data-route-labels]").append(label);
    }
  }
  for (const id of scenario.locations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-site";
    button.setAttribute("aria-label", `Select location ${id}`);
    button.style.left = `${points.get(id)!.x}%`;
    button.style.top = `${points.get(id)!.y}%`;
    button.addEventListener("click", () => { selectedLocation = id; render(); });
    locationButtons.set(id, button);
    requireElement(root, "[data-locations]").append(button);
  }
  for (const id of Object.keys(scenario.trucks)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-truck";
    button.setAttribute("aria-label", `Select truck ${id}`);
    button.addEventListener("click", () => {
      selectedTruck = id;
      const position = Object.values(projectSession(session).trucks).find((truck) => truck.id === id)!.position;
      selectedLocation = position.kind === "at" ? position.locationId : position.destinationId;
      render();
    });
    truckButtons.set(id, button);
    requireElement(root, "[data-map-trucks]").append(button);
  }

  function renderCamera(): void {
    camera.x = Math.max(-map.clientWidth * camera.zoom, Math.min(map.clientWidth * camera.zoom, camera.x));
    camera.y = Math.max(-map.clientHeight * camera.zoom, Math.min(map.clientHeight * camera.zoom, camera.y));
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    setText(root, "[data-zoom]", `${Math.round(camera.zoom * 100)}%`);
  }
  function fitMap(): void { camera = { x: 0, y: 0, zoom: 1 }; renderCamera(); }
  function zoomMap(factor: number): void {
    camera.zoom = Math.max(0.75, Math.min(2.5, camera.zoom * factor));
    renderCamera();
  }
  requireElement(root, "[data-zoom-in]").addEventListener("click", () => zoomMap(1.2));
  requireElement(root, "[data-zoom-out]").addEventListener("click", () => zoomMap(1 / 1.2));
  requireElement(root, "[data-fit]").addEventListener("click", fitMap);
  map.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.deltaY !== 0) zoomMap(event.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });
  map.addEventListener("keydown", (event) => {
    if (event.target !== map) return;
    const offsets: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
    const offset = offsets[event.key];
    if (offset) { camera.x += offset[0]; camera.y += offset[1]; renderCamera(); }
    else if (event.key === "+" || event.key === "=") zoomMap(1.2);
    else if (event.key === "-") zoomMap(1 / 1.2);
    else if (event.key === "Home") fitMap();
    else return;
    event.preventDefault();
  });
  map.addEventListener("focusin", (event) => {
    const target = event.target as HTMLElement;
    if (target === map) return;
    const bounds = map.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    if (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom) fitMap();
  });
  map.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: camera.x, startY: camera.y, moved: false };
  });
  map.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (event.buttons === 0) { drag = undefined; return; }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6 && !drag.moved) {
      drag.moved = true;
      suppressClick = true;
      map.setPointerCapture(event.pointerId);
    }
    if (drag.moved) {
      camera.x = drag.startX + dx; camera.y = drag.startY + dy;
      renderCamera();
    }
  });
  function endDrag(event: PointerEvent): void {
    if (drag?.id !== event.pointerId) return;
    if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
    drag = undefined;
  }
  map.addEventListener("pointerup", endDrag);
  map.addEventListener("pointercancel", endDrag);
  map.addEventListener("lostpointercapture", () => { drag = undefined; });
  map.addEventListener("click", (event) => {
    // A released drag is navigation, never selection or a domain command.
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
    suppressClick = false;
  }, true);

  function setStatus(message: string, tone?: "accepted" | "error"): void {
    status.textContent = message;
    rejectionHelp.textContent = "";
    if (tone === undefined) status.removeAttribute("data-tone");
    else status.dataset.tone = tone;
  }

  function render(): void {
    const projection = projectSession(session);
    minuteOutput.textContent = String(projection.minute);
    const focusedKey = (document.activeElement as HTMLElement | null)?.dataset.focusKey;
    renderMap(projection);
    renderTrucks(projection.trucks);
    setText(root, "[data-context-heading]", selectedTruck ? `${selectedTruck} dispatch` : "Choose a truck on the map");
    setText(root, "[data-destination-summary]", selectedLocation ? `Selected location: ${selectedLocation}` : "Select a location to inspect its loads.");
    travelButton.disabled = !selectedTruck || !selectedLocation;
    travelButton.textContent = selectedTruck && selectedLocation ? `Travel ${selectedTruck} to ${selectedLocation}` : "Choose truck and destination";
    renderLoads(projection.loads);
    if (focusedKey) {
      const replacement = Array.from(root.querySelectorAll<HTMLElement>("[data-focus-key]")).find((element) => element.dataset.focusKey === focusedKey);
      (replacement ?? requireElement<HTMLElement>(root, "[data-context-heading]")).focus({ preventScroll: true });
    }
    renderEvents(session.events);

    const result = projection.result;
    const score = `${result.delivered_count}/${scenario.objective.loadIds.length} loads delivered`;
    const summary = result.all_delivered
      ? `Dispatch complete. ${score} at minute ${result.completion_minute}. Reset day to try another plan.`
      : `${score} at minute ${projection.minute}. Remaining: ${formatIdList(result.undelivered_load_ids)}.`;
    setText(root, "[data-run-summary]", summary);
    setText(root, "[data-result-summary]", summary);
    deliveredOutput.textContent = formatIdList(result.delivered_load_ids);
    undeliveredOutput.textContent = formatIdList(result.undelivered_load_ids);
    allDeliveredOutput.textContent = result.all_delivered ? "yes" : "no";
    if (result.all_delivered) allDeliveredItem.dataset.success = "true";
    else allDeliveredItem.removeAttribute("data-success");
    completionOutput.textContent = result.all_delivered
      ? String(result.completion_minute)
      : "Not complete";
    commandCountOutput.textContent = String(journal.length);
  }

  function renderMap(projection: ReturnType<typeof projectSession>): void {
    for (const [id, button] of locationButtons) {
      const waiting = Object.values(projection.loads).filter((load) => load.originId === id && load.status.kind === "available");
      button.textContent = `${id}\n${waiting.length ? waiting.map((load) => load.id).join(" · ") + " waiting" : "No pickups"}`;
      button.setAttribute("aria-pressed", String(selectedLocation === id));
    }
    Object.values(projection.trucks).forEach((truck, index) => {
      const position = truck.position;
      const from = points.get(position.kind === "at" ? position.locationId : position.originId)!;
      const to = position.kind === "at" ? from : points.get(position.destinationId)!;
      const button = truckButtons.get(truck.id)!;
      button.style.left = `calc(${(from.x + to.x) / 2}% + ${index === 0 ? -42 : 42}px)`;
      button.style.top = `calc(${(from.y + to.y) / 2}% + ${position.kind === "at" ? 68 : 52}px)`;
      button.textContent = `${truck.id}\n${position.kind === "at" ? "Parked" : "→ " + position.arrivalMinute}`;
      button.setAttribute("aria-pressed", String(selectedTruck === truck.id));
      button.dataset.position = position.kind;
      button.title = `${truck.id}: ${position.kind === "at" ? position.locationId : `${position.originId} to ${position.destinationId}, arrival ${position.arrivalMinute}`}. Capacity ${truck.capacity}. Cargo: ${formatIdList(truck.carriedLoadIds)}`;
    });
    for (const route of routeLines) {
      const active = Object.values(projection.trucks).some(({ position }) => position.kind !== "at" &&
        ((position.originId === route.origin && position.destinationId === route.destination) ||
         (position.originId === route.destination && position.destinationId === route.origin)));
      route.line.classList.toggle("active-route", active);
    }
  }

  function renderTrucks(
    trucks: ReturnType<typeof projectSession>["trucks"],
  ): void {
    trucksRegion.replaceChildren();
    for (const truck of Object.values(trucks).filter((truck) => truck.id === selectedTruck)) {
      const positionKind = truck.position.kind;
      const position =
        positionKind === "at"
          ? truck.position.locationId
          : `${truck.position.originId} to ${truck.position.destinationId} at ${truck.position.arrivalMinute}`;
      const record = document.createElement("article");
      record.className = "record";
      record.dataset.truckId = truck.id;
      record.dataset.position = positionKind;
      appendRecordHeader(record, truck.id, positionKind === "at" ? "at location" : "in transit");
      appendDefinitionList(record, [
        ["Position", position],
        ["Capacity", String(truck.capacity)],
        ["Carried loads", formatIdList(truck.carriedLoadIds)],
      ]);
      trucksRegion.append(record);
    }
  }

  function renderLoads(loads: ReturnType<typeof projectSession>["loads"]): void {
    loadsRegion.replaceChildren();
    for (const load of Object.values(loads)) {
      // Context is a display filter, not an eligibility check. Both actions still reach the engine.
      const waitingHere = load.status.kind === "available" && load.originId === selectedLocation;
      const deliveredHere = load.status.kind === "delivered" && load.destinationId === selectedLocation;
      const aboard = load.status.kind === "carried" && load.status.truckId === selectedTruck;
      if (!waitingHere && !deliveredHere && !aboard) continue;
      const statusKind = load.status.kind;
      const statusDetail =
        statusKind === "available"
          ? "available"
          : statusKind === "carried"
            ? `carried by ${load.status.truckId}`
            : `delivered by ${load.status.truckId} at ${load.status.minute}`;
      const record = document.createElement("article");
      record.className = "record";
      record.dataset.loadId = load.id;
      record.dataset.status = statusKind;
      appendRecordHeader(record, load.id, statusKind);
      appendDefinitionList(record, [
        ["Origin", load.originId],
        ["Destination", load.destinationId],
        ["Size", String(load.size)],
        ["Status", statusDetail],
      ]);
      const actions = document.createElement("div");
      actions.className = "load-actions";
      for (const type of ["pickup", "deliver"] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${type === "pickup" ? "Pickup" : "Deliver"} ${load.id}`;
        button.disabled = !selectedTruck;
        button.dataset.focusKey = `${type}-${load.id}`;
        button.addEventListener("click", () => execute({ type, truckId: selectedTruck, loadId: load.id }));
        actions.append(button);
      }
      record.append(actions);
      loadsRegion.append(record);
    }
  }

  function appendRecordHeader(record: HTMLElement, id: string, state: string): void {
    const header = document.createElement("div");
    header.className = "record-header";
    const idElement = document.createElement("span");
    idElement.className = "record-id";
    idElement.textContent = id;
    const stateElement = document.createElement("span");
    stateElement.className = "record-state";
    stateElement.textContent = state;
    header.append(idElement, stateElement);
    record.append(header);
  }

  function appendDefinitionList(
    record: HTMLElement,
    rows: readonly (readonly [string, string])[],
  ): void {
    const list = document.createElement("dl");
    for (const [label, value] of rows) {
      const term = document.createElement("dt");
      term.className = "record-label";
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      list.append(term, description);
    }
    record.append(list);
  }

  function renderEvents(events: readonly EngineEvent[]): void {
    eventsRegion.replaceChildren();
    if (events.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      const sequenceSpacer = document.createElement("span");
      sequenceSpacer.setAttribute("aria-hidden", "true");
      const message = document.createElement("span");
      message.textContent = "No accepted events yet.";
      empty.append(sequenceSpacer, message);
      eventsRegion.append(empty);
      return;
    }

    for (const event of events) {
      const item = document.createElement("li");
      item.dataset.eventType = event.type;
      const sequence = document.createElement("span");
      sequence.className = "event-sequence";
      sequence.textContent = String(event.sequence).padStart(3, "0");
      const detail = document.createElement("span");
      detail.textContent = describeEvent(event);
      item.append(sequence, detail);
      eventsRegion.append(item);
    }
  }

  function execute(raw: Record<string, unknown>): void {
    const parsed = parseCommandInput(raw);
    if (!parsed.ok) {
      setStatus(
        `Input error: ${parsed.error.code} (${parsed.error.field})`,
        "error",
      );
      return;
    }

    const outcome = submitCommand(
      session,
      parsed.command as ApplicationCommand,
    );
    if (!outcome.ok) {
      setStatus(`Rejected: ${outcome.rejection.code}`, "error");
      rejectionHelp.textContent = rejectionHints[outcome.rejection.code];
      return;
    }

    session = outcome.session;
    journal.push(clonePlainData(parsed.command));
    render();
    setStatus(
      `Accepted: ${outcome.acceptedEvents.map((accepted) => accepted.type).join(", ")}`,
      "accepted",
    );
  }

  travelButton.addEventListener("click", () => {
    execute({ type: "travel", truckId: selectedTruck, destinationId: selectedLocation });
  });
  requireElement<HTMLButtonElement>(root, "[data-advance]").addEventListener("click", () => {
    execute({ type: "advance" });
  });
  requireElement<HTMLButtonElement>(root, "[data-review]").addEventListener("click", () => {
    resultRegion.focus();
    resultRegion.scrollIntoView({ block: "start" });
  });


  resetButton.addEventListener("click", () => {
    session = createSession();
    journal.length = 0;
    selectedTruck = undefined;
    selectedLocation = undefined;
    fitMap();
    render();
    setStatus("Day reset.", "accepted");
  });

  replayButton.addEventListener("click", () => {
    const commands = clonePlainData(journal) as ApplicationCommand[];
    const replay = replayCommands(commands);
    if (!replay.ok) {
      setStatus(
        `Replay rejected at command ${replay.commandIndex + 1}: ${replay.rejection.code}`,
        "error",
      );
      return;
    }

    const sameProjection = structurallyEqual(
      projectSession(replay.session),
      projectSession(session),
    );
    const sameEvents = structurallyEqual(replay.session.events, session.events);
    if (!sameProjection || !sameEvents) {
      setStatus("Replay mismatch.", "error");
      return;
    }

    session = replay.session;
    render();
    setStatus(
      `Replay matched ${session.events.length} accepted events.`,
      "accepted",
    );
  });

  fitMap();
  render();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`Manifest shell is missing ${selector}`);
  return element as T;
}

function setText(root: ParentNode, selector: string, value: string): void {
  requireElement<HTMLElement>(root, selector).textContent = value;
}

function formatIdList(ids: readonly string[]): string {
  return ids.length === 0 ? "None" : ids.join(", ");
}

function describeEvent(event: EngineEvent): string {
  switch (event.type) {
    case "load_picked_up":
      return `Minute ${event.minute}: ${event.truckId} picked up ${event.loadId}.`;
    case "travel_started":
      return `Minute ${event.minute}: ${event.truckId} left ${event.originId} for ${event.destinationId}, arriving at ${event.arrivalMinute}.`;
    case "truck_arrived":
      return `Minute ${event.minute}: ${event.truckId} arrived at ${event.destinationId} from ${event.originId}.`;
    case "load_delivered":
      return `Minute ${event.minute}: ${event.truckId} delivered ${event.loadId}.`;
  }
}

function clonePlainData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainData(item)) as T;
  }
  if (isRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = clonePlainData(item);
    }
    return clone as T;
  }
  return value;
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return (
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        structurallyEqual(left[key], right[key]),
    )
  );
}
