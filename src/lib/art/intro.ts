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

	/** The comp is 1512px wide, which is also how far a panel travels. */
	compWidth: 1512
} as const;

/**
 * Build the entrance. Both arrays are in left-to-right panel order, and every
 * element is already sitting at its off-screen start, put there by CSS so there
 * is no frame where the finished page flashes first.
 */
export function playIntro(panels: HTMLElement[], glasses: HTMLElement[]): gsap.core.Timeline {
	const timeline = gsap.timeline();

	timeline.to(
		panels,
		{
			x: 0,
			duration: INTRO.panelDuration,
			stagger: INTRO.panelStagger,
			ease: INTRO.panelEase
		},
		0
	);

	glasses.forEach((glass, i) => {
		// Each glass is uncovered by the panel to its right; the last one by the
		// edge of the screen, which has been there all along. Counting past the
		// last panel instead of clamping to it keeps the gap between glasses the
		// same the whole way along — clamping made the last two start together.
		const startsAt = (i + 1) * INTRO.panelStagger + INTRO.panelDuration * INTRO.glassLead;
		timeline.to(glass, { x: 0, duration: INTRO.glassDuration, ease: INTRO.glassEase }, startsAt);
	});

	return timeline;
}
