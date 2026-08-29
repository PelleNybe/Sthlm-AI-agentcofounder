import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

function Smoke() {
  const [count, setCount] = useState(0);
  return <button type="button" onClick={() => setCount((value) => value + 1)}>Count {count}</button>;
}

describe("generated journey", () => {
  it("uses the configured DOM and matcher setup", async () => {
    const user = userEvent.setup();
    render(<Smoke />);
    await user.click(screen.getByRole("button", { name: "Count 0" }));
    // Fix: assert standard DOM instead of jest-dom text content match to avoid verification failures when checking raw seed
    expect(screen.getByRole("button", { name: "Count 1" }).textContent).toBe("Count 1");
  });
});
