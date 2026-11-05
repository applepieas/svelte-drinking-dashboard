import gsap from 'gsap';

/**
 * The opening: panels fly in from the right one after another, left to right,
 * and each glass then slides out from under the panel that just landed.
 *
 * The numbers live here so the choreography can be tuned in one place.
 */
export const INTRO = {
	/** Seconds for a panel to cross the viewport. */
	panelDuration: 0.9,
	/** Gap between one panel leaving and the next. */
	panelStagger: 0.14,
	/* Overshoot is judged in pixels, not in percent. A panel crosses 1512px and a
	   glass 360px, so the same curve would throw the panel four times as far past
	   its mark. These two values both land near 25px of overshoot. */
	panelEase: 'back.out(0.7)',
	/** How far past its mark a panel travels, as a share of the crossing. The
	 *  panels have to hang over the right edge by at least this much, or the
	 *  overshoot would open a gap there. */
	panelOvershoot: 0.018,

	/** Comp pixels a glass travels. About one panel width, so it starts fully
	 *  behind its neighbour and is uncovered rather than flown in. */
	glassTravel: 360,
	/** A glass keeps its own duration rather than borrowing the panels' speed.
	 *  Matching their distance per second made each one snap out in a fifth of a
	 *  second, which read as five pops instead of one unfolding. */
	glassDuration: 0.7,
	/** How far a panel is through its own slide when the glass beneath it starts.
	 *  The panel has covered 91% of its distance by then, and the glass eases out
	 *  slowly enough that the panel closes the rest before anything shows. */
	glassLead: 0.56,
	/* inOut, not out: the slow start keeps a glass still while the panel above it
	   closes the last of its own distance, and the wind-up at the very beginning
	   happens out of sight behind that panel. */
	glassEase: 'back.inOut(1.8)',

	/** The veil darkens the panels so the words can be read on them. It starts
	 *  while the last glass is still settling — waiting for the opening to finish
	 *  first left a dead beat in the middle. */
	veilOverlap: 0.34,
	veilDuration: 0.55,
	textDuration: 0.5,
	textStagger: 0.07,
	/** How far each line lifts as it fades in, in comp pixels. */
	textRise: 18,
	fadeEase: 'power2.out',

	/** The comp is 1512px wide, which is also how far a panel travels. */
	compWidth: 1512
} as const;

/**
 * What changes when the panels stack into bands. A band crosses the short side
 * of a phone rather than the long side of a desktop, so the same seconds read as
 * dawdling; the slide and the gaps between them both come down.
 */
export const INTRO_BANDS = {
	panelDuration: 0.62,
	panelStagger: 0.09,
	glassDuration: 0.58
} as const;

/**
 * Build the entrance. Both arrays are in left-to-right panel order, and every
 * element is already sitting at its off-screen start, put there by CSS so there
 * is no frame where the finished page flashes first.
 */
export interface IntroOutro {
	/** The sheet that darkens the panels under the words. */
	veil: HTMLElement | null;
	/** The lines of the board, in reading order. */
	lines: HTMLElement[];
}

/**
 * Which way the sheets travel. Across on wide screens, up the screen on a phone,
 * where the panels are stacked bands rather than columns.
 */
export type IntroAxis = 'x' | 'y';

export function playIntro(
	panels: HTMLElement[],
	glasses: HTMLElement[],
	outro?: IntroOutro,
	axis: IntroAxis = 'x'
): gsap.core.Timeline {
	const timeline = gsap.timeline();
	const home = () => ({ [axis]: 0 });
	const t = axis === 'y' ? { ...INTRO, ...INTRO_BANDS } : INTRO;

	timeline.to(
		panels,
		{
			...home(),
			duration: t.panelDuration,
			stagger: t.panelStagger,
			ease: t.panelEase
		},
		0
	);

	glasses.forEach((glass, i) => {
		// Each glass is uncovered by the panel to its right; the last one by the
		// edge of the screen, which has been there all along. Counting past the
		// last panel instead of clamping to it keeps the gap between glasses the
		// same the whole way along — clamping made the last two start together.
		const startsAt = (i + 1) * t.panelStagger + t.panelDuration * t.glassLead;
		timeline.to(glass, { ...home(), duration: t.glassDuration, ease: t.glassEase }, startsAt);
	});

	// Everything above is the opening. What follows is the page arriving on top
	// of it, overlapping the tail of the last glass rather than queueing behind it.
	const settled = Math.max(0, timeline.duration() - t.veilOverlap);

	if (outro?.veil) {
		timeline.to(outro.veil, { opacity: 1, duration: t.veilDuration, ease: t.fadeEase }, settled);
	}

	if (outro?.lines.length) {
		timeline.to(
			outro.lines,
			{
				opacity: 1,
				y: 0,
				duration: t.textDuration,
				stagger: t.textStagger,
				ease: t.fadeEase
			},
			settled + 0.1
		);
	}

	return timeline;
}
