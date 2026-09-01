/** Modules of empty space the spec requires around a code so scanners lock on. */
export const QUIET_ZONE = 4;

export interface QrCode {
	/** Width of the viewBox, quiet zone included. */
	extent: number;
	/** A single SVG path covering every dark module. */
	d: string;
}
