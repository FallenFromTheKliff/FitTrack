export function getLoginAnimationDelay(index: number) {
  return index * 0.08;
}

export function getLoginItemTransition(shouldAnimate: boolean, index: number) {
  if (!shouldAnimate) {
    return { duration: 0 };
  }

  return {
    duration: 0.4,
    ease: "easeOut" as const,
    delay: getLoginAnimationDelay(index)
  };
}