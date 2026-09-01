import { afterEach, expect, it, vi } from "vite-plus/test";

const { getElementContext, ipcRenderer } = vi.hoisted(() => ({
  getElementContext: vi.fn(),
  ipcRenderer: { on: vi.fn(), send: vi.fn() },
}));

vi.mock("electron", () => ({ ipcRenderer }));
vi.mock("react-grab/primitives", () => ({ getElementContext }));

vi.stubGlobal("window", { addEventListener: vi.fn() });
vi.stubGlobal("location", { href: "https://example.com/dashboard" });
vi.stubGlobal("document", { title: "Dashboard" });

const { captureElement } = await import("./PickPreload.ts");

afterEach(() => {
  vi.useRealTimers();
  getElementContext.mockReset();
});

it("falls back when react-grab element context never settles", async () => {
  vi.useFakeTimers();
  getElementContext.mockReturnValue(new Promise(() => undefined));

  const element = {
    tagName: "DIV",
    outerHTML: '<div class="css-view-g5y9jx flex-row">Logos</div>',
  } as Element;
  const capture = captureElement(element);

  await vi.advanceTimersByTimeAsync(5_000);
  const result = await Promise.race([capture, Promise.resolve("still pending")]);

  expect(result).toEqual(
    expect.objectContaining({
      pageUrl: "https://example.com/dashboard",
      tagName: "div",
      selector: null,
      htmlPreview: element.outerHTML,
      componentName: null,
      source: null,
      stack: [],
      styles: "",
    }),
  );
});
