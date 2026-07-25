import type { IrDevice, IrButton } from "@/db/schema";

/** A device row with its buttons — the shape the /remote page hands the client. */
export type DeviceWithButtons = IrDevice & { buttons: IrButton[] };

export type { IrDevice, IrButton };
