import { describe, expect, it } from "vitest";
import { formatActivity } from "../src/lib/activity-format";

describe("activity format", () => {
  it("renders Ukrainian sentences", () => {
    expect(formatActivity("issue.created", "Олена", JSON.stringify({ key: "DEMO-5" }), "DEMO-5")).toContain(
      "створив",
    );
    expect(formatActivity("issue.moved", "Марія", null, "DEMO-4")).toContain("статус");
  });
});
