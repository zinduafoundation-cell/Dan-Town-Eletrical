/** * Motion Configuration & Timing Constants * Based on Dantown Design System guidelines */ export const ANIMATION_DURATIONS: Record<"FAST" | "NORMAL" | "MEDIUM" | "SLOW", number> = {FAST : 100, NORMAL : 200, MEDIUM : 300, SLOW : 500
};export const EASING = {DEFAULT : 'easeInOut' as const,EASE_OUT: 'easeOut' as const,EASE_IN : 'easeIn' as const,SMOOTH: 'easeInOut' as const,
};export const STAGGER_DELAY = 40; // ms between staggered items /** * Page entrance animation variants */
export const pageEntranceVariants = {hidden : {opacity : 0,y : 8,},visible : {opacity : 1,y : 0,transition : {duration : ANIMATION_DURATIONS.MEDIUM / 1000,ease : EASING.EASE_OUT,},},exit : {opacity : 0,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},
}; /** * Fade in animation */
export const fadeInVariants = {hidden : { opacity: 0 },visible: {opacity : 1,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},
}; /** * Fade up animation */
export const fadeUpVariants = {hidden : { opacity: 0, y: 16 },visible: {opacity : 1,y : 0,transition : {duration : ANIMATION_DURATIONS.MEDIUM / 1000,ease : EASING.EASE_OUT,},},
}; /** * Scale in animation */
export const scaleInVariants = {hidden : { opacity: 0, scale: 0.95 },visible: {opacity : 1,scale : 1,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},
}; /** * Slide in from left */
export const slideLeftVariants = {hidden : { opacity: 0, x: -20 },visible: {opacity : 1,x : 0,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},
}; /** * Slide in from right */
export const slideRightVariants = {hidden : { opacity: 0, x: 20 },visible: {opacity : 1,x : 0,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},
}; /** * Stagger container for sequential child animations */
export const staggerContainerVariants = {visible : {transition : {staggerChildren : STAGGER_DELAY / 1000,delayChildren : 0,},},
}; /** * Stagger child item */
export const staggerItemVariants = {hidden : { opacity: 0, y: 10 },visible: {opacity : 1,y : 0,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},
}; /** * Hover lift effect for cards */
export const cardHoverVariants = {rest : {y : 0,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,},},hover : {y : -4,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,ease : EASING.EASE_OUT,},},
}; /** * Button press effect */
export const buttonPressVariants = {rest : { scale: 1 },press: {scale : 0.98,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,},},
}; /** * Modal backdrop fade */
export const modalBackdropVariants = {hidden : { opacity: 0 },visible: {opacity : 0.4,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,},},exit : {opacity : 0,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,},},
}; /** * Modal scale and fade */
export const modalVariants = {hidden : { opacity: 0, scale: 0.95 },visible: {opacity : 1,scale : 1,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},exit : {opacity : 0,scale : 0.95,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,},},
}; /** * Skeleton shimmer animation */
export const skeletonVariants = {shimmer : {backgroundPosition : ['200% 0', '-200% 0'],transition : {duration : 2,repeat : Infinity,ease : 'linear',},},
}; /** * Number counter animation */
export const numberCounterVariants = {visible : {transition : {staggerChildren : 0.05,},},
}; /** * Image zoom and fade */
export const imageZoomVariants = {hidden : { opacity: 0, scale: 0.97 },visible: {opacity : 1,scale : 1,transition : {duration : ANIMATION_DURATIONS.MEDIUM / 1000,ease : EASING.EASE_OUT,},},
}; /** * Product card image hover zoom */
export const productImageHoverVariants = {rest : { scale: 1 },hover: {scale : 1.03,transition : {duration : ANIMATION_DURATIONS.NORMAL / 1000,ease : EASING.EASE_OUT,},},
}; /** * Remove/slide out animation */
export const slideOutVariants = {hidden : { opacity: 1, x: 0 },exit: {opacity : 0,x : 100,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,ease : EASING.EASE_OUT,},},
}; /** * Success animation */
export const successVariants = {initial : { scale: 0.8, opacity: 0 },animate: {scale : 1,opacity : 1,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,ease : EASING.EASE_OUT,},},exit : {scale : 0.8,opacity : 0,transition : {duration : ANIMATION_DURATIONS.FAST / 1000,},},
};
