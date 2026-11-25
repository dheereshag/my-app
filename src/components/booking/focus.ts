/** After a failed "Continue", move keyboard and screen-reader focus to the first field that needs fixing. */
export function focusFirstInvalid(): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
