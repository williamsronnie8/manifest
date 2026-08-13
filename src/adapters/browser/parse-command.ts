type Command =
  | { type: "pickup"; truckId: string; loadId: string }
  | { type: "travel"; truckId: string; destinationId: string }
  | { type: "deliver"; truckId: string; loadId: string }
  | { type: "advance" };

type ParseResult =
  | { ok: true; command: Command }
  | { ok: false; error: { code: "MALFORMED_INPUT"; field: string } };

function malformed(field: string): ParseResult {
  return { ok: false, error: { code: "MALFORMED_INPUT", field } };
}

function requiredString(
  input: Record<string, unknown>,
  field: string,
): string | null {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

export function parseCommandInput(input: unknown): ParseResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return malformed("command");
  }

  const record = input as Record<string, unknown>;
  const type = record.type;
  if (type !== "pickup" && type !== "travel" && type !== "deliver" && type !== "advance") {
    return malformed("type");
  }

  switch (type) {
    case "pickup":
    case "deliver": {
      const truckId = requiredString(record, "truckId");
      if (truckId === null) return malformed("truckId");
      const loadId = requiredString(record, "loadId");
      if (loadId === null) return malformed("loadId");
      return { ok: true, command: { type, truckId, loadId } };
    }
    case "travel": {
      const truckId = requiredString(record, "truckId");
      if (truckId === null) return malformed("truckId");
      const destinationId = requiredString(record, "destinationId");
      if (destinationId === null) return malformed("destinationId");
      return { ok: true, command: { type, truckId, destinationId } };
    }
    case "advance":
      return { ok: true, command: { type: "advance" } };
  }
}
