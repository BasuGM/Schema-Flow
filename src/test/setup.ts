import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { installDomMocks } from "./dom-mocks";

if (typeof window !== "undefined") installDomMocks();

afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
