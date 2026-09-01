import encodeQR from 'qr';
import { QUIET_ZONE, type QrCode } from '$lib/qr';

/**
 * Renders to one path rather than a matrix of rects: a 33x33 code is over a
 * thousand modules, and shipping that many DOM nodes (or the raw matrix as JSON)
 * to the page for a decorative-looking square is wasteful. Horizontal runs are
 * merged, which typically cuts the path to a few hundred commands.
 *
 * Returning path data instead of finished markup also keeps {@html} out of the
 * codebase entirely.
 */
export function encodeQrPath(text: string): QrCode {
	const matrix = encodeQR(text, 'raw');
	const size = matrix.length;
	let d = '';

	for (let y = 0; y < size; y++) {
		let x = 0;
		while (x < size) {
			if (!matrix[y][x]) {
				x++;
				continue;
			}
			let run = 1;
			while (x + run < size && matrix[y][x + run]) run++;
			d += `M${x} ${y}h${run}v1h-${run}z`;
			x += run;
		}
	}

	return { extent: size + QUIET_ZONE * 2, d };
}
