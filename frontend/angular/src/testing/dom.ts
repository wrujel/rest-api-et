import { ComponentFixture } from '@angular/core/testing';

/**
 * `fixture.nativeElement` is typed `any`, which both loses autocompletion and
 * makes generic `querySelector<T>` calls a compile error. These helpers narrow
 * it once so the specs can stay readable.
 */
export const host = (fixture: ComponentFixture<unknown>): HTMLElement =>
  fixture.nativeElement as HTMLElement;

export const query = <T extends Element = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
): T | null => host(fixture).querySelector<T>(selector);

export const queryAll = <T extends Element = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
): T[] => Array.from(host(fixture).querySelectorAll<T>(selector));

export const text = (fixture: ComponentFixture<unknown>): string =>
  host(fixture).textContent ?? '';

/** Clicks the first element matching `selector`, failing loudly if it is absent. */
export const click = (
  fixture: ComponentFixture<unknown>,
  selector: string,
): void => {
  const element = query<HTMLElement>(fixture, selector);
  if (!element) throw new Error(`No element matched "${selector}"`);
  element.click();
  fixture.detectChanges();
};

/** Types `value` into the first input matching `selector`. */
export const setInputValue = (
  fixture: ComponentFixture<unknown>,
  selector: string,
  value: string,
): void => {
  const input = query<HTMLInputElement | HTMLTextAreaElement>(
    fixture,
    selector,
  );
  if (!input) throw new Error(`No input matched "${selector}"`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
};
